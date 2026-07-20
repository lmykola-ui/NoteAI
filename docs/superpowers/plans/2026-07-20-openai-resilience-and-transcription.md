# OpenAI Resilience and Ukrainian Transcription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make task parsing resilient to recoverable structured-output variation and improve Ukrainian technical-term transcription without changing the capture flow.

**Architecture:** Keep OpenAI's wire response structurally constrained, then normalize semantic details inside the application. Retry one time only for structured-output parsing/normalization failures. Keep the existing transcription model and add an explicit Ukrainian language code plus a bounded domain vocabulary prompt.

**Tech Stack:** TypeScript 5.9, Next.js 16 route handlers, OpenAI Node SDK 6.48, Zod 4, Vitest 4.

## Global Constraints

- Keep the public `502 { code: "AI_UNAVAILABLE" }` contract unchanged.
- Never log note text, audio, transcript, prompts, raw model output, raw error messages, credentials, headers, request bodies, or stacks.
- Do not retry authentication, quota/rate-limit, permission, connection, timeout, or other provider API failures.
- Do not invent task content, dates, times, priorities, or statuses.
- Keep `gpt-4o-mini-transcribe` as the default transcription model.
- Do not post-process the returned transcript with replacement rules.

---

### Task 1: Tolerant task-result normalization and targeted retry

**Files:**
- Modify: `src/server/openai/parseTasks.test.ts`
- Modify: `src/server/openai/parseTasks.ts`
- Test: `src/server/openai/parseTasks.test.ts`

**Interfaces:**
- Consumes: `ParserClient.responses.parse(...): Promise<{ output_parsed: unknown }>`
- Produces: unchanged `parseTasksWithClient(client, request): Promise<ParseResult>`
- Produces internally: `InvalidAIResponseError`, `normalizeAIResult(output): ParseResult`, and `isRetryableStructuredOutputError(error): boolean`

- [ ] **Step 1: Replace strict-failure expectations with normalization expectations**

Update the existing invalid-output cases in `parseTasks.test.ts` so they require:

```ts
it("keeps a task while discarding an impossible optional date and time", async () => {
  const parse = vi.fn().mockResolvedValue({
    output_parsed: {
      tasks: [{
        title: "  Купити молоко  ",
        scheduledDate: "2026-02-29",
        scheduledTime: "24:00",
        status: "active",
        priority: null,
      }],
      clarification: "Коли саме?",
    },
  });
  const client = { responses: { parse } } as unknown as Parameters<
    typeof parseTasksWithClient
  >[0];

  await expect(parseTasksWithClient(client, {
    text: "Купити молоко",
    today: "2026-07-20",
    timeZone: "Europe/Warsaw",
    inputMethod: "text",
  })).resolves.toEqual({
    tasks: [{
      title: "Купити молоко",
      scheduledDate: null,
      scheduledTime: null,
      status: "active",
      priority: null,
      inputMethod: "text",
    }],
    clarification: null,
  });
});
```

Add a bounded-text case that expects a title and clarification to be trimmed and limited to 300 characters, while tasks take precedence over clarification.

- [ ] **Step 2: Add retry-policy tests**

Add these focused cases:

