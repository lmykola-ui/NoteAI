# OpenAI Cost Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each NoteAI parse or transcription cost observable, remove the second application-level paid parse attempt, and cap GPT-5 Nano reasoning/output without changing public API behavior.

**Architecture:** Add one server-only pure normalizer that converts allowlisted token or duration counters into a privacy-safe usage event and an integer micro-dollar estimate. Emit that event at the two OpenAI provider boundaries, keep one SDK-level transient retry, and remove only the manual structured-output retry loop. The browser contracts and existing sanitized failure diagnostics remain unchanged.

**Tech Stack:** Next.js 16 App Router, TypeScript 5.9, OpenAI JavaScript SDK 6.48, Zod 4, Vitest 4, pnpm 11.

## Global Constraints

- Keep `OPENAI_MODEL=gpt-5-nano` and `OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe` as defaults.
- Use `reasoning: { effort: "minimal" }` and `max_output_tokens: 1200` for task extraction.
- Keep Structured Outputs and all existing server-side task normalization.
- Keep `{ timeout: 15_000, maxRetries: 1 }` for parsing and `{ timeout: 30_000, maxRetries: 1 }` for transcription.
- Never automatically repeat a parse after local Zod, JSON, empty-output, length, content-filter, or other structured-output failure.
- Never log note text, transcript text, prompts, tasks, audio bytes, API keys, authorization data, raw errors, stacks, or raw provider response objects.
- Preserve public `AI_UNAVAILABLE` and `TRANSCRIPTION_UNAVAILABLE` responses.
- Preserve the server-verified 60-second, 10 MB audio bounds and the 10,000-character parse bound.
- Pricing estimates use the documented 2026-07-20 standard rates and return `null` for unknown model IDs.
- Estimation or logging failure must never fail a successful user request.
- Do not add accounts, shared storage, a billing UI, prompt caching, or a serverless in-memory daily counter.
- Before modifying voice files, re-run `git status --short` and inspect their current content because transcription work may have changed in parallel.

---

## Planned File Map

```text
src/server/openai/
  usageDiagnostics.ts       Pure allowlisted normalization, cost estimation, safe emission
  usageDiagnostics.test.ts  Exact pricing, unknown-model, and privacy regression tests
  parseTasks.ts             Single NoteAI attempt, minimal reasoning, output cap, parse usage event
  parseTasks.test.ts        Request controls and no-paid-retry regressions
  transcribeAudio.ts        Duration-aware transcription usage event
  transcribeAudio.test.ts   Transcription policy and safe telemetry regressions
src/app/api/transcribe/
  route.ts                  Pass the already verified server duration to provider boundary
  route.test.ts             Prove client duration is ignored and verified duration is forwarded
```

No client response type, UI component, database, environment-variable name, or route path changes.

---

### Task 1: Add Privacy-Safe Usage and Cost Normalization

**Files:**
- Create: `src/server/openai/usageDiagnostics.ts`
- Create: `src/server/openai/usageDiagnostics.test.ts`

**Interfaces:**
- Consumes: `OpenAIUsageInput` containing operation, configured model, optional provider usage, and optional server-verified duration.
- Produces: `toOpenAIUsageDiagnostic(input: OpenAIUsageInput): OpenAIUsageDiagnostic`.
- Produces: `emitOpenAIUsage(diagnostic: OpenAIUsageDiagnostic): void`.
- Later tasks depend on the exact `operation: "parse" | "transcribe"`,
  `outcome: "provider_response"`, allowlisted `requestId`, and
  `pricingSnapshot: "2026-07-20"` contract.

- [ ] **Step 1: Write the failing pure-normalizer tests**

