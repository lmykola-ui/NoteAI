# OpenAI resilience and Ukrainian transcription design

## Goal

Make the existing capture flow reliable without adding new product steps:

1. typed or transcribed Ukrainian note;
2. OpenAI separates it into task drafts;
3. the user receives tasks or a clarification instead of an avoidable generic error.

The change also improves recognition of Ukrainian technical vocabulary such as
“вайбкодити” and “завайбкодити”.

## Evidence and root cause

The Preview deployment proves that the OpenAI credentials and both API routes
are reachable:

- `/api/transcribe` returned `200`;
- one mobile parse completed successfully;
- two subsequent `/api/parse-note` requests returned `502`;
- neither failed parse contained an OpenAI HTTP status, request ID, or timeout.

The structured-response helper parses model output through Zod before the
application receives it. A small schema deviation can therefore throw a local
parser error. The current application treats that recoverable model-output
variation as a complete API failure.

The transcription request already uses `gpt-4o-mini-transcribe`, but its
prompt only says that the audio is a Ukrainian everyday note. It provides no
explicit Ukrainian language code and no examples of the technical vocabulary
used in this product.

## Considered approaches

### 1. Tolerant normalization plus one targeted retry (selected)

Use a structural wire schema, normalize harmless field deviations at the
application boundary, and retry once only when the model result cannot be
parsed or normalized.

This preserves tasks when only an optional date or time is malformed and keeps
real authentication, quota, permission, and transport failures visible.

### 2. Retry every failed request

This is smaller, but it repeats permanent API failures, increases latency and
cost, and does not address the strict format boundary.

### 3. Replace the models with larger models

`gpt-5-mini` and `gpt-4o-transcribe` may improve quality, but increase cost
and still do not remove the need for defensive parsing and a useful
transcription prompt.

## Task parsing design

### Wire response

Keep the JSON structure and finite enums strict:

- `tasks` is an array;
- every task has string title, nullable string date/time, valid status, and
  valid nullable priority;
- `clarification` is a nullable string.

Do not enforce semantic date/time validity or short text limits inside the
OpenAI SDK parser. Those constraints belong to application normalization, where
they can be handled without losing the whole response.

### Normalization

- trim task titles and discard blank titles;
- limit accepted titles and clarification to their existing maximum lengths;
- keep only the first 50 valid tasks;
- convert impossible or malformed optional dates and times to `null`;
- when valid tasks exist, return them and ignore a simultaneous clarification;
- when no valid tasks exist, return a nonblank clarification;
- when neither outcome exists, treat the response as invalid.

This does not invent dates, times, priorities, statuses, or task content.

### Retry policy

Make at most two model attempts.

Retry once only when:

- the SDK cannot parse the structured model output; or
- application normalization produces neither tasks nor clarification.

Do not retry OpenAI API errors, authentication, permission, quota/rate-limit,
connection, or timeout failures. The SDK's existing transport retry behavior
remains unchanged.

If the second model response is still invalid, preserve the current public
`502 { code: "AI_UNAVAILABLE" }` contract and emit the safe diagnostic event.

## Transcription design

Keep `gpt-4o-mini-transcribe` as the default model.

Send:

- `language: "uk"`;
- a concise Ukrainian prompt describing a personal task note;
- a bounded vocabulary sample containing common product and technical terms,
  including “вайбкодити”, “завайбкодити”, “вайбкодинг”, “застосунок”,
  “вебзастосунок”, OpenAI, ChatGPT, Codex, Claude, Figma, Vercel, GitHub, API,
  UI and UX.

The vocabulary is context for speech recognition, not a post-processing
replacement table. The application must not rewrite transcript text after the
model returns it.

## Error handling and privacy

- retain the existing safe allowlisted server diagnostic;
- add an explicit safe classification for invalid structured model output;
- do not log note text, audio, transcript, prompt, model output, raw error
  messages, credentials, headers, request bodies, or stacks;
- keep the existing client-facing error messages and status codes.

## Testing

Add tests before implementation for:

- one retry after an SDK-side structured-output parse failure;
- one retry after an unusable normalized result;
- no retry for an OpenAI/API-style error;
- preserving tasks while nulling an impossible optional date or time;
- trimming and bounding text;
- selecting tasks over a simultaneous clarification;
- failing after the second unusable response;
- sending `language: "uk"` and the bounded technical-vocabulary prompt;
- preserving returned transcription text without replacements.

Run the focused tests first, then the full test suite, lint, typecheck,
production build, secret scan, and final diff/status checks.

## Deployment and acceptance

Update the existing draft PR and wait for the Vercel Preview.

Acceptance requires:

1. typed text produces task drafts repeatedly;
2. two consecutive voice notes transcribe and parse without a generic error;
3. a spoken phrase containing “завайбкодити” is transcribed closer to the
   intended Ukrainian technical term;
4. real API failures still remain visible through safe diagnostics;
5. no note, audio, transcript, credential, or raw provider detail appears in
   logs.
