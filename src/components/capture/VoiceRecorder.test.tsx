import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { VoiceRecorder } from "./VoiceRecorder";

const transcriptionMocks = vi.hoisted(() => ({
  request: vi.fn(),
}));

const analyticsMocks = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("@/features/capture/application/transcribeClient", () => ({
  requestTranscription: transcriptionMocks.request,
}));

vi.mock("@/lib/analytics", () => ({
  trackSafeEvent: analyticsMocks.track,
}));

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];

  state: RecordingState = "inactive";
  mimeType = "audio/webm;codecs=opus";
  deferStopEvent = false;
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;
  start = vi.fn(() => {
    this.state = "recording";
  });
  stop = vi.fn(() => {
    this.state = "inactive";
    if (!this.deferStopEvent) this.emitStop();
  });

  constructor() {
    MockMediaRecorder.instances.push(this);
  }

  emitChunk(data: Blob) {
    this.ondataavailable?.({ data } as BlobEvent);
  }

  emitError() {
    this.onerror?.(new Event("error"));
  }

  emitStop() {
    this.onstop?.(new Event("stop"));
  }
}

function microphone() {
  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const stream = {
    getTracks: vi.fn().mockReturnValue([track]),
  } as unknown as MediaStream;
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  return { getUserMedia, stream, track };
}

async function startAndStopRecording() {
  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));
  const recorder = MockMediaRecorder.instances.at(-1)!;
  recorder.emitChunk(new Blob(["voice"], { type: "audio/webm" }));
  await userEvent.click(screen.getByRole("button", { name: "Зупинити запис" }));
  return recorder;
}

beforeEach(() => {
  MockMediaRecorder.instances = [];
  transcriptionMocks.request.mockReset();
  analyticsMocks.track.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("reports denied microphone permission without disabling text capture", async () => {
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi
        .fn()
        .mockRejectedValue(new DOMException("Denied", "NotAllowedError")),
    },
  });
  render(<VoiceRecorder onTranscript={vi.fn()} />);

  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Немає доступу до мікрофона",
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Увімкніть доступ у налаштуваннях браузера",
  );
  expect(screen.getByRole("button", { name: "Спробувати ще раз" })).toBeEnabled();
});

it("shows the focused listening controls while a note is being recorded", async () => {
  microphone();
  render(<VoiceRecorder onTranscript={vi.fn()} />);

  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));

  expect(await screen.findByText("Слухаю…")).toBeVisible();
  expect(screen.getByRole("img", { name: "Рівень звуку" })).toBeVisible();
  expect(screen.getByTestId("audio-waveform").querySelectorAll("i")).toHaveLength(13);
  expect(document.querySelector(".voice-capture-pulse")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Пауза запису" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Зупинити запис" })).toHaveClass("voice-stop-button");
});

it("renders live waveform levels from the microphone stream", async () => {
  microphone();
  const analyser = {
    fftSize: 0,
    smoothingTimeConstant: 0,
    disconnect: vi.fn(),
    getByteTimeDomainData: vi.fn(),
  };
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const AudioContextMock = vi.fn(function MockAudioContext() {
    return {
      state: "running",
      close: vi.fn().mockResolvedValue(undefined),
      createAnalyser: vi.fn().mockReturnValue(analyser),
      createMediaStreamSource: vi.fn().mockReturnValue(source),
    };
  });
  vi.stubGlobal("AudioContext", AudioContextMock);
  let sampleFrame: FrameRequestCallback | undefined;
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      sampleFrame = callback;
      return 1;
    }),
  );

  render(<VoiceRecorder onTranscript={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));

  expect(AudioContextMock).toHaveBeenCalledOnce();
  expect(sampleFrame).toBeDefined();
  analyser.getByteTimeDomainData.mockImplementation((samples: Uint8Array) => {
    samples.fill(150);
  });
  act(() => sampleFrame?.(0));
  expect(analyser.getByteTimeDomainData).toHaveBeenCalled();
  expect(screen.getByTestId("audio-waveform")).toBeVisible();
});