Create `src/server/openai/usageDiagnostics.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  emitOpenAIUsage,
  toOpenAIUsageDiagnostic,
} from "./usageDiagnostics";

vi.mock("server-only", () => ({}));

describe("toOpenAIUsageDiagnostic", () => {
  it("estimates gpt-5-nano from uncached, cached, and output tokens", () => {
    expect(
      toOpenAIUsageDiagnostic({
        operation: "parse",
        model: "gpt-5-nano",
        requestId: "req_parse_123",
        usage: {
          input_tokens: 1_000,
          input_tokens_details: { cached_tokens: 100 },
          output_tokens: 200,
          output_tokens_details: { reasoning_tokens: 40 },
          total_tokens: 1_200,
        },
      }),
    ).toEqual({
      event: "openai_usage",
      operation: "parse",
      outcome: "provider_response",
      model: "gpt-5-nano",
      requestId: "req_parse_123",
      inputTokens: 1_000,
      cachedInputTokens: 100,
      outputTokens: 200,
      reasoningTokens: 40,
      totalTokens: 1_200,
      audioDurationSeconds: null,
      estimatedCostUsdMicros: 126,
      pricingSnapshot: "2026-07-20",
      retryPolicy: "sdk_max_1",
    });
  });

  it("estimates one minute of mini transcription at three thousand micro-dollars", () => {
    expect(
      toOpenAIUsageDiagnostic({
        operation: "transcribe",
        model: "gpt-4o-mini-transcribe",
        audioDurationSeconds: 60,
      }),
    ).toMatchObject({
      operation: "transcribe",
      audioDurationSeconds: 60,
      estimatedCostUsdMicros: 3_000,
    });
  });

  it("does not estimate an unknown model", () => {
    expect(
      toOpenAIUsageDiagnostic({
        operation: "parse",
        model: "configured-future-model",
        requestId: "unsafe request id with spaces",
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          total_tokens: 15,
        },
      }),
    ).toMatchObject({
      model: "configured-future-model",
      requestId: null,
      inputTokens: 10,
      outputTokens: 5,
      estimatedCostUsdMicros: null,
    });
  });

  it("copies only bounded numeric counters and a safe model ID", () => {
    const diagnostic = toOpenAIUsageDiagnostic({
      operation: "parse",
      model: "gpt-5-nano\nBearer sk-private",
      usage: {
        input_tokens: 12,
        input_tokens_details: {
          cached_tokens: 2,
          note: "Купити молоко",
        },
        output_tokens: 4,
        output_tokens_details: {
          reasoning_tokens: 1,
          transcript: "секретний текст",
        },
        total_tokens: 16,
        prompt: "private prompt",
        response: { tasks: ["private task"] },
      },
    });

    expect(diagnostic.model).toBe("unknown");
    const serialized = JSON.stringify(diagnostic);
    expect(serialized).not.toContain("Купити молоко");
    expect(serialized).not.toContain("секретний текст");
    expect(serialized).not.toContain("private prompt");
    expect(serialized).not.toContain("private task");
    expect(serialized).not.toContain("sk-private");
  });
});

describe("emitOpenAIUsage", () => {
  it("swallows logger failures", () => {
    const consoleInfo = vi
      .spyOn(console, "info")
      .mockImplementation(() => {
        throw new Error("logger unavailable");
      });
    const diagnostic = toOpenAIUsageDiagnostic({
      operation: "transcribe",
      model: "gpt-4o-mini-transcribe",
      audioDurationSeconds: 1,
    });

    expect(() => emitOpenAIUsage(diagnostic)).not.toThrow();
    expect(consoleInfo).toHaveBeenCalledWith(diagnostic);
    consoleInfo.mockRestore();
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
pnpm test -- src/server/openai/usageDiagnostics.test.ts
```

Expected: FAIL because `./usageDiagnostics` does not exist.

- [ ] **Step 3: Implement the strict normalizer and emitter**

Create `src/server/openai/usageDiagnostics.ts`:

```ts
import "server-only";

export type OpenAIOperation = "parse" | "transcribe";

export type OpenAIUsageInput = {
  operation: OpenAIOperation;
  model: string;
  requestId?: unknown;
  usage?: unknown;
  audioDurationSeconds?: number;
};

export type OpenAIUsageDiagnostic = {
  event: "openai_usage";
  operation: OpenAIOperation;
  outcome: "provider_response";
  model: string;
  requestId: string | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  audioDurationSeconds: number | null;
  estimatedCostUsdMicros: number | null;
  pricingSnapshot: "2026-07-20";
  retryPolicy: "sdk_max_1";
};

const safeModelPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function safeRead(record: Record<string, unknown> | null, key: string) {
  try {
    return record ? Reflect.get(record, key) : undefined;
  } catch {
    return undefined;
  }
}

function tokenCount(value: unknown) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

function safeDuration(value: unknown) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 60
    ? value
    : null;
}

function safeRequestId(value: unknown) {
  return typeof value === "string" &&
    value.length <= 200 &&
    /^[A-Za-z0-9._-]+$/.test(value)
    ? value
    : null;
}

function estimateParseCost(
  model: string,
  inputTokens: number | null,
  cachedInputTokens: number | null,
  outputTokens: number | null,
) {
  if (model !== "gpt-5-nano" || inputTokens === null || outputTokens === null) {
    return null;
  }

  const cached = Math.min(cachedInputTokens ?? 0, inputTokens);
  const uncached = inputTokens - cached;
  return Math.round(
    (uncached * 50 + cached * 5 + outputTokens * 400) / 1_000,
  );
}

function estimateTranscriptionCost(
  model: string,
  durationSeconds: number | null,
) {
  if (model !== "gpt-4o-mini-transcribe" || durationSeconds === null) {
    return null;
  }
  return Math.round(durationSeconds * 50);
}

export function toOpenAIUsageDiagnostic(
  input: OpenAIUsageInput,
): OpenAIUsageDiagnostic {
  const usage = asRecord(input.usage);
  const inputDetails = asRecord(safeRead(usage, "input_tokens_details"));
  const outputDetails = asRecord(safeRead(usage, "output_tokens_details"));
  const model = safeModelPattern.test(input.model) ? input.model : "unknown";
  const inputTokens = tokenCount(safeRead(usage, "input_tokens"));
  const cachedInputTokens = tokenCount(
    safeRead(inputDetails, "cached_tokens"),
  );
  const outputTokens = tokenCount(safeRead(usage, "output_tokens"));
  const reasoningTokens = tokenCount(
    safeRead(outputDetails, "reasoning_tokens"),
  );
  const totalTokens = tokenCount(safeRead(usage, "total_tokens"));
  const audioDurationSeconds = safeDuration(input.audioDurationSeconds);

  return {
    event: "openai_usage",
    operation: input.operation,
    outcome: "provider_response",
    model,
    requestId: safeRequestId(input.requestId),
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
    audioDurationSeconds,
    estimatedCostUsdMicros:
      input.operation === "parse"
        ? estimateParseCost(
            model,
            inputTokens,
            cachedInputTokens,
            outputTokens,
          )
        : estimateTranscriptionCost(model, audioDurationSeconds),
    pricingSnapshot: "2026-07-20",
    retryPolicy: "sdk_max_1",
  };
}

export function emitOpenAIUsage(diagnostic: OpenAIUsageDiagnostic) {
  try {
    console.info(diagnostic);
  } catch {
    // Observability must not change the user-visible API result.
  }
}
```

- [ ] **Step 4: Run targeted tests and typecheck**

Run:

```bash
pnpm test -- src/server/openai/usageDiagnostics.test.ts
pnpm typecheck
```

Expected: the new tests pass and TypeScript exits with code 0.

- [ ] **Step 5: Commit the isolated telemetry primitive**

```bash
git add src/server/openai/usageDiagnostics.ts src/server/openai/usageDiagnostics.test.ts
git commit -m "feat: add safe OpenAI usage diagnostics"
```

---

### Task 2: Bound Task Analysis and Remove Paid Structured-Output Retry

**Files:**
- Modify: `src/server/openai/parseTasks.ts`
- Modify: `src/server/openai/parseTasks.test.ts`
- Test: `src/app/api/parse-note/route.test.ts`

**Interfaces:**
- Consumes: `toOpenAIUsageDiagnostic` and `emitOpenAIUsage` from Task 1.
- Produces: unchanged `parseTasksWithClient(client, request): Promise<ParseResult>` and `parseTasksWithOpenAI(request): Promise<ParseResult>`.
- Produces: exactly one NoteAI-level `responses.parse` call per invocation, with SDK `maxRetries: 1` retained.

- [ ] **Step 1: Change retry and request-control tests to the desired behavior**

In `src/server/openai/parseTasks.test.ts`, change the mocked model and extend the first contract assertion:

```diff
 vi.mock("./client", () => ({
   createOpenAIClient: vi.fn(),
-  taskModel: "gpt-5.6-terra",
+  taskModel: "gpt-5-nano",
 }));
```

Immediately after the existing `expect(request.input).toEqual(...)` assertion, add:

```ts
expect(request).toMatchObject({
  model: "gpt-5-nano",
  max_output_tokens: 1_200,
  reasoning: { effort: "minimal" },
});
expect(parse.mock.calls[0]?.[1]).toEqual({
  timeout: 15_000,
  maxRetries: 1,
});
```

