import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TaskProvider } from "@/features/tasks/application/TaskProvider";
import { createMemoryTaskRepository } from "../../../tests/fixtures/memoryTaskRepository";
import { CaptureScreen } from "./CaptureScreen";

const captureMocks = vi.hoisted(() => ({
  clear: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
  transcribe: vi.fn(),
}));

vi.mock("@/features/capture/infrastructure/draftStore", () => ({
  clearCaptureDraft: captureMocks.clear,
  loadCaptureDraft: captureMocks.load,
  saveCaptureDraft: captureMocks.save,
}));

vi.mock("@/features/capture/application/transcribeClient", () => ({
  requestTranscription: captureMocks.transcribe,
}));

class MockMediaRecorder {
  static instance: MockMediaRecorder;

  state: RecordingState = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;

  constructor() {
    MockMediaRecorder.instance = this;
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob(["voice"], { type: "audio/webm" }),
    } as BlobEvent);
    this.onstop?.(new Event("stop"));
  }
}

function renderCapture(voiceFirst = false) {
  const repository = createMemoryTaskRepository();
  const result = render(
    <TaskProvider repository={repository}>
      <CaptureScreen voiceFirst={voiceFirst} />
    </TaskProvider>,
  );

  return { repository, ...result };
}

beforeEach(() => {
  captureMocks.clear.mockReset().mockResolvedValue(undefined);
  captureMocks.load.mockReset().mockResolvedValue("");
  captureMocks.save.mockReset().mockResolvedValue(undefined);
  captureMocks.transcribe.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("keeps a typed draft available when microphone permission is denied", async () => {
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi
        .fn()
        .mockRejectedValue(new DOMException("Denied", "NotAllowedError")),
    },
  });
  renderCapture();
  const textarea = screen.getByLabelText("Ваша нотатка");
  await userEvent.type(textarea, "Купити молоко");

  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Немає доступу до мікрофона",
  );
  expect(textarea).toBeEnabled();
  expect(textarea).toHaveValue("Купити молоко");
  expect(screen.getByRole("button", { name: "Розібрати" })).toBeEnabled();
});

it("puts an editable transcript in the shared textarea and waits for explicit voice parsing", async () => {
  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const stream = {
    getTracks: vi.fn().mockReturnValue([track]),
  } as unknown as MediaStream;
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tasks: [
            {
              title: "Купити молоко",
              scheduledDate: "2026-07-19",
              scheduledTime: null,
              status: "active",
              priority: null,
              inputMethod: "voice",
            },
          ],
          clarification: null,
        }),
        { status: 200 },
      ),
    ),
  );
  captureMocks.transcribe.mockResolvedValue("Купити молоко сьогодні");
  renderCapture();

  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));
  await userEvent.click(screen.getByRole("button", { name: "Зупинити запис" }));

  await waitFor(() =>
    expect(screen.getByLabelText("Ваша нотатка")).toHaveValue(
      "Купити молоко сьогодні",
    ),
  );
  const fetchMock = vi.mocked(fetch);
  expect(fetchMock).not.toHaveBeenCalled();

  await userEvent.type(screen.getByLabelText("Ваша нотатка"), " і хліб");
  await userEvent.click(screen.getByRole("button", { name: "Розібрати" }));

  expect(fetchMock).toHaveBeenCalledOnce();
  const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(JSON.parse(request.body as string)).toMatchObject({
    text: "Купити молоко сьогодні і хліб",
    inputMethod: "voice",
  });

  expect(await screen.findByDisplayValue("Купити молоко")).toBeVisible();
  expect(track.stop).toHaveBeenCalledOnce();
});

it("saves unambiguous voice tasks without rendering preview", async () => {
  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: vi.fn().mockReturnValue([track]),
      } as unknown as MediaStream),
    },
  });
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tasks: [
            {
              title: "Надіслати бриф клієнту",
              scheduledDate: "2026-07-21",
              scheduledTime: "11:00",
              status: "active",
              priority: "high",
              inputMethod: "voice",
            },
          ],
          clarification: null,
        }),
        { status: 200 },
      ),
    ),
  );
  captureMocks.transcribe.mockResolvedValue("Надіслати бриф клієнту сьогодні о 11");
  const { repository } = renderCapture(true);

  expect(await screen.findByText("Слухаю…")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Зупинити запис" }));

  expect(
    await screen.findByRole("status", { name: "Створено 1 задачу" }),
  ).toBeVisible();
  expect(screen.queryByText("Перевірте задачі")).not.toBeInTheDocument();
  expect(repository.saved).toHaveLength(1);
  expect(repository.saved[0]).toMatchObject({
    title: "Надіслати бриф клієнту",
    priority: "high",
  });
  expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  expect(track.stop).toHaveBeenCalledOnce();
});

