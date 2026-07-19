import { afterEach, expect, it, vi } from "vitest";
import { requestTranscription } from "./transcribeClient";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("uploads one bounded recording and returns its transcript", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ text: "Купити молоко" }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);

  await expect(
    requestTranscription(new Blob(["voice"], { type: "audio/webm" })),
  ).resolves.toBe("Купити молоко");

  const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/transcribe",
    expect.objectContaining({ method: "POST" }),
  );
  expect(options.body).toBeInstanceOf(FormData);
  const audio = (options.body as FormData).get("audio");
  expect(audio).toBeInstanceOf(File);
  expect(audio).toMatchObject({ name: "note.webm", type: "audio/webm" });
});

it("uses a filename that matches a Safari MP4 recording", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ text: "Перевірити пошту" }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);

  await requestTranscription(
    new Blob(["voice"], { type: "audio/mp4;codecs=mp4a.40.2" }),
  );

  const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect((options.body as FormData).get("audio")).toMatchObject({
    name: "note.mp4",
    type: "audio/mp4;codecs=mp4a.40.2",
  });
});

it("maps non-successful and malformed responses to a stable client error", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "AUDIO_TOO_LARGE" }), { status: 413 }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ text: "" }), { status: 200 }),
    );
  vi.stubGlobal("fetch", fetchMock);

  const recording = new Blob(["voice"], { type: "audio/webm" });
  await expect(requestTranscription(recording)).rejects.toThrow(
    "TRANSCRIPTION_UNAVAILABLE",
  );
  await expect(requestTranscription(recording)).rejects.toThrow(
    "TRANSCRIPTION_UNAVAILABLE",
  );
});