it("resumes a suspended audio context before sampling microphone levels", async () => {
  microphone();
  const resume = vi.fn().mockResolvedValue(undefined);
  const analyser = {
    fftSize: 0,
    smoothingTimeConstant: 0,
    disconnect: vi.fn(),
    getByteTimeDomainData: vi.fn(),
  };
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  vi.stubGlobal(
    "AudioContext",
    vi.fn(function MockAudioContext() {
      return {
        state: "suspended",
        resume,
        close: vi.fn().mockResolvedValue(undefined),
        createAnalyser: vi.fn().mockReturnValue(analyser),
        createMediaStreamSource: vi.fn().mockReturnValue(source),
      };
    }),
  );
  vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(1));

  render(<VoiceRecorder onTranscript={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));

  expect(resume).toHaveBeenCalledOnce();
  await waitFor(() => expect(source.connect).toHaveBeenCalledWith(analyser));
});

it("uses the prefixed mobile audio context when the standard name is unavailable", async () => {
  microphone();
  const analyser = {
    fftSize: 0,
    smoothingTimeConstant: 0,
    disconnect: vi.fn(),
    getByteTimeDomainData: vi.fn(),
  };
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const WebkitAudioContextMock = vi.fn(function MockAudioContext() {
    return {
      state: "running",
      close: vi.fn().mockResolvedValue(undefined),
      createAnalyser: vi.fn().mockReturnValue(analyser),
      createMediaStreamSource: vi.fn().mockReturnValue(source),
    };
  });
  vi.stubGlobal("AudioContext", undefined);
  vi.stubGlobal("webkitAudioContext", WebkitAudioContextMock);
  vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(1));

  render(<VoiceRecorder onTranscript={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));

  expect(WebkitAudioContextMock).toHaveBeenCalledOnce();
  expect(source.connect).toHaveBeenCalledWith(analyser);
});

it("starts listening automatically for the voice-first flow", async () => {
  const { getUserMedia } = microphone();
  render(<VoiceRecorder autoStart onTranscript={vi.fn()} />);

  expect(await screen.findByText("Слухаю…")).toBeVisible();
  expect(getUserMedia).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Зупинити запис" })).toBeVisible();
});

it("transcribes one combined recording and cleans up every media track", async () => {
  const firstTrack = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const secondTrack = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const stream = {
    getTracks: vi.fn().mockReturnValue([firstTrack, secondTrack]),
  } as unknown as MediaStream;
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  transcriptionMocks.request.mockResolvedValue("Купити молоко сьогодні");
  const onTranscript = vi.fn();
  render(<VoiceRecorder onTranscript={onTranscript} />);

  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));
  const recorder = MockMediaRecorder.instances[0];
  recorder.emitChunk(new Blob(["first"], { type: "audio/webm" }));
  recorder.emitChunk(new Blob(["second"], { type: "audio/webm" }));
  await userEvent.click(screen.getByRole("button", { name: "Зупинити запис" }));

  await waitFor(() =>
    expect(onTranscript).toHaveBeenCalledWith("Купити молоко сьогодні"),
  );
  expect(transcriptionMocks.request).toHaveBeenCalledOnce();
  const uploaded = transcriptionMocks.request.mock.calls[0][0] as Blob;
  expect(uploaded.size).toBe(11);
  expect(uploaded.type).toBe("audio/webm;codecs=opus");
  expect(firstTrack.stop).toHaveBeenCalledOnce();
  expect(secondTrack.stop).toHaveBeenCalledOnce();
});

it("stops recording one second before the server's sixty-second hard cap", async () => {
  vi.useFakeTimers();
  microphone();
  transcriptionMocks.request.mockResolvedValue("Перевірити пошту");
  render(<VoiceRecorder onTranscript={vi.fn()} />);

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Почати запис" }));
    await Promise.resolve();
  });
  const recorder = MockMediaRecorder.instances[0];

  act(() => {
    vi.advanceTimersByTime(58_999);
  });
  expect(recorder.stop).not.toHaveBeenCalled();

  await act(async () => {
    vi.advanceTimersByTime(1);
    await Promise.resolve();
  });
  expect(recorder.stop).toHaveBeenCalledOnce();

  act(() => {
    vi.advanceTimersByTime(1_000);
  });
  expect(recorder.stop).toHaveBeenCalledOnce();
});