```ts
import { z } from "zod";

it("retries once after an SDK structured-output parse failure", async () => {
  const schemaFailure = (() => {
    try {
      z.string().parse(123);
    } catch (error) {
      return error;
    }
  })();
  const validOutput = {
    tasks: [{
      title: "Купити молоко",
      scheduledDate: null,
      scheduledTime: null,
      status: "active",
      priority: null,
    }],
    clarification: null,
  };
  const parse = vi.fn()
    .mockRejectedValueOnce(schemaFailure)
    .mockResolvedValueOnce({ output_parsed: validOutput });
  const client = { responses: { parse } } as unknown as Parameters<
    typeof parseTasksWithClient
  >[0];

  await expect(parseTasksWithClient(client, {
    text: "Купити молоко",
    today: "2026-07-20",
    timeZone: "Europe/Warsaw",
    inputMethod: "text",
  })).resolves.toMatchObject({
    tasks: [expect.objectContaining({ title: "Купити молоко" })],
    clarification: null,
  });
  expect(parse).toHaveBeenCalledTimes(2);
});

it("does not retry a provider API error", async () => {
  class RateLimitError extends Error {
    status = 429;
    code = "rate_limit_exceeded";
  }
  const providerError = new RateLimitError("provider detail");
  const parse = vi.fn().mockRejectedValue(providerError);
  const client = { responses: { parse } } as unknown as Parameters<
    typeof parseTasksWithClient
  >[0];

  await expect(parseTasksWithClient(client, {
    text: "Купити молоко",
    today: "2026-07-20",
    timeZone: "Europe/Warsaw",
    inputMethod: "text",
  })).rejects.toBe(providerError);
  expect(parse).toHaveBeenCalledOnce();
});

it("fails after two unusable structured responses", async () => {
  const parse = vi.fn().mockResolvedValue({
    output_parsed: { tasks: [], clarification: null },
  });
  const client = { responses: { parse } } as unknown as Parameters<
    typeof parseTasksWithClient
  >[0];

  await expect(parseTasksWithClient(client, {
    text: "Купити молоко",
    today: "2026-07-20",
    timeZone: "Europe/Warsaw",
    inputMethod: "text",
  })).rejects.toThrow("INVALID_AI_RESPONSE");
  expect(parse).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
pnpm test src/server/openai/parseTasks.test.ts
```

Expected: FAIL because the current wire schema rejects malformed optional date/time before normalization, no targeted retry exists, and tasks do not take precedence over a simultaneous clarification.

- [ ] **Step 4: Implement the tolerant wire schema and normalizer**

In `parseTasks.ts`, change the wire schema to:

```ts
const aiWireResultSchema = z.object({
  tasks: z.array(z.object({
    title: z.string(),
    scheduledDate: z.string().nullable(),
    scheduledTime: z.string().nullable(),
    status: z.enum(["active", "completed"]),
    priority: z.enum(["low", "medium", "high"]).nullable(),
  })),
  clarification: z.string().nullable(),
});
```

Add a local error class and normalizer:

```ts
class InvalidAIResponseError extends Error {
  constructor(options?: ErrorOptions) {
    super("INVALID_AI_RESPONSE", options);
    this.name = "InvalidAIResponseError";
  }
}

function normalizeAIResult(
  output: z.infer<typeof aiWireResultSchema>,
  inputMethod: InputMethod,
): ParseResult {
  const tasks = output.tasks
    .map((task) => {
      const title = task.title.trim().slice(0, 300);
      if (!title) return null;

      return {
        title,
        scheduledDate:
          task.scheduledDate && isCalendarDate(task.scheduledDate)
            ? task.scheduledDate
            : null,
        scheduledTime:
          task.scheduledTime && isLocalTime(task.scheduledTime)
            ? task.scheduledTime
            : null,
        status: task.status,
        priority: task.priority,
        inputMethod,
      };
    })
    .filter((task): task is NonNullable<typeof task> => task !== null)
    .slice(0, 50);

  if (tasks.length > 0) {
    return { tasks, clarification: null };
  }

  const clarification = output.clarification?.trim().slice(0, 300) || null;
  if (clarification) {
    return { tasks: [], clarification };
  }

  throw new InvalidAIResponseError();
}
```

Remove the now-redundant strict `aiResultSchema`.

- [ ] **Step 5: Implement exactly one structured-output retry**

Add:

```ts
function isRetryableStructuredOutputError(error: unknown) {
  return (
    error instanceof InvalidAIResponseError ||
    error instanceof z.ZodError ||
    error instanceof SyntaxError
  );
}
```

Wrap only the parse-and-normalize sequence in two attempts:

```ts
for (let attempt = 0; attempt < 2; attempt += 1) {
  try {
    const response = await client.responses.parse(
      {
        model: taskModel,
        input: [
          { role: "system", content: taskSystemPrompt },
          {
            role: "user",
            content:
              `Локальна дата: ${request.today}\n` +
              `Часовий пояс: ${request.timeZone}\n` +
              `Нотатка: ${request.text}`,
          },
        ],
        text: {
          format: zodTextFormat(aiWireResultSchema, "noteai_task_result"),
        },
      },
      { timeout: 15_000, maxRetries: 1 },
    );
    if (!response.output_parsed) throw new InvalidAIResponseError();
    return normalizeAIResult(response.output_parsed, request.inputMethod);
  } catch (error) {
    if (!isRetryableStructuredOutputError(error)) throw error;
    if (attempt === 1) {
      throw error instanceof InvalidAIResponseError
        ? error
        : new InvalidAIResponseError({ cause: error });
    }
  }
}

throw new InvalidAIResponseError();
```

