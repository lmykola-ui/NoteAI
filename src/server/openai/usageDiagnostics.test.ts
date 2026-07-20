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
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {
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