it("allows a fresh recording after transcription fails", async () => {
  const { getUserMedia } = microphone();
  transcriptionMocks.request
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce("Перевірити пошту");
  const onTranscript = vi.fn();
  render(<VoiceRecorder onTranscript={onTranscript} />);

  await startAndStopRecording();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Не вдалося розпізнати нотатку",
  );

  await userEvent.click(screen.getByRole("button", { name: "Спробувати ще раз" }));
  const secondRecorder = MockMediaRecorder.instances[1];
  secondRecorder.emitChunk(new Blob(["voice"], { type: "audio/webm" }));
  await userEvent.click(screen.getByRole("button", { name: "Зупинити запис" }));

  await waitFor(() => expect(onTranscript).toHaveBeenCalledWith("Перевірити пошту"));
  expect(getUserMedia).toHaveBeenCalledTimes(2);
  expect(analyticsMocks.track).toHaveBeenCalledWith("transcription_failed");
});

it("disables voice transcription while offline", () => {
  render(<VoiceRecorder onTranscript={vi.fn()} disabled />);

  expect(screen.getByRole("button", { name: "Почати запис" })).toBeDisabled();
});

it("immediately stops and discards an active recording when disabled", async () => {
  const { track } = microphone();
  const { rerender } = render(<VoiceRecorder onTranscript={vi.fn()} />);

  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));
  const recorder = MockMediaRecorder.instances[0];
  recorder.emitChunk(new Blob(["voice"], { type: "audio/webm" }));
  rerender(<VoiceRecorder onTranscript={vi.fn()} disabled />);

  expect(recorder.stop).toHaveBeenCalledOnce();
  expect(track.stop).toHaveBeenCalledOnce();
  expect(transcriptionMocks.request).not.toHaveBeenCalled();
});

it("immediately stops and discards an active recording on an offline event", async () => {
  const { track } = microphone();
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
  render(<VoiceRecorder onTranscript={vi.fn()} />);

  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));
  const recorder = MockMediaRecorder.instances[0];
  recorder.emitChunk(new Blob(["voice"], { type: "audio/webm" }));
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  act(() => window.dispatchEvent(new Event("offline")));

  expect(recorder.stop).toHaveBeenCalledOnce();
  expect(track.stop).toHaveBeenCalledOnce();
  expect(transcriptionMocks.request).not.toHaveBeenCalled();
});

it("keeps a recorder error visible when its delayed stop event arrives", async () => {
  microphone();
  render(<VoiceRecorder onTranscript={vi.fn()} />);

  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));
  const recorder = MockMediaRecorder.instances[0];
  recorder.deferStopEvent = true;
  act(() => recorder.emitError());
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Не вдалося розпізнати нотатку",
  );

  act(() => recorder.emitStop());

  expect(screen.getByRole("alert")).toHaveTextContent(
    "Не вдалося розпізнати нотатку",
  );
});

it("recovers after going offline while microphone permission is pending", async () => {
  let resolveFirstPermission!: (stream: MediaStream) => void;
  const firstTrack = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const secondTrack = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const firstStream = {
    getTracks: vi.fn().mockReturnValue([firstTrack]),
  } as unknown as MediaStream;
  const secondStream = {
    getTracks: vi.fn().mockReturnValue([secondTrack]),
  } as unknown as MediaStream;
  const getUserMedia = vi
    .fn()
    .mockReturnValueOnce(
      new Promise<MediaStream>((resolve) => {
        resolveFirstPermission = resolve;
      }),
    )
    .mockResolvedValueOnce(secondStream);
  vi.stubGlobal("navigator", {
    onLine: true,
    mediaDevices: { getUserMedia },
  });
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  const onTranscript = vi.fn();
  const { rerender } = render(
    <VoiceRecorder onTranscript={onTranscript} disabled={false} />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));
  expect(screen.getByRole("button", { name: "Запитуємо доступ…" })).toBeDisabled();

  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  rerender(<VoiceRecorder onTranscript={onTranscript} disabled />);

  expect(transcriptionMocks.request).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Почати запис" })).toBeDisabled();

  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
  rerender(<VoiceRecorder onTranscript={onTranscript} disabled={false} />);

  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));

  expect(getUserMedia).toHaveBeenCalledTimes(2);
  expect(MockMediaRecorder.instances).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Зупинити запис" })).toBeEnabled();
  expect(secondTrack.stop).not.toHaveBeenCalled();

  await act(async () => {
    resolveFirstPermission(firstStream);
    await Promise.resolve();
  });

  expect(firstTrack.stop).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Зупинити запис" })).toBeEnabled();
  expect(secondTrack.stop).not.toHaveBeenCalled();
});