The request shown above preserves the current system prompt, user context,
timeout, and SDK transport-retry options.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
pnpm test src/server/openai/parseTasks.test.ts src/server/openai/errorDiagnostics.test.ts
```

Expected: PASS with the retry, normalization, provider-error, and diagnostic cases all green.

- [ ] **Step 7: Commit Task 1**

```bash
git add src/server/openai/parseTasks.ts src/server/openai/parseTasks.test.ts
git commit -m "fix: make task parsing resilient"
```

---

### Task 2: Ukrainian technical-vocabulary transcription context

**Files:**
- Modify: `src/server/openai/transcribeAudio.test.ts`
- Modify: `src/server/openai/transcribeAudio.ts`
- Test: `src/server/openai/transcribeAudio.test.ts`

**Interfaces:**
- Consumes: `audio.transcriptions.create(request, options)`
- Produces: unchanged `transcribeAudio(file: File): Promise<string>`

- [ ] **Step 1: Write the failing transcription-request test**

Update the existing request assertion to require:

```ts
expect(clientMocks.create).toHaveBeenCalledWith(
  {
    file,
    model: "gpt-4o-mini-transcribe",
    response_format: "text",
    language: "uk",
    prompt: expect.stringMatching(/завайбкодити.*Vercel.*GitHub/s),
  },
  { timeout: 30_000, maxRetries: 1 },
);
```

Keep the existing object/string response tests to prove that returned text is
passed through unchanged.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm test src/server/openai/transcribeAudio.test.ts
```

Expected: FAIL because the current request has no `language` and its prompt has no technical vocabulary.

- [ ] **Step 3: Add the bounded Ukrainian context**

In `transcribeAudio.ts`, add:

```ts
const ukrainianTranscriptionPrompt =
  "Українська особиста нотатка про справи, дати й час. " +
  "Можлива технічна лексика: вайбкодити, завайбкодити, вайбкодинг, " +
  "застосунок, вебзастосунок, OpenAI, ChatGPT, Codex, Claude, Figma, " +
  "Vercel, GitHub, API, UI, UX.";
```

Pass it with the explicit language:

```ts
{
  file,
  model: transcribeModel,
  response_format: "text",
  language: "uk",
  prompt: ukrainianTranscriptionPrompt,
}
```

Do not alter the returned string.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
pnpm test src/server/openai/transcribeAudio.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/server/openai/transcribeAudio.ts src/server/openai/transcribeAudio.test.ts
git commit -m "fix: improve Ukrainian technical transcription"
```

---

### Task 3: Full verification and Preview handoff

**Files:**
- Verify: all files changed against `origin/main`
- Update: existing draft PR branch `fix/openai-error-observability`

**Interfaces:**
- Consumes: Task 1 and Task 2 commits
- Produces: a green Vercel Preview ready for repeated text and voice checks

- [ ] **Step 1: Run all automated tests**

```bash
pnpm test
```

Expected: all Vitest files and tests PASS.

- [ ] **Step 2: Run static verification**

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm scan:secrets
```

Expected: every command exits 0; the production build lists `/`,
`/api/parse-note`, and `/api/transcribe`.

- [ ] **Step 3: Review the final change set**

```bash
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git status --short --branch
```

Expected: no whitespace errors, only scoped parser/transcription/diagnostic docs
and tests, and a clean worktree.

- [ ] **Step 4: Push the same branch**

```bash
git push
```

Expected: the existing PR #2 updates and Vercel creates new Preview deployments
without recreating the project, domain, or environment variables.

- [ ] **Step 5: Verify Preview behavior**

Use the existing Preview URL to check:

1. two consecutive typed notes parse successfully;
2. two consecutive voice notes transcribe and parse successfully;
3. “завайбкодити застосунок у Vercel через GitHub” is transcribed close to the
   intended wording;
4. Vercel logs contain no note, transcript, audio, credential, or raw error
   detail.
