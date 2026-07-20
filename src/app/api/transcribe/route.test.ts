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

function wavFile(durationSeconds: number, type = "audio/wav") {
  const sampleRate = 8_000;
  const dataSize = sampleRate * durationSeconds;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      bytes[offset + index] = value.charCodeAt(index);
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);

  return new File([bytes], "note.wav", { type });
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

  it("rejects unreadable bytes for an otherwise allowed audio type", async () => {
    const response = await POST(
      audioRequest(new File(["not audio"], "note.wav", { type: "audio/wav" })),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ code: "INVALID_AUDIO" });
    expect(transcribeMocks.audio).not.toHaveBeenCalled();
  });

  it("rejects server-verified audio longer than sixty seconds", async () => {
    const response = await POST(audioRequest(wavFile(61)));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ code: "AUDIO_TOO_LONG" });
    expect(transcribeMocks.audio).not.toHaveBeenCalled();
  });

  it("does not trust a client duration field for overlong audio", async () => {
    const form = new FormData();
    form.set("audio", wavFile(61));
    form.set("duration", "1");
    const response = await POST({
      formData: vi.fn().mockResolvedValue(form),
    } as unknown as Request);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ code: "AUDIO_TOO_LONG" });
    expect(transcribeMocks.audio).not.toHaveBeenCalled();
  });

  it("accepts exactly sixty seconds of server-verified audio", async () => {
    transcribeMocks.audio.mockResolvedValue("Шістдесят секунд");
    const audio = wavFile(60);
    const response = await POST(audioRequest(audio));

    expect(response.status).toBe(200);
    expect(transcribeMocks.audio).toHaveBeenCalledWith(audio);
  });

  it("transcribes a valid server-verified minimal audio fixture", async () => {
    transcribeMocks.audio.mockResolvedValue("Купити молоко");
    const audio = wavFile(1);
    const response = await POST(audioRequest(audio));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ text: "Купити молоко" });
    expect(transcribeMocks.audio).toHaveBeenCalledWith(audio);
  });

  it("accepts a recorder MIME type with codec parameters", async () => {
    transcribeMocks.audio.mockResolvedValue("Купити молоко");
    const response = await POST(
      audioRequest(wavFile(1, "audio/wav;codecs=1")),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ text: "Купити молоко" });
  });

  it("maps provider failures without leaking their details", async () => {
    transcribeMocks.audio.mockRejectedValue(new Error("secret provider detail"));
    const response = await POST(audioRequest(wavFile(1)));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      code: "TRANSCRIPTION_UNAVAILABLE",
    });
  });
});
