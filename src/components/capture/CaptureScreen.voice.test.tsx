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

function renderCapture() {
  return render(
    <TaskProvider repository={createMemoryTaskRepository()}>
      <CaptureScreen />
    </TaskProvider>,
  );
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

it("puts a transcript in the shared textarea and parses it as voice", async () => {
  let resolveParse!: (response: Response) => void;
  const parseResponse = new Promise<Response>((resolve) => {
    resolveParse = resolve;
  });
  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const stream = {
    getTracks: vi.fn().mockReturnValue([track]),
  } as unknown as MediaStream;
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  vi.stubGlobal("fetch", vi.fn().mockReturnValue(parseResponse));
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
  expect(fetchMock).toHaveBeenCalledOnce();
  const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(JSON.parse(request.body as string)).toMatchObject({
    text: "Купити молоко сьогодні",
    inputMethod: "voice",
  });

  await act(async () => {
    resolveParse(
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
    );
    await parseResponse;
  });

  expect(await screen.findByDisplayValue("Купити молоко")).toBeVisible();
  expect(track.stop).toHaveBeenCalledOnce();
});
