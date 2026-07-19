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
tests, so the E2E suite and the ten-case mocked parser-contract test do not
measure Ukrainian model quality, spend OpenAI quota, or require a real key.

### Required Ukrainian model gate

Before promoting a Preview deployment, run the opt-in, model-backed evaluation:

```bash
node --env-file=.env.local scripts/ukrainianModelEval.mjs
```

This paid command is intentionally excluded from `pnpm test` and the default
local gate. It calls `OPENAI_TASK_MODEL` (default `gpt-5.6-terra`) once for each
of the ten inputs below using the production system prompt and structured-output
shape. It must report `10/10 Ukrainian model cases passed.` before promotion.
Do not treat the mocked parser-contract test or stubbed Playwright API responses
as a substitute.

Keep the key in the gitignored `.env.local` file created during setup. The
`--env-file` form avoids putting the credential value in shell history.

The evaluator requires exact task count/order, dates, times, status, priority,
and null-vs-present clarification. Titles may vary only in grammar while still
containing every listed concept (one listed synonym per slash-separated group).
The ambiguity case must return zero tasks and one trimmed clarification of
5-300 characters.

| # | Exact input (`today=2026-07-19`, `Europe/Warsaw`) | Required result |
|---|---|---|
| 1 | `Молоко купити сьогодні, пошту глянути завтра, а рахунок я вже оплатив` | 3 tasks in order: buy+milk, active `2026-07-19`; check/look+mail, active `2026-07-20`; pay+bill, completed and undated. All times/priorities null; clarification null. |
| 2 | `Подзвони лікарю сьогодні до п’ятої` | 1 call/phone+doctor task, active, `2026-07-19` `17:00`, priority null; clarification null. |
| 3 | `У понеділок о 09:30 перевірити пошту` | 1 check+mail task, active, `2026-07-20` `09:30`, priority null; clarification null. |
| 4 | `Купити лампочку` | 1 buy+lightbulb task, active and undated, time/priority null; clarification null. |
| 5 | `Терміново продовжити домен, високий пріоритет` | 1 renew/extend+domain task, active, high priority, date/time null; clarification null. |
| 6 | `Заплануй зустріч якось потім` | 0 tasks; one 5-300 character clarification question. |
| 7 | `У суботу здати звіт` | 1 submit+report task, active, `2026-07-25`, time/priority null; clarification null. |
| 8 | `Через вісім днів поновити страховку` | 1 renew+insurance task, active, `2026-07-27`, time/priority null; clarification null. |
| 9 | `Я вже забрав посилку` | 1 collect/receive+parcel task, completed and undated, time/priority null; clarification null. |
| 10 | `Наступної середи о пів на десяту зателефонувати Олені` | 1 call/phone+Olena task, active, `2026-07-22` `09:30`, priority null; clarification null. |

Run these same exact inputs through the deployed Preview UI and inspect the
editable Preview results on physical mobile Chrome and Safari. Both devices
must satisfy the table before promotion; record any model failure even when the
local mocked contract and browser tests pass.

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
- An existing IndexedDB user who opens the new version without confirming a new
  Capture receives the offline shell after task hydration.
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

- `/api/parse-note`: 20 requests per minute;
- `/api/transcribe`: 10 requests per minute.

Scope each rule to the exact route and method used by the application. Verify the rules in both Preview (without blocking the release test) and Production. Keep the OpenAI project monthly budget and usage alerts enabled. Application request-size and timeout limits reduce abuse impact but do not replace provider budget controls.
