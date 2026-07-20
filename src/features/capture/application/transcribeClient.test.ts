import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { requestTranscription } from "./transcribeClient";

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

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

it("does not cross the transcription fetch boundary while offline", async () => {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  await expect(
    requestTranscription(new Blob(["voice"], { type: "audio/webm" })),
  ).rejects.toThrow("OFFLINE");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("discards a transcript if connectivity is lost while reading it", async () => {
  let resolveJson!: (value: unknown) => void;
  const json = new Promise((resolve) => {
    resolveJson = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockReturnValue(json),
    } as unknown as Response),
  );

  const pending = requestTranscription(
    new Blob(["voice"], { type: "audio/webm" }),
  );
  await Promise.resolve();
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  window.dispatchEvent(new Event("offline"));
  resolveJson({ text: "Купити молоко" });

  await expect(pending).rejects.toThrow("OFFLINE");
});