Change every malformed-result expectation from two NoteAI calls to one:

```diff
-expect(parse).toHaveBeenCalledTimes(2);
+expect(parse).toHaveBeenCalledOnce();
```

Apply that exact replacement in these tests:

- `fails closed when no parsed payload is returned`;
- `fails closed after two attempts for %s` and rename it to `fails closed without retrying for %s`;
- `discards blank tasks and fails after two attempts` and rename it to `discards blank tasks without retrying`;
- `fails after two unusable structured responses` and rename it to `fails after one unusable structured response`.

Replace the three tests that currently recover on a second local parse attempt with this table-driven regression:

```ts
it.each([
  ["Zod", class ZodError extends Error {}],
  ["OpenAI parser", class OpenAIError extends Error {}],
  ["length finish", class LengthFinishReasonError extends Error {}],
])("does not buy a second analysis after a local %s error", async (_case, ErrorType) => {
  const failure = new ErrorType("private model output");
  const parse = vi.fn().mockRejectedValue(failure);
  const client = {
    responses: { parse },
  } as unknown as Parameters<typeof parseTasksWithClient>[0];

  await expect(
    parseTasksWithClient(client, {
      text: "Купити молоко",
      today: "2026-07-19",
      timeZone: "Europe/Warsaw",
      inputMethod: "text",
    }),
  ).rejects.toBe(failure);
  expect(parse).toHaveBeenCalledOnce();
});
```

Delete the now-unused test-only `z` import:

```diff
-import { z } from "zod";
```

- [ ] **Step 2: Run the parser tests and verify RED**

Run:

```bash
pnpm test -- src/server/openai/parseTasks.test.ts
```

Expected: FAIL because the implementation still retries local structured-output failures and does not send minimal reasoning or the 1,200-token cap.

- [ ] **Step 3: Add a failing safe-usage emission assertion**

Add a hoisted usage mock before the module mocks in `src/server/openai/parseTasks.test.ts`:

```ts
const usageMocks = vi.hoisted(() => ({
  emit: vi.fn(),
}));

vi.mock("./usageDiagnostics", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("./usageDiagnostics")
  >();
  return { ...original, emitOpenAIUsage: usageMocks.emit };
});
```

Add this focused test:

```ts
it("emits only normalized usage for a provider response", async () => {
  usageMocks.emit.mockReset();
  const parse = vi.fn().mockResolvedValue({
    _request_id: "req_parse_123",
    usage: {
      input_tokens: 100,
      input_tokens_details: { cached_tokens: 10 },
      output_tokens: 20,
      output_tokens_details: { reasoning_tokens: 5 },
      total_tokens: 120,
      privateNote: "Купити молоко",
    },
    output_parsed: {
      tasks: [{
        title: "Купити молоко",
        scheduledDate: null,
        scheduledTime: null,
        status: "active",
        priority: null,
      }],
      clarification: null,
    },
  });
  const client = {
    responses: { parse },
  } as unknown as Parameters<typeof parseTasksWithClient>[0];

  await parseTasksWithClient(client, {
    text: "Купити молоко",
    today: "2026-07-19",
    timeZone: "Europe/Warsaw",
    inputMethod: "text",
  });

  expect(usageMocks.emit).toHaveBeenCalledWith({
    event: "openai_usage",
    operation: "parse",
    outcome: "provider_response",
    model: "gpt-5-nano",
    requestId: "req_parse_123",
    inputTokens: 100,
    cachedInputTokens: 10,
    outputTokens: 20,
    reasoningTokens: 5,
    totalTokens: 120,
    audioDurationSeconds: null,
    estimatedCostUsdMicros: 13,
    pricingSnapshot: "2026-07-20",
    retryPolicy: "sdk_max_1",
  });
  expect(JSON.stringify(usageMocks.emit.mock.calls)).not.toContain("Купити молоко");
});
```

- [ ] **Step 4: Run the focused assertion and verify RED**

Run:

```bash
pnpm test -- src/server/openai/parseTasks.test.ts -t "emits only normalized usage"
```

Expected: FAIL because `parseTasksWithClient` does not emit usage.

- [ ] **Step 5: Implement one NoteAI attempt, request caps, and usage emission**

