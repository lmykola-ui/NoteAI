# NoteAI OpenAI Server Contract Design

## Goal

Align the existing mobile-only Ukrainian NoteAI MVP with one explicit OpenAI configuration and HTTP boundary. A user writes or dictates a thought, the browser sends only the note content and local date context to the NoteAI backend, and the backend returns validated structured task drafts.

## Configuration Contract

- Local development uses an ignored `.env` or `.env.local` file.
- `OPENAI_API_KEY` is read only inside a module marked `server-only` through `process.env.OPENAI_API_KEY`.
- The task-analysis model is read from `process.env.OPENAI_MODEL`.
- If `OPENAI_MODEL` is absent, the task-analysis fallback is `gpt-5-nano`.
- Voice transcription keeps its separate `OPENAI_TRANSCRIBE_MODEL` setting because it uses the audio transcription endpoint rather than the task-analysis model.
- No variable containing an OpenAI key may use the `NEXT_PUBLIC_` prefix.
- `.env` and `.env.local` remain ignored. Only `.env.example` is committed, with empty secret placeholders:

  ```dotenv
  OPENAI_API_KEY=
  OPENAI_MODEL=gpt-5-nano
  OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
  ```

Vercel Preview and Production each require their own environment-variable configuration. Local env files are not uploaded automatically.

## Server Architecture

`src/server/openai/client.ts` remains the only OpenAI client factory. It is server-only and constructs the SDK client lazily so importing route modules never reads credentials or throws during build-time rendering.

`src/server/openai/parseTasks.ts` remains the task-analysis service. It receives text plus local date and timezone context, invokes the model selected by `OPENAI_MODEL`, uses Structured Outputs, validates semantic dates/times and the exclusive tasks-or-clarification outcome, and returns the existing `ParseResult` domain type.

Voice transcription remains a separate server service and continues to use the shared server-only client factory. Raw audio is bounded, validated, transcribed, and discarded; it is never stored in browser persistence or analytics.

## HTTP Contract

The canonical analysis endpoint is `POST /api/parse-note`. It fully replaces `/api/parse`; no compatibility alias is retained because the current browser client is the only consumer.

Request:

```json
{
  "text": "Купити молоко сьогодні",
  "today": "2026-07-19",
  "timeZone": "Europe/Warsaw",
  "inputMethod": "text"
}
```

Successful response:

```json
{
  "tasks": [
    {
      "title": "Купити молоко",
      "scheduledDate": "2026-07-19",
      "scheduledTime": null,
      "status": "active",
      "priority": null,
      "inputMethod": "text"
    }
  ],
  "clarification": null
}
```

The route returns the existing stable error contract:

- `400 INVALID_REQUEST` for malformed or semantically invalid input;
- `502 AI_UNAVAILABLE` when configuration or the provider is unavailable.

Provider error bodies and credentials are never forwarded to the browser.

## Browser Boundary

The browser calls only the internal `/api/parse-note` endpoint. It never imports the OpenAI SDK, the server client, or environment variables. Both typed and voice-transcribed notes use the same internal endpoint and the same editable Preview-before-save flow.

The request keeps `inputMethod` so an edited voice transcript remains identifiable as voice input. Confirmed tasks are persisted only in IndexedDB after the user approves Preview.

## Migration

The change is intentionally breaking only inside the repository:

1. Rename the Next.js route directory from `api/parse` to `api/parse-note`.
2. Update the browser parse client and every route/E2E/service-worker/firewall reference.
3. Replace `OPENAI_TASK_MODEL` reads and documentation with `OPENAI_MODEL` and the `gpt-5-nano` fallback.
4. Update `.env.example` without touching or staging any local `.env` file.
5. Preserve `OPENAI_TRANSCRIBE_MODEL` for speech-to-text.

## Error Handling and Privacy

- Missing credentials fail inside the caught server service path and produce `502 AI_UNAVAILABLE`.
- Invalid model output fails closed and is never persisted automatically.
- Ambiguous input returns one meaningful clarification instead of invented task fields.
- Notes, transcripts, titles, dates, identifiers, audio, provider responses, and keys are excluded from analytics.
- Secret scanning must continue to pass and must redact matching source lines.

## Verification

The implementation must prove:

- the client calls `/api/parse-note` and no production reference to `/api/parse` remains;
- `OPENAI_MODEL` selects the configured task model and falls back to `gpt-5-nano`;
- the key is accessed only from server-only code;
- malformed input and provider/configuration failures preserve the existing HTTP statuses;
- text and voice flows still reach editable Preview and confirmed tasks remain locally persistent;
- unit, API, component, mobile Playwright, lint, typecheck, build, and secret-scan gates pass;
- `.env` and `.env.local` remain ignored and untracked.

## Non-Goals

- Direct browser-to-OpenAI requests.
- A second task parser for voice.
- Multiple AI providers or a provider plugin layer.
- Accounts, cloud synchronization, projects, tags, calendar integration, or automatic scheduling.
