import { beforeEach, describe, expect, it, vi } from "vitest";
import { transcribeAudio } from "./transcribeAudio";

const clientMocks = vi.hoisted(() => ({
  create: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({
  createOpenAIClient: clientMocks.createClient,
  transcribeModel: "gpt-4o-mini-transcribe",
}));

describe("transcribeAudio", () => {
  beforeEach(() => {
    clientMocks.create.mockReset();
    clientMocks.createClient.mockReset().mockReturnValue({
      audio: { transcriptions: { create: clientMocks.create } },
    });
  });

  it("creates the OpenAI client lazily and requests bounded Ukrainian transcription", async () => {
    clientMocks.create.mockResolvedValue("Купити молоко сьогодні");
    const file = new File(["audio"], "note.webm", { type: "audio/webm" });

    expect(clientMocks.createClient).not.toHaveBeenCalled();

    await expect(transcribeAudio(file)).resolves.toBe(
      "Купити молоко сьогодні",
    );
    expect(clientMocks.createClient).toHaveBeenCalledOnce();
    expect(clientMocks.create).toHaveBeenCalledWith(
      {
        file,
        model: "gpt-4o-mini-transcribe",
        response_format: "text",
        prompt: "Українська нотатка про повсякденні справи, дати та час.",
      },
      { timeout: 30_000, maxRetries: 1 },
    );
  });

  it("normalizes an object transcription result", async () => {
    clientMocks.create.mockResolvedValue({ text: "Перевірити пошту" });

    await expect(
      transcribeAudio(
        new File(["audio"], "note.mp4", { type: "audio/mp4" }),
      ),
    ).resolves.toBe("Перевірити пошту");
  });
});