it("keeps retry resources isolated from delayed callbacks of a failed recording", async () => {
  vi.useFakeTimers();
  const firstTrack = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const secondTrack = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const getUserMedia = vi
    .fn()
    .mockResolvedValueOnce({
      getTracks: vi.fn().mockReturnValue([firstTrack]),
    } as unknown as MediaStream)
    .mockResolvedValueOnce({
      getTracks: vi.fn().mockReturnValue([secondTrack]),
    } as unknown as MediaStream);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  transcriptionMocks.request.mockResolvedValue("Купити хліб");
  const onTranscript = vi.fn();
  render(<VoiceRecorder onTranscript={onTranscript} />);

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Почати запис" }));
    await Promise.resolve();
  });
  const firstRecorder = MockMediaRecorder.instances[0];
  firstRecorder.mimeType = "audio/mp4";
  firstRecorder.deferStopEvent = true;
  act(() => firstRecorder.emitError());
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Не вдалося розпізнати нотатку",
  );

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Спробувати ще раз" }));
    await Promise.resolve();
  });
  const secondRecorder = MockMediaRecorder.instances[1];
  secondRecorder.emitChunk(
    new Blob(["second-session"], { type: "audio/webm" }),
  );

  act(() => {
    firstRecorder.emitChunk(new Blob(["stale"], { type: "audio/mp4" }));
    firstRecorder.emitStop();
    firstRecorder.emitError();
  });

  expect(secondRecorder.state).toBe("recording");
  expect(secondTrack.stop).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Зупинити запис" })).toBeEnabled();
  expect(transcriptionMocks.request).not.toHaveBeenCalled();

  act(() => vi.advanceTimersByTime(58_999));
  expect(secondRecorder.stop).not.toHaveBeenCalled();
  await act(async () => {
    vi.advanceTimersByTime(1);
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(onTranscript).toHaveBeenCalledWith("Купити хліб");
  expect(secondRecorder.stop).toHaveBeenCalledOnce();
  expect(secondTrack.stop).toHaveBeenCalledOnce();
  expect(transcriptionMocks.request).toHaveBeenCalledOnce();
  const uploaded = transcriptionMocks.request.mock.calls[0][0] as Blob;
  expect(uploaded).toMatchObject({
    size: new Blob(["second-session"]).size,
    type: "audio/webm;codecs=opus",
  });
});

it("stops active tracks when the recorder unmounts", async () => {
  const { track } = microphone();
  const { unmount } = render(<VoiceRecorder onTranscript={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));

  unmount();

  expect(track.stop).toHaveBeenCalledOnce();
  expect(MockMediaRecorder.instances[0].stop).toHaveBeenCalledOnce();
  expect(transcriptionMocks.request).not.toHaveBeenCalled();
});

it("does not forward a transcript that finishes after unmount", async () => {
  microphone();
  let resolveTranscription!: (text: string) => void;
  transcriptionMocks.request.mockReturnValue(
    new Promise<string>((resolve) => {
      resolveTranscription = resolve;
    }),
  );
  const onTranscript = vi.fn();
  const { unmount } = render(<VoiceRecorder onTranscript={onTranscript} />);

  await startAndStopRecording();
  unmount();
  await act(async () => {
    resolveTranscription("Купити молоко");
    await Promise.resolve();
  });

  expect(onTranscript).not.toHaveBeenCalled();
});
