# NoteAI OpenAI Cost Optimization Design

## Goal

Make the cost of one text or voice capture predictable and observable without
weakening the normal Ukrainian task-extraction flow. Keep the current low-cost
models, avoid duplicate billable analysis after malformed model output, and
preserve one provider-level retry for transient infrastructure failures.

## Current Evidence

The production contract currently uses `gpt-5-nano` for task analysis and
`gpt-4o-mini-transcribe` for speech-to-text. As of 2026-07-20, the documented
standard rates are:

- `gpt-5-nano`: $0.05 per 1M input tokens, $0.005 per 1M cached input tokens,
  and $0.40 per 1M output tokens;
- `gpt-4o-mini-transcribe`: an estimated $0.003 per audio minute.

A normal recording is limited to 60 seconds, so these rates do not by
themselves explain a recurring $0.01-$0.10 charge per short note. The current
implementation also does not emit usage telemetry, which means a balance change
cannot be attributed to one recording, one parse, retries, or unrelated project
traffic.

Task parsing currently has two retry layers: the OpenAI SDK receives
`maxRetries: 1`, and `parseTasksWithClient` independently makes a second request
when local structured-output parsing fails. A malformed but billable response
can therefore trigger another billable analysis automatically. Transcription
has only the SDK retry.

## Approaches Considered

1. Keep both retry layers and add telemetry only. This maximizes automatic
   recovery but preserves unnecessary repeat analysis after a paid malformed
   response.
2. Disable every automatic retry. This gives the lowest strict request count,
   but turns short-lived network, rate-limit, and provider failures into visible
   user failures.
3. Keep one SDK retry for transient failures, remove the application-level
   structured-output retry, and add privacy-safe usage and cost telemetry. This
   is selected because it targets duplicate billable work while preserving
   normal reliability.

## Design

### Model and request controls

- Keep `OPENAI_MODEL=gpt-5-nano` and
  `OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe` as defaults.
- Set GPT-5 reasoning effort to `minimal`, which fits deterministic extraction
  and reduces avoidable reasoning tokens.
- Set `max_output_tokens: 1200`, sized for a 60-second note and the existing
  structured task schema. Validate the value against the Ukrainian acceptance
  fixtures before release; a length-truncated response is a failure, not a
  partial task list.
- Keep Structured Outputs and the existing server-side normalization. Do not
  trade schema safety for a cheaper free-form response.
- Do not add prompt caching configuration. The stable prefix is short and below
  the point where caching would materially reduce this flow's cost.

### Retry policy

- Each call to `responses.parse` is made once by NoteAI.
- The OpenAI SDK keeps `maxRetries: 1` for its supported transient transport and
  provider failures.
- A local Zod, JSON, empty-output, length, content-filter, or other structured
  response failure is returned to the existing error path immediately. NoteAI
  does not silently buy a second analysis.
- The existing UI remains the manual retry control: the note stays editable and
  the user can press `Розібрати` again.
- Transcription retains its current single SDK retry because there is no second
  application-level retry to remove.

### Usage and cost telemetry

Add a server-only cost-normalization module with a strict allowlisted event
shape. Successful task analysis emits one event containing:

- event name and operation (`parse` or `transcribe`);
- configured model ID;
- input, cached-input, output, reasoning, and total tokens when the provider
  returns them;
- server-verified audio duration for transcription;
- attempt outcome and request ID when safely available;
- estimated cost in integer micro-dollars when the configured model has a known
  rate snapshot;
- pricing snapshot date.

The event must never include note text, transcript text, prompts, structured
tasks, audio bytes, authorization data, API keys, raw errors, or complete
provider response objects. Unknown models still emit raw usage counters but set
estimated cost to `null`; the estimator must never pretend that an outdated or
unknown rate is current.

The transcription route already verifies duration server-side. Pass that
verified duration into the telemetry boundary after a successful provider call;
never trust a client-supplied duration for billing estimates.

