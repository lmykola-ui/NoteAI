import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, it, vi } from "vitest";
import { TaskProvider } from "@/features/tasks/application/TaskProvider";
import { createMemoryTaskRepository } from "../../../tests/fixtures/memoryTaskRepository";
import { CaptureScreen } from "./CaptureScreen";

const draftStoreMocks = vi.hoisted(() => ({
  clear: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
}));

const analyticsMocks = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("@/lib/analytics", () => ({
  trackSafeEvent: analyticsMocks.track,
}));

vi.mock("@/features/capture/infrastructure/draftStore", () => ({
  clearCaptureDraft: draftStoreMocks.clear,
  loadCaptureDraft: draftStoreMocks.load,
  saveCaptureDraft: draftStoreMocks.save,
}));

beforeEach(() => {
  draftStoreMocks.clear.mockReset().mockResolvedValue(undefined);
  draftStoreMocks.load.mockReset().mockResolvedValue("");
  draftStoreMocks.save.mockReset().mockResolvedValue(undefined);
  analyticsMocks.track.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("shows editable preview and persists only after confirmation", async () => {
  const repository = createMemoryTaskRepository();
  const saved = repository.saved;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tasks: [
            {
              title: "Купити молоко",
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
    ),
  );
  render(
    <TaskProvider repository={repository}>
      <CaptureScreen />
    </TaskProvider>,
  );

  await userEvent.type(screen.getByLabelText("Ваша нотатка"), "Купити молоко");
  await userEvent.click(screen.getByRole("button", { name: "Розібрати" }));

  expect(await screen.findByDisplayValue("Купити молоко")).toBeVisible();
  expect(saved).toHaveLength(0);

  await userEvent.click(screen.getByRole("button", { name: "Додати все" }));

  expect(saved).toHaveLength(1);
  expect(analyticsMocks.track).toHaveBeenCalledWith("capture_confirmed");
});

it("reports a parse failure without sending note content to analytics", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
  render(
    <TaskProvider repository={createMemoryTaskRepository()}>
      <CaptureScreen />
    </TaskProvider>,
  );

  await userEvent.type(screen.getByLabelText("Ваша нотатка"), "Приватна нотатка");
  await userEvent.click(screen.getByRole("button", { name: "Розібрати" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Не вдалося проаналізувати нотатку",
  );
  expect(analyticsMocks.track).toHaveBeenCalledWith("parse_failed");
  expect(analyticsMocks.track).toHaveBeenCalledOnce();
});

it("keeps the local draft editable while AI parsing is unavailable", async () => {
  render(
    <TaskProvider repository={createMemoryTaskRepository()}>
      <CaptureScreen aiAvailable={false} />
    </TaskProvider>,
  );

  const note = screen.getByLabelText("Ваша нотатка");
  await userEvent.type(note, "Локальна чернетка");

  expect(note).toBeEnabled();
  expect(screen.getByRole("button", { name: "Розібрати" })).toBeDisabled();
});

it("waits for the latest draft write before clearing it on confirmation", async () => {
  let finishSave!: () => void;
  draftStoreMocks.save.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finishSave = resolve;
      }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tasks: [
            {
              title: "Купити молоко",
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
    ),
  );
  render(
    <TaskProvider repository={createMemoryTaskRepository()}>
      <CaptureScreen />
    </TaskProvider>,
  );

  fireEvent.change(screen.getByLabelText("Ваша нотатка"), {
    target: { value: "Купити молоко" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Розібрати" }));
  await userEvent.click(screen.getByRole("button", { name: "Додати все" }));

  expect(draftStoreMocks.clear).not.toHaveBeenCalled();

  finishSave();

  await waitFor(() => expect(draftStoreMocks.clear).toHaveBeenCalledOnce());
});

it("retries draft cleanup without persisting confirmed tasks again", async () => {
  const repository = createMemoryTaskRepository();
  draftStoreMocks.clear.mockRejectedValueOnce(new Error("storage unavailable"));
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tasks: [
            {
              title: "Купити молоко",
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
    ),
  );
  render(
    <TaskProvider repository={repository}>
      <CaptureScreen />
    </TaskProvider>,
  );

  await userEvent.type(screen.getByLabelText("Ваша нотатка"), "Купити молоко");
  await userEvent.click(screen.getByRole("button", { name: "Розібрати" }));
  await userEvent.click(screen.getByRole("button", { name: "Додати все" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Задачі додано, але нотатку не вдалося очистити",
  );
  expect(repository.saved).toHaveLength(1);
  expect(draftStoreMocks.clear).toHaveBeenCalledOnce();

  await userEvent.click(screen.getByRole("button", { name: "Спробувати ще раз" }));

  await waitFor(() => expect(draftStoreMocks.clear).toHaveBeenCalledTimes(2));
  expect(repository.saved).toHaveLength(1);
});
