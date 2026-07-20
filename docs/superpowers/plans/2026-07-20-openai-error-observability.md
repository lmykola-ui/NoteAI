# OpenAI Error Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record a strict, non-sensitive diagnostic event when `/api/parse-note` fails so the production root cause can be identified without exposing note content or credentials.

**Architecture:** Add one server-only normalizer that converts an unknown caught value into a fixed diagnostic shape. The API route logs only that normalized object and preserves its existing public `AI_UNAVAILABLE` response contract.

**Tech Stack:** Next.js App Router, TypeScript, OpenAI JavaScript SDK, Vitest.

## Global Constraints

- Never log the API key, authorization headers, note text, system prompt, model response, request body, raw error object, raw error message, or stack trace.
- Keep the browser response `{ "code": "AI_UNAVAILABLE" }` with HTTP 502.
- Do not change the OpenAI model, prompt, timeout, retry policy, or parsing contract until the new production diagnostic identifies the root cause.
- Follow red-green TDD and verify the complete release gate before handoff.

## File Map

- Create `src/server/openai/errorDiagnostics.ts`: normalize unknown failures into the fixed allowlisted event shape.
- Create `src/server/openai/errorDiagnostics.test.ts`: prove supported fields survive and sensitive or arbitrary fields do not.
- Modify `src/app/api/parse-note/route.ts`: emit the normalized diagnostic event from the existing catch path.
- Modify `src/app/api/parse-note/route.test.ts`: prove the route logs the safe event and keeps the current 502 response.

---

### Task 1: Safely Normalize and Log Parse Failures

**Files:**
- Create: `src/server/openai/errorDiagnostics.ts`
- Create: `src/server/openai/errorDiagnostics.test.ts`
- Modify: `src/app/api/parse-note/route.ts`
- Test: `src/app/api/parse-note/route.test.ts`

**Interfaces:**
- Consumes: unknown caught values from `parseTasksWithOpenAI`.
- Produces: `toOpenAIErrorDiagnostic(error: unknown): OpenAIErrorDiagnostic`.
- Produces: one `console.error(OpenAIErrorDiagnostic)` call per failed parse request.

- [ ] **Step 1: Write the failing normalizer tests**

Create `src/server/openai/errorDiagnostics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toOpenAIErrorDiagnostic } from "./errorDiagnostics";

describe("toOpenAIErrorDiagnostic", () => {
  it("keeps only allowlisted provider diagnostics", () => {
    const diagnostic = toOpenAIErrorDiagnostic({
      name: "RateLimitError",
      status: 429,
      code: "insufficient_quota",
      request_id: "req_123",
      message: "Authorization: Bearer sk-proj-secret",
      headers: { authorization: "Bearer sk-proj-secret" },
      response: { body: "private model output" },
      stack: "private stack",
    });

    expect(diagnostic).toEqual({
      event: "openai_request_failed",
      errorType: "rate_limit",
      status: 429,
      code: "insufficient_quota",
      requestId: "req_123",
      timedOut: false,
    });
    expect(JSON.stringify(diagnostic)).not.toContain("sk-proj-secret");
    expect(JSON.stringify(diagnostic)).not.toContain("private model output");
    expect(JSON.stringify(diagnostic)).not.toContain("private stack");
  });

  it("classifies SDK timeouts without copying the message", () => {
    expect(
      toOpenAIErrorDiagnostic({
        name: "APITimeoutError",
        message: "request included private note content",
      }),
    ).toEqual({
      event: "openai_request_failed",
      errorType: "timeout",
      status: null,
      code: null,
      requestId: null,
      timedOut: true,
    });
  });

  it("classifies local response validation without copying arbitrary data", () => {
    expect(toOpenAIErrorDiagnostic(new Error("INVALID_AI_RESPONSE"))).toEqual({
      event: "openai_request_failed",
      errorType: "invalid_ai_response",
      status: null,
      code: null,
      requestId: null,
      timedOut: false,
    });
  });
});
```

- [ ] **Step 2: Run the normalizer tests and verify RED**

Run:

```bash
pnpm test -- src/server/openai/errorDiagnostics.test.ts
```

Expected: FAIL because `./errorDiagnostics` does not exist.

- [ ] **Step 3: Implement the minimal strict normalizer**

Create `src/server/openai/errorDiagnostics.ts`:

