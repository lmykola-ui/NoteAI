# NoteAI

Mobile-only Ukrainian AI notepad for turning free-form text or voice into an editable task preview. Confirmed tasks are stored locally in IndexedDB; the MVP has no account, cloud backup, or cross-device sync.

## Local setup

Prerequisites: Node.js 20.19 or newer and pnpm 11.9 or newer. The application itself supports Next.js's lower Node 20 baseline, but the checked-in test toolchain includes packages that require Node 20.19.

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

3. Replace `OPENAI_API_KEY` in `.env.local` with an OpenAI project key. It is server-only: never prefix it with `NEXT_PUBLIC_`, commit it, paste it into browser code, or expose it in analytics.
4. Keep `OPENAI_TASK_MODEL=gpt-5.6-terra` and `OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe` unless a deliberate migration has been verified against the [current OpenAI model catalog](https://developers.openai.com/api/docs/models) and [transcription model documentation](https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe).
5. Start the app and open it in a mobile viewport:

   ```bash
   pnpm dev
   ```

   Local URL: `http://localhost:3000`.

`NEXT_PUBLIC_ENABLE_ANALYTICS` defaults to `false`. Set it to `true` only when content-free custom events are intentionally enabled.

## Verification

Install the two Playwright browser engines once on a development or CI machine:

```bash
pnpm test:e2e:install
```

Run the complete local release gate:

```bash
pnpm test
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm build
pnpm scan:secrets
git diff --check
```

`pnpm scan:secrets` is the repeatable release gate for both `OPENAI_API_KEY`
references and literal OpenAI-style `sk-...` / `sk-proj-...` credentials. It
scans tracked and non-ignored untracked repository files, prints every key-name
reference for review, and fails when a literal credential pattern is found.

`pnpm test:e2e` builds and starts the production Next.js server automatically,
then runs the acceptance suite in both `mobile-chrome` (Pixel 7) and
`mobile-safari` (iPhone 14) projects. The deploy-like server is required for a
stable offline-shell reload because the development server's hot-reload client
intentionally reconnects to the network. API parsing is stubbed in browser
tests, so the E2E suite does not spend OpenAI quota or require a real key.

## Vercel release runbook

No deployment command is required from a local machine. In the Vercel project connected to this repository:

1. Keep the detected framework as Next.js, install command as `pnpm install`, and build command as `pnpm build`.
2. Add these variables separately to both **Preview** and **Production** environments:
   - `OPENAI_API_KEY` — server-only project key;
   - `OPENAI_TASK_MODEL` — `gpt-5.6-terra`;
   - `OPENAI_TRANSCRIBE_MODEL` — `gpt-4o-mini-transcribe`;
   - `NEXT_PUBLIC_ENABLE_ANALYTICS` — `false` by default; use `true` only for the privacy-bounded custom events described below.
3. Trigger a new deployment after changing environment variables. A previous deployment does not receive newly added or changed build-time public variables.
4. Run the automated release gate before pushing. Then verify the generated Preview deployment on current mobile Safari and mobile Chrome before promoting or merging.

### Required mobile preview handoff

These checks require a deployed Preview URL and physical devices; they are not satisfied by the local Playwright emulation:

- Capture opens first and the bottom navigation contains exactly Capture, Inbox, and План.
- Text produces an editable preview and confirmed tasks route to Inbox or one of seven Plan dates.
- Microphone permission grant, denial, retry, and transcription failure are understandable.
- Confirmed tasks survive browser close and reopen in the same browser profile.
- Overdue and later-future tasks remain visible in Inbox.
- Existing local tasks remain usable offline.
- No raw note, transcript, task title, date, audio, or API key appears in analytics or browser network logs.

Do not promote the release until both physical-device checks pass.

## Privacy and analytics

- Notes and transcripts are sent to the server only for the requested AI action. OpenAI credentials remain on the server.
- Raw recording bytes are not persisted and are discarded after transcription.
- Vercel Analytics is opt-in. When enabled, automatic page-view tracking remains disabled and only the allowlisted content-free events `capture_confirmed`, `parse_failed`, and `transcription_failed` are sent.
- Never add note text, transcripts, task titles, dates, identifiers, error payloads, audio, URLs containing user content, or secrets to analytics events or logs.

## Local storage limitation

IndexedDB is the MVP source of truth. Tasks are available only on the same domain, device, browser, and browser profile. Clearing site data, ending a private-browsing session, switching browsers or profiles, browser/OS storage eviction, device loss, or device reset can remove access to them. The MVP has no cloud backup.

## Rate limits and cost controls

Before a public release, configure Vercel Firewall per-IP rate limits:

- `/api/parse`: 20 requests per minute;
- `/api/transcribe`: 10 requests per minute.

Scope each rule to the exact route and method used by the application. Verify the rules in both Preview (without blocking the release test) and Production. Keep the OpenAI project monthly budget and usage alerts enabled. Application request-size and timeout limits reduce abuse impact but do not replace provider budget controls.