Add imports in `src/server/openai/parseTasks.ts`:

```ts
import {
  emitOpenAIUsage,
  toOpenAIUsageDiagnostic,
} from "./usageDiagnostics";
```

Delete the entire `isRetryableStructuredOutputError` function. Replace the body of `parseTasksWithClient` with:

```ts
export async function parseTasksWithClient(
  client: ParserClient,
  request: ParseRequest,
): Promise<ParseResult> {
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
      reasoning: { effort: "minimal" },
      max_output_tokens: 1_200,
      text: {
        format: zodTextFormat(aiWireResultSchema, "noteai_task_result"),
      },
    },
    { timeout: 15_000, maxRetries: 1 },
  );

  emitOpenAIUsage(
    toOpenAIUsageDiagnostic({
      operation: "parse",
      model: taskModel,
      requestId: response._request_id,
      usage: response.usage,
    }),
  );

  if (!response.output_parsed) {
    throw new InvalidAIResponseError();
  }

  return normalizeAIResult(response.output_parsed, request.inputMethod);
}
```

Do not change `normalizeAIResult`, `parseTaskRequestSchema`, `InvalidAIResponseError`, or `parseTasksWithOpenAI`.

- [ ] **Step 6: Run parser and route tests, then typecheck**

Run:

```bash
pnpm test -- src/server/openai/usageDiagnostics.test.ts src/server/openai/parseTasks.test.ts src/app/api/parse-note/route.test.ts
pnpm typecheck
```

Expected: all targeted tests pass, route responses remain unchanged, and TypeScript exits with code 0.

- [ ] **Step 7: Commit the parse optimization**

```bash
git add src/server/openai/parseTasks.ts src/server/openai/parseTasks.test.ts
git commit -m "perf: bound OpenAI task analysis cost"
```

---

### Task 3: Emit Duration-Based Transcription Cost and Verify the Release

**Files:**
- Modify: `src/server/openai/transcribeAudio.ts`
- Modify: `src/server/openai/transcribeAudio.test.ts`
- Modify: `src/app/api/transcribe/route.ts`
- Modify: `src/app/api/transcribe/route.test.ts`

**Interfaces:**
- Consumes: `toOpenAIUsageDiagnostic` and `emitOpenAIUsage` from Task 1.
- Produces: `transcribeAudio(file: File, audioDurationSeconds: number): Promise<string>`.
- The browser-facing `/api/transcribe` response remains `{ text: string }`.

- [ ] **Step 1: Re-check the parallel voice work before editing**

Run:

```bash
git status --short
git diff -- src/server/openai/transcribeAudio.ts src/server/openai/transcribeAudio.test.ts src/app/api/transcribe/route.ts src/app/api/transcribe/route.test.ts
```

Expected: either no overlapping uncommitted changes, or stop and reconcile the newer voice implementation before applying the remaining steps. Never overwrite parallel work.

- [ ] **Step 2: Write failing provider-boundary telemetry tests**

Add to the hoisted mocks in `src/server/openai/transcribeAudio.test.ts`:

```diff
 const clientMocks = vi.hoisted(() => ({
   create: vi.fn(),
   createClient: vi.fn(),
+  emitUsage: vi.fn(),
 }));
```

Mock only the emitter while preserving the real normalizer:

```ts
vi.mock("./usageDiagnostics", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("./usageDiagnostics")
  >();
  return { ...original, emitOpenAIUsage: clientMocks.emitUsage };
});
```

Reset `clientMocks.emitUsage` in `beforeEach`, pass `1` as the second argument in the existing tests, and add:

```ts
it("emits a duration-based cost event without transcript content", async () => {
  clientMocks.create.mockResolvedValue({
    _request_id: "req_transcribe_123",
    text: "Купити молоко",
    usage: { type: "duration", seconds: 12 },
  });

  await transcribeAudio(
    new File(["audio"], "note.webm", { type: "audio/webm" }),
    12,
  );

  expect(clientMocks.emitUsage).toHaveBeenCalledWith({
    event: "openai_usage",
    operation: "transcribe",
    outcome: "provider_response",
    model: "gpt-4o-mini-transcribe",
    requestId: "req_transcribe_123",
    inputTokens: null,
    cachedInputTokens: null,
    outputTokens: null,
    reasoningTokens: null,
    totalTokens: null,
    audioDurationSeconds: 12,
    estimatedCostUsdMicros: 600,
    pricingSnapshot: "2026-07-20",
    retryPolicy: "sdk_max_1",
  });
  expect(JSON.stringify(clientMocks.emitUsage.mock.calls)).not.toContain("Купити молоко");
});
```

