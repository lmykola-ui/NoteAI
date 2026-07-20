import { beforeEach, describe, expect, it, vi } from "vitest";
import { transcribeAudio } from "./transcribeAudio";

const clientMocks = vi.hoisted(() => ({
  create: vi.fn(),
  createClient: vi.fn(),
  emitUsage: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({
  createOpenAIClient: clientMocks.createClient,
  transcribeModel: "gpt-4o-mini-transcribe",
}));
vi.mock("./usageDiagnostics", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("./usageDiagnostics")
  >();
  return { ...original, emitOpenAIUsage: clientMocks.emitUsage };
});

describe("transcribeAudio", () => {
  beforeEach(() => {
    clientMocks.create.mockReset();
    clientMocks.createClient.mockReset().mockReturnValue({
      audio: { transcriptions: { create: clientMocks.create } },
    });
    clientMocks.emitUsage.mockReset();
  });

  it("creates the OpenAI client lazily and requests bounded Ukrainian transcription", async () => {
    clientMocks.create.mockResolvedValue("Купити молоко сьогодні");
    const file = new File(["audio"], "note.webm", { type: "audio/webm" });

    expect(clientMocks.createClient).not.toHaveBeenCalled();

    await expect(transcribeAudio(file, 1)).resolves.toBe(
      "Купити молоко сьогодні",
    );
    expect(clientMocks.createClient).toHaveBeenCalledOnce();
    expect(clientMocks.create).toHaveBeenCalledWith(
      {
        file,
        model: "gpt-4o-mini-transcribe",
        response_format: "text",
        language: "uk",
        prompt: expect.stringMatching(/завайбкодити.*Vercel.*GitHub/),
      },
      { timeout: 30_000, maxRetries: 1 },
    );
  });

  it("normalizes an object transcription result", async () => {
    clientMocks.create.mockResolvedValue({ text: "Перевірити пошту" });

    await expect(
      transcribeAudio(
        new File(["audio"], "note.mp4", { type: "audio/mp4" }),
        1,
      ),
    ).resolves.toBe("Перевірити пошту");
  });

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
    expect(JSON.stringify(clientMocks.emitUsage.mock.calls)).not.toContain(
      "Купити молоко",
    );
  });
});
