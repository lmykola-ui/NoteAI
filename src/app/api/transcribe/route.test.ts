import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const transcribeMocks = vi.hoisted(() => ({
  audio: vi.fn(),
}));

vi.mock("@/server/openai/transcribeAudio", () => ({
  transcribeAudio: transcribeMocks.audio,
}));

function audioRequest(file?: File) {
  const form = new FormData();
  if (file) form.set("audio", file);
  return { formData: vi.fn().mockResolvedValue(form) } as unknown as Request;
}

describe("POST /api/transcribe", () => {
  beforeEach(() => {
    transcribeMocks.audio.mockReset();
  });

  it("rejects malformed multipart before transcription", async () => {
    const response = await POST(
      {
        formData: vi.fn().mockRejectedValue(new TypeError("invalid multipart")),
      } as unknown as Request,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ code: "INVALID_AUDIO" });
    expect(transcribeMocks.audio).not.toHaveBeenCalled();
  });

  it.each([
    ["missing audio", undefined],
    ["an empty file", new File([], "note.webm", { type: "audio/webm" })],
    [
      "an unsupported type",
      new File(["audio"], "note.txt", { type: "text/plain" }),
    ],
  ])("rejects %s before transcription", async (_case, file) => {
    const response = await POST(audioRequest(file));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ code: "INVALID_AUDIO" });
    expect(transcribeMocks.audio).not.toHaveBeenCalled();
  });

  it("rejects oversized audio before transcription", async () => {
    const response = await POST(
      audioRequest(
        new File([new Uint8Array(10_000_001)], "note.webm", {
          type: "audio/webm",
        }),
      ),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ code: "AUDIO_TOO_LARGE" });
    expect(transcribeMocks.audio).not.toHaveBeenCalled();
  });

  it("accepts a recorder MIME type with codec parameters", async () => {
    transcribeMocks.audio.mockResolvedValue("Купити молоко");
    const response = await POST(
      audioRequest(
        new File(["audio"], "note.webm", {
          type: "audio/webm;codecs=opus",
        }),
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ text: "Купити молоко" });
  });

  it("maps provider failures without leaking their details", async () => {
    transcribeMocks.audio.mockRejectedValue(new Error("secret provider detail"));
    const response = await POST(
      audioRequest(new File(["audio"], "note.mp4", { type: "audio/mp4" })),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      code: "TRANSCRIPTION_UNAVAILABLE",
    });
  });
});