it("does not save an ambiguous voice result", async () => {
  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: vi.fn().mockReturnValue([track]),
      } as unknown as MediaStream),
    },
  });
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tasks: [
            {
              title: "Запланувати зустріч",
              scheduledDate: null,
              scheduledTime: null,
              status: "active",
              priority: null,
              inputMethod: "voice",
            },
          ],
          clarification: "Уточніть дату",
        }),
        { status: 200 },
      ),
    ),
  );
  captureMocks.transcribe.mockResolvedValue("Запланувати зустріч");
  const { repository } = renderCapture(true);

  await screen.findByText("Слухаю…");
  await userEvent.click(screen.getByRole("button", { name: "Зупинити запис" }));

  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.queryByText("Перевірте задачі")).not.toBeInTheDocument();
  expect(repository.saved).toHaveLength(0);
});

it("resets parsing to text after the user clears a transcript and starts a new note", async () => {
  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: vi.fn().mockReturnValue([track]),
      } as unknown as MediaStream),
    },
  });
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        tasks: [
          {
            title: "Написати лист",
            scheduledDate: null,
            scheduledTime: null,
            status: "active",
            priority: null,
            inputMethod: "text",
          },
        ],
        clarification: null,
      }),
      { status: 200 },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  captureMocks.transcribe.mockResolvedValue("Голосова нотатка");
  renderCapture();

  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));
  await userEvent.click(screen.getByRole("button", { name: "Зупинити запис" }));
  const textarea = await screen.findByLabelText("Ваша нотатка");
  await waitFor(() => expect(textarea).toHaveValue("Голосова нотатка"));

  await userEvent.clear(textarea);
  await userEvent.type(textarea, "Написати лист");
  await userEvent.click(screen.getByRole("button", { name: "Розібрати" }));

  const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(JSON.parse(request.body as string)).toMatchObject({
    text: "Написати лист",
    inputMethod: "text",
  });
});

it("discards a deferred transcript when AI becomes unavailable before it resolves", async () => {
  let resolveTranscription!: (text: string) => void;
  const transcription = new Promise<string>((resolve) => {
    resolveTranscription = resolve;
  });
  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const stream = {
    getTracks: vi.fn().mockReturnValue([track]),
  } as unknown as MediaStream;
  vi.stubGlobal("navigator", {
    onLine: true,
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  captureMocks.transcribe.mockReturnValue(transcription);
  const repository = createMemoryTaskRepository();
  const { rerender } = render(
    <TaskProvider repository={repository}>
      <CaptureScreen aiAvailable />
    </TaskProvider>,
  );

  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));
  await userEvent.click(screen.getByRole("button", { name: "Зупинити запис" }));
  await waitFor(() => expect(captureMocks.transcribe).toHaveBeenCalledOnce());

  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  rerender(
    <TaskProvider repository={repository}>
      <CaptureScreen aiAvailable={false} />
    </TaskProvider>,
  );
  await act(async () => {
    resolveTranscription("Купити молоко");
    await transcription;
  });

  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Ваша нотатка")).not.toHaveValue("Купити молоко");
  expect(screen.getByRole("button", { name: "Почати запис" })).toBeDisabled();
});

it("does not parse when offline and a deferred transcript resolve in the same tick", async () => {
  let resolveTranscription!: (text: string) => void;
  const transcription = new Promise<string>((resolve) => {
    resolveTranscription = resolve;
  });
  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  vi.stubGlobal("navigator", {
    onLine: true,
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: vi.fn().mockReturnValue([track]),
      } as unknown as MediaStream),
    },
  });
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  captureMocks.transcribe.mockReturnValue(transcription);
  renderCapture();

  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));
  await userEvent.click(screen.getByRole("button", { name: "Зупинити запис" }));
  await waitFor(() => expect(captureMocks.transcribe).toHaveBeenCalledOnce());

  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  await act(async () => {
    window.dispatchEvent(new Event("offline"));
    resolveTranscription("Купити молоко");
    await transcription;
  });

  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Ваша нотатка")).not.toHaveValue("Купити молоко");
  expect(screen.queryByText("Розпізнаємо…")).not.toBeInTheDocument();
});