Failed calls continue to use the existing sanitized OpenAI error diagnostic.
Add the operation and a local attempt count only if they remain allowlisted and
contain no request content.

### Spending safeguards

The application enforces the controls it can guarantee without adding accounts
or a shared database:

- 60-second server-verified audio limit;
- 10 MB audio limit;
- 10,000-character parse input limit;
- bounded model output;
- no automatic application-level re-analysis;
- one configured low-cost model per operation.

A reliable cross-instance daily dollar cutoff is not implemented in this MVP.
Vercel serverless instances do not share durable in-memory counters, and adding
a database only for a daily counter would violate the product's current
simplicity boundary. The deployment owner should instead configure a dedicated
OpenAI project budget/alert for NoteAI and review the new per-operation telemetry.
A hard daily application cutoff can be added later only with shared server-side
storage and an explicit product decision.

## Data Flow

### Text capture

1. The browser sends one validated note to `/api/parse-note`.
2. The server sends one Structured Outputs request using minimal reasoning and
   the 1,200-token output cap.
3. The SDK may retry a supported transient provider failure once.
4. A valid result is normalized and returned; the server emits one safe usage
   event for the successful provider response.
5. A malformed structured result follows the existing error response without a
   second NoteAI request. The user may retry manually.

### Voice capture

1. The server validates file type, size, and duration.
2. One transcription request is made, with at most one SDK transient retry.
3. The server emits a safe transcription cost event using verified duration.
4. The transcript remains editable; no task-analysis charge occurs until the
   user explicitly presses `Розібрати`.
5. The confirmed transcript then follows the text-capture flow.

## Error Handling

- Preserve the public `AI_UNAVAILABLE` and `TRANSCRIPTION_UNAVAILABLE`
  contracts.
- Preserve note/transcript content locally after provider failure.
- Do not return provider usage, internal rates, or diagnostics to the browser.
- Do not log a successful cost event before the provider result and required
  usage fields have been safely normalized.
- Estimation failures must never fail a successful user request.

## Testing

Follow red-green TDD with focused tests for:

- one NoteAI parse attempt after a malformed structured response;
- one SDK retry setting retained for parse and transcription;
- minimal reasoning and bounded output parameters on `gpt-5-nano`;
- existing Ukrainian extraction fixtures remaining equivalent;
- exact integer cost calculations at the current known rates;
- unknown models producing `estimatedCostUsdMicros: null`;
- token usage and verified audio duration surviving normalization;
- note text, transcript text, prompts, tasks, audio, keys, raw errors, and raw
  provider objects never appearing in serialized telemetry;
- estimation/logging failure not changing a successful API response;
- route contracts and manual retry UX remaining unchanged.

Run the targeted OpenAI tests, the full unit suite, model evaluation when a test
API key is intentionally available, lint, typecheck, build, secret scan, and
`git diff --check` before release.

## Success Criteria

- A successful parse makes one NoteAI-level model request.
- A malformed structured response never triggers a silent paid re-analysis.
- Normal task quality remains equivalent across the Ukrainian acceptance set.
- Each successful operation produces privacy-safe evidence sufficient to
  distinguish transcription cost, parsing tokens, NoteAI-level retry behavior,
  and unrelated balance changes. Provider-level SDK retry activity is reconciled
  against the OpenAI project Usage view because the SDK does not expose a
  guaranteed portable attempt counter in the current application contract.
- A 60-second voice capture has a documented expected transcription estimate of
  about $0.003 plus the measured `gpt-5-nano` token cost.
- No note, transcript, prompt, task content, credential, or raw provider payload
  is exposed in logs or client responses.

## Explicit Non-Goals

- changing to a more expensive model;
- combining transcription and task parsing into a new multimodal request before
  measured evidence justifies the quality and cost trade-off;
- accounts, cloud task storage, shared rate-limit storage, or billing UI;
- automatic retries after local structured-output validation failures;
- treating dashboard balance rounding as proof of one request's exact cost.
