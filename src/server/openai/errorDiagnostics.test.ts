import { describe, expect, it, vi } from "vitest";
import { toOpenAIErrorDiagnostic } from "./errorDiagnostics";

vi.mock("server-only", () => ({}));

describe("toOpenAIErrorDiagnostic", () => {
  it("keeps only allowlisted provider diagnostics", () => {
    class RateLimitError extends Error {}
    const providerError = Object.assign(
      new RateLimitError("Authorization: Bearer sk-proj-secret"),
      {
        status: 429,
        code: "insufficient_quota",
        requestID: "req_123",
        headers: { authorization: "Bearer sk-proj-secret" },
        response: { body: "private model output" },
        stack: "private stack",
      },
    );
    const diagnostic = toOpenAIErrorDiagnostic(providerError);

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
    class APIConnectionTimeoutError extends Error {}

    expect(
      toOpenAIErrorDiagnostic(
        new APIConnectionTimeoutError("request included private note content"),
      ),
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

  it("classifies a bundled ZodError without copying its message", () => {
    const ForeignZodError = class ZodError extends Error {};
    const diagnostic = toOpenAIErrorDiagnostic(
      new ForeignZodError("private model output"),
    );

    expect(diagnostic).toEqual({
      event: "openai_request_failed",
      errorType: "invalid_ai_response",
      status: null,
      code: null,
      requestId: null,
      timedOut: false,
    });
    expect(JSON.stringify(diagnostic)).not.toContain("private model output");
  });

  it("classifies a local OpenAI parser error without copying its message", () => {
    const ForeignOpenAIError = class OpenAIError extends Error {};
    const diagnostic = toOpenAIErrorDiagnostic(
      new ForeignOpenAIError("private model output"),
    );

    expect(diagnostic).toEqual({
      event: "openai_request_failed",
      errorType: "invalid_ai_response",
      status: null,
      code: null,
      requestId: null,
      timedOut: false,
    });
    expect(JSON.stringify(diagnostic)).not.toContain("private model output");
  });
});