```ts
import "server-only";

export type OpenAIErrorDiagnostic = {
  event: "openai_request_failed";
  errorType:
    | "authentication"
    | "rate_limit"
    | "bad_request"
    | "permission"
    | "not_found"
    | "conflict"
    | "unprocessable"
    | "connection"
    | "timeout"
    | "api_error"
    | "invalid_ai_response"
    | "unknown";
  status: number | null;
  code: string | null;
  requestId: string | null;
  timedOut: boolean;
};

const errorTypes = {
  AuthenticationError: "authentication",
  RateLimitError: "rate_limit",
  BadRequestError: "bad_request",
  PermissionDeniedError: "permission",
  NotFoundError: "not_found",
  ConflictError: "conflict",
  UnprocessableEntityError: "unprocessable",
  APIConnectionError: "connection",
  APITimeoutError: "timeout",
  APIError: "api_error",
} as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function safeString(value: unknown, pattern: RegExp, maxLength: number) {
  return typeof value === "string" &&
    value.length <= maxLength &&
    pattern.test(value)
    ? value
    : null;
}

export function toOpenAIErrorDiagnostic(
  error: unknown,
): OpenAIErrorDiagnostic {
  const record = asRecord(error);
  const name = safeString(record?.name, /^[A-Za-z]+Error$/, 80);
  const status =
    typeof record?.status === "number" &&
    Number.isInteger(record.status) &&
    record.status >= 400 &&
    record.status <= 599
      ? record.status
      : null;
  const code = safeString(record?.code, /^[A-Za-z0-9_.-]+$/, 100);
  const requestId = safeString(record?.request_id, /^[A-Za-z0-9_.-]+$/, 200);
  const timedOut = name === "APITimeoutError";
  const invalidAIResponse =
    error instanceof Error && error.message === "INVALID_AI_RESPONSE";

  return {
    event: "openai_request_failed",
    errorType: invalidAIResponse
      ? "invalid_ai_response"
      : name && name in errorTypes
        ? errorTypes[name as keyof typeof errorTypes]
        : status !== null
          ? "api_error"
          : "unknown",
    status,
    code,
    requestId,
    timedOut,
  };
}
```

- [ ] **Step 4: Run the normalizer tests and verify GREEN**

Run:

```bash
pnpm test -- src/server/openai/errorDiagnostics.test.ts
```

Expected: PASS, 3 tests and 0 failures.

- [ ] **Step 5: Add the failing route integration assertion**

In `src/app/api/parse-note/route.test.ts`, add `consoleError` to the hoisted mocks:

```ts
const openAIMocks = vi.hoisted(() => ({
  construct: vi.fn(),
  parse: vi.fn(),
  consoleError: vi.fn(),
}));
```

Reset and install the spy in `beforeEach`:

```ts
openAIMocks.consoleError.mockReset();
vi.spyOn(console, "error").mockImplementation(openAIMocks.consoleError);
```

Restore spies in `afterEach`:

```ts
vi.restoreAllMocks();
```

Replace the existing provider-failure test with:

```ts
it("logs only safe diagnostics and maps a provider failure to AI_UNAVAILABLE", async () => {
  openAIMocks.parse.mockRejectedValue({
    name: "RateLimitError",
    status: 429,
    code: "insufficient_quota",
    request_id: "req_route_123",
    message: "Authorization: Bearer sk-proj-secret",
    response: { body: validBody.text },
  });
  const POST = await loadPost();
  const response = await POST(requestWithBody(JSON.stringify(validBody)));

  expect(response.status).toBe(502);
  await expect(response.json()).resolves.toEqual({ code: "AI_UNAVAILABLE" });
  expect(openAIMocks.consoleError).toHaveBeenCalledWith({
    event: "openai_request_failed",
    errorType: "rate_limit",
    status: 429,
    code: "insufficient_quota",
    requestId: "req_route_123",
    timedOut: false,
  });
  const logged = JSON.stringify(openAIMocks.consoleError.mock.calls);
  expect(logged).not.toContain("sk-proj-secret");
  expect(logged).not.toContain(validBody.text);
});
```

- [ ] **Step 6: Run the route test and verify RED**

Run:

```bash
pnpm test -- src/app/api/parse-note/route.test.ts
```

Expected: FAIL because `console.error` is not called by the current empty catch.

- [ ] **Step 7: Log only the normalized diagnostic from the route**

Modify `src/app/api/parse-note/route.ts`:

```ts
import {
  parseTaskRequestSchema,
  parseTasksWithOpenAI,
} from "@/server/openai/parseTasks";
import { toOpenAIErrorDiagnostic } from "@/server/openai/errorDiagnostics";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseTaskRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
  }

  try {
    return Response.json(await parseTasksWithOpenAI(parsed.data));
  } catch (error) {
    console.error(toOpenAIErrorDiagnostic(error));
    return Response.json({ code: "AI_UNAVAILABLE" }, { status: 502 });
  }
}
```

- [ ] **Step 8: Run the targeted tests and verify GREEN**

Run:

```bash
pnpm test -- src/server/openai/errorDiagnostics.test.ts src/app/api/parse-note/route.test.ts
```

Expected: PASS with 0 failures.

- [ ] **Step 9: Run the complete release gate**

Run each command and require exit code 0:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm scan:secrets
git diff --check
```

Expected: all commands pass. The secret scan must report no literal OpenAI credential.

- [ ] **Step 10: Commit the implementation**

```bash
git add \
  src/server/openai/errorDiagnostics.ts \
  src/server/openai/errorDiagnostics.test.ts \
  src/app/api/parse-note/route.ts \
  src/app/api/parse-note/route.test.ts
git commit -m "fix: log safe OpenAI failure diagnostics"
```

- [ ] **Step 11: Verify the production diagnostic after deployment**

After the commit is pushed and Vercel reports the new Production deployment as
Ready, submit one note through `/api/parse-note`. Open Vercel Runtime Logs and
confirm one `openai_request_failed` event contains only `errorType`, `status`,
`code`, `requestId`, and `timedOut`. Use that event to select and implement the
separate root-cause fix.