- [ ] **Step 3: Write the failing route forwarding assertion**

Update exact-call assertions in `src/app/api/transcribe/route.test.ts`:

```diff
-expect(transcribeMocks.audio).toHaveBeenCalledWith(audio);
+expect(transcribeMocks.audio).toHaveBeenCalledWith(audio, 60);
```

and:

```diff
-expect(transcribeMocks.audio).toHaveBeenCalledWith(audio);
+expect(transcribeMocks.audio).toHaveBeenCalledWith(audio, 1);
```

Keep the existing test proving a client-supplied `duration` field is ignored.

- [ ] **Step 4: Run targeted voice tests and verify RED**

Run:

```bash
pnpm test -- src/server/openai/transcribeAudio.test.ts src/app/api/transcribe/route.test.ts
```

Expected: FAIL because `transcribeAudio` accepts only the file, receives no verified duration, and emits no usage event.

- [ ] **Step 5: Implement duration-aware transcription telemetry**

Add imports to `src/server/openai/transcribeAudio.ts`:

```ts
import {
  emitOpenAIUsage,
  toOpenAIUsageDiagnostic,
} from "./usageDiagnostics";
```

Replace the function with:

```ts
export async function transcribeAudio(
  file: File,
  audioDurationSeconds: number,
): Promise<string> {
  const result = await createOpenAIClient().audio.transcriptions.create(
    {
      file,
      model: transcribeModel,
      response_format: "text",
      language: "uk",
      prompt: ukrainianTranscriptionPrompt,
    },
    { timeout: 30_000, maxRetries: 1 },
  );

  emitOpenAIUsage(
    toOpenAIUsageDiagnostic({
      operation: "transcribe",
      model: transcribeModel,
      requestId: typeof result === "string" ? undefined : result._request_id,
      usage: typeof result === "string" ? undefined : result.usage,
      audioDurationSeconds,
    }),
  );

  return typeof result === "string" ? result : result.text;
}
```

In `src/app/api/transcribe/route.ts`, pass the narrowed, server-verified duration:

```diff
   try {
-    return Response.json({ text: await transcribeAudio(audio) });
+    return Response.json({ text: await transcribeAudio(audio, duration) });
   } catch {
```

Do not read `form.get("duration")` and do not change the public response.

- [ ] **Step 6: Run all targeted OpenAI and route tests**

Run:

```bash
pnpm test -- src/server/openai/usageDiagnostics.test.ts src/server/openai/parseTasks.test.ts src/server/openai/transcribeAudio.test.ts src/app/api/parse-note/route.test.ts src/app/api/transcribe/route.test.ts
```

Expected: all targeted tests pass with no warnings or leaked private fixture text.

- [ ] **Step 7: Run the full release gate**

Run:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm scan:secrets
git diff --check
```

Expected: every command exits with code 0. Do not run `pnpm eval:ukrainian:model` unless a dedicated test API key is intentionally available, because that command itself incurs API cost.

- [ ] **Step 8: Optionally run the paid model evaluation with explicit intent**

Only when `OPENAI_API_KEY` is deliberately configured for evaluation, run:

```bash
pnpm eval:ukrainian:model
```

Expected: all Ukrainian model cases meet the existing acceptance threshold. Record the evaluation's API usage separately from product traffic. If no evaluation key is present, record this check as skipped rather than claiming it passed.

- [ ] **Step 9: Commit the transcription telemetry**

```bash
git add src/server/openai/transcribeAudio.ts src/server/openai/transcribeAudio.test.ts src/app/api/transcribe/route.ts src/app/api/transcribe/route.test.ts
git commit -m "feat: track OpenAI transcription cost"
```

- [ ] **Step 10: Inspect production evidence after deployment**

After deploying the three commits, create one short text note and one short voice note. In Vercel Runtime Logs, confirm one `openai_usage` event per completed provider operation and no note/transcript content. Compare the summed estimates with the dedicated OpenAI project's Usage view; treat dashboard balance rounding as approximate, not as a per-request invoice.
