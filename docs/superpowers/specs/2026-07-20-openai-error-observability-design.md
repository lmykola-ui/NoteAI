# NoteAI OpenAI Error Observability Design

## Goal

Make production failures in `/api/parse-note` diagnosable without exposing the
OpenAI API key, note contents, prompts, model output, or request payloads.

## Current Problem

The route catches every exception and returns `AI_UNAVAILABLE` with HTTP 502.
Because the caught value is discarded, Vercel records the failed invocation but
cannot show whether OpenAI returned an authentication, quota, rate-limit, model,
timeout, or response-validation error.

## Approaches Considered

1. Log the raw caught error. This is quick but risks logging request bodies,
   headers, SDK internals, or other sensitive provider data.
2. Log a strict allowlist of diagnostic fields. This keeps enough evidence for
   root-cause analysis while preserving the application's privacy boundary.
3. Return the provider error to the browser. This would expose implementation
   details to every visitor and is rejected.

Approach 2 is selected.

## Design

Add a small server-only error-normalization function near the API route. It
accepts an unknown caught value and returns only these allowlisted fields when
available:

- stable event name;
- error class or safe type label;
- provider HTTP status;
- provider error code;
- provider request ID;
- whether the failure is a timeout.

The logger must never serialize the original error object and must never include
the API key, authorization headers, note text, system prompt, model response,
request body, or stack trace. The public API response remains the existing
`{ "code": "AI_UNAVAILABLE" }` with status 502, so no client contract changes.

## Data Flow

1. The browser sends the existing parse request.
2. The route validates it and calls OpenAI through the existing parser.
3. On success, behavior is unchanged.
4. On failure, the route converts the caught value into the strict diagnostic
   record, writes one server-side error event, and returns the existing 502.
5. Vercel Runtime Logs show the sanitized record, enabling the next fix to target
   the confirmed provider or validation failure.

## Testing

Add route-level regression tests that inject representative failures and verify:

- the route still returns HTTP 502 and `AI_UNAVAILABLE`;
- the allowlisted status, code, request ID, type, and timeout flag are logged;
- raw messages, note content, headers, API keys, response bodies, and stacks are
  absent from the serialized diagnostic record;
- successful parsing remains unchanged.

Follow red-green TDD: first run the new test against the current empty `catch`
and confirm the expected failure, then implement the smallest code change and
rerun the targeted and full verification suites.

## Release Check

Run the route test, full unit suite, lint, typecheck, build, secret scan, and
`git diff --check`. After a new Vercel deployment, reproduce the parse failure
once and inspect the single sanitized runtime-log event. The log determines the
separate root-cause fix; this observability change does not guess at that fix.
