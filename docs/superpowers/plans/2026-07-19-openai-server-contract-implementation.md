# OpenAI Server Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the internal task-analysis configuration and route with `OPENAI_MODEL` (fallback `gpt-5-nano`) and `POST /api/parse-note`, then publish a verified feature branch for Vercel Preview testing.

**Architecture:** Keep the existing lazy `server-only` OpenAI client and structured parsing service. Rename only the internal HTTP boundary, update all browser and offline-cache consumers, and keep transcription on its separate model variable. Local ignored environment files are never read into logs, staged, copied, or committed.

**Tech Stack:** Next.js 16 App Router, TypeScript, OpenAI Node SDK, Zod Structured Outputs, Vitest, Testing Library, Playwright, pnpm, Vercel.

## Global Constraints

- `OPENAI_API_KEY` is read only in server-only code through `process.env.OPENAI_API_KEY`.
- Task model comes from `process.env.OPENAI_MODEL ?? "gpt-5-nano"`.
- Canonical task-analysis route is `POST /api/parse-note`; `/api/parse` is removed.
- Browser code calls only the internal NoteAI route and never imports the OpenAI SDK.
- Voice continues to use `OPENAI_TRANSCRIBE_MODEL` and the existing editable-transcript flow.
- `.env` and `.env.local` stay ignored and untracked; only `.env.example` is committed.
- Never print, copy, inspect, or request the API-key value.
- Preserve Ukrainian-first UI, Preview-before-save, same-browser IndexedDB persistence, Inbox routing, and the rolling seven-day Plan.

---

### Task 1: Align the Server Model Configuration

**Files:**
- Modify: `src/server/openai/client.ts`
- Create: `src/server/openai/client.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `process.env.OPENAI_API_KEY`, `process.env.OPENAI_MODEL`, `process.env.OPENAI_TRANSCRIBE_MODEL`.
- Produces: `createOpenAIClient()`, `taskModel`, and `transcribeModel` with unchanged import signatures.

- [ ] **Step 1: Write failing configuration tests**

Add isolated-module tests that assert:

```ts
it("uses OPENAI_MODEL for task analysis", async () => {
  vi.stubEnv("OPENAI_MODEL", "configured-task-model");
  const { taskModel } = await import("./client");
  expect(taskModel).toBe("configured-task-model");
});

it("falls back to gpt-5-nano", async () => {
  vi.stubEnv("OPENAI_MODEL", "");
  const { taskModel } = await import("./client");
  expect(taskModel).toBe("gpt-5-nano");
});
```

Also verify importing the module without a key remains lazy and does not instantiate the SDK.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `pnpm exec vitest run src/server/openai/client.test.ts`

Expected: failure because the implementation still reads `OPENAI_TASK_MODEL` and falls back to `gpt-5.6-terra`.

- [ ] **Step 3: Implement the configuration contract**

Use:

```ts
export const taskModel = process.env.OPENAI_MODEL || "gpt-5-nano";
```

Keep `createOpenAIClient()` lazy, server-only, and unchanged for the API key. Update `.env.example` to:

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-nano
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

- [ ] **Step 4: Verify and commit**

Run:

```bash
pnpm exec vitest run src/server/openai/client.test.ts src/server/openai/parseTasks.test.ts src/server/openai/transcribeAudio.test.ts
pnpm typecheck
git diff --check
```

Commit: `fix: align OpenAI model environment contract`

---

### Task 2: Replace the Internal Parse Route

**Files:**
- Create: `src/app/api/parse-note/route.ts`
- Create: `src/app/api/parse-note/route.test.ts`
- Delete: `src/app/api/parse/route.ts`
- Delete: `src/app/api/parse/route.test.ts`
- Modify: `src/features/capture/application/parseClient.ts`
- Modify: `src/features/capture/application/parseClient.test.ts`
- Modify: `src/components/app-shell/noteaiServiceWorker.test.ts`
- Modify: `tests/e2e/noteai-core.spec.ts`

**Interfaces:**
- Consumes: the existing `parseTasks(ParseRequest): Promise<ParseResult>` service.
- Produces: `POST /api/parse-note` with the existing `400 INVALID_REQUEST`, `502 AI_UNAVAILABLE`, and successful `ParseResult` responses.

- [ ] **Step 1: Move route tests to the canonical URL and update the client test**

Every route request must use:

```ts
new Request("http://localhost/api/parse-note", { method: "POST", ... })
```

The browser client test must assert:

```ts
expect(fetch).toHaveBeenCalledWith(
  "/api/parse-note",
  expect.objectContaining({ method: "POST" }),
);
```

Update browser route stubs and service-worker API exclusions to `/api/parse-note`.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```bash
pnpm exec vitest run src/app/api/parse-note/route.test.ts src/features/capture/application/parseClient.test.ts src/components/app-shell/noteaiServiceWorker.test.ts
```

Expected: failures because the route and browser URL have not yet moved.

- [ ] **Step 3: Move the route and browser client**

Move the existing route implementation without weakening validation or error mapping. Change the browser fetch boundary to:

```ts
fetch("/api/parse-note", requestOptions)
```

Remove the old `/api/parse` route completely. Do not introduce an alias.

- [ ] **Step 4: Prove the old production boundary is gone**

Run:

```bash
rg -n '"/api/parse"|/api/parse\b' src tests public README.md .env.example
```

Expected: no old route references. `/api/parse-note` references are allowed.

- [ ] **Step 5: Verify and commit**

Run focused tests, the full unit suite, lint, typecheck, and build.

Commit: `refactor: rename note parsing API route`

---

### Task 3: Update Release Documentation and Publish the Preview Branch

**Files:**
- Modify: `README.md`
- Modify: `scripts/ukrainianModelEval.mjs`
- Modify: `scripts/ukrainianModelEval.test.ts`
- Modify: any route allowlist or release script still referencing the old contract.

**Interfaces:**
- Consumes: the completed `OPENAI_MODEL` and `/api/parse-note` contracts.
- Produces: an accurate local/Vercel runbook and a pushed `feat/noteai-mobile-mvp` branch.

- [ ] **Step 1: Write failing documentation/evaluator assertions**

Update evaluator tests to assert the configured model comes from `OPENAI_MODEL` and falls back to `gpt-5-nano`. Add a repository-contract test or focused grep gate that fails on active `OPENAI_TASK_MODEL` or `/api/parse` references outside historical design/plan documents.

- [ ] **Step 2: Update documentation and release settings**

README must instruct Vercel Preview and Production to define:

```text
OPENAI_API_KEY
OPENAI_MODEL=gpt-5-nano
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

Update the firewall route from `/api/parse` to `/api/parse-note`. Keep the live paid evaluation opt-in and load local credentials through the ignored `.env` file without placing a key in shell history.

- [ ] **Step 3: Run the complete local release gate**

Run:

```bash
pnpm test
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm build
pnpm scan:secrets
git diff --check
git status --short
```

Expected: 0 failures, no literal secret, and neither `.env` nor `.env.local` appears in status.

- [ ] **Step 4: Push the feature branch**

Push only the committed `feat/noteai-mobile-mvp` branch:

```bash
git push -u origin feat/noteai-mobile-mvp
```

Do not push or modify `main`.

- [ ] **Step 5: Verify Vercel Preview**

Confirm the GitHub-connected Vercel project creates a Preview deployment for the pushed branch. Verify build status and obtain the Preview URL. If the Preview lacks server variables, configure the same variable names separately in Vercel without printing the key, trigger a redeploy, and verify `/api/parse-note` through the mobile UI.

Physical-device and paid-model checks remain explicit release gates; do not claim them unless actually performed.
