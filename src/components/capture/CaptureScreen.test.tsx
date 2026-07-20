import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, it, vi } from "vitest";
import { TaskProvider } from "@/features/tasks/application/TaskProvider";
import type { TaskRepository } from "@/features/tasks/infrastructure/TaskRepository";
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

it("preserves the original draft when returning from an unresolved clarification", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tasks: [],
          clarification: "Коли саме запланувати зустріч?",
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

  await userEvent.type(
    screen.getByLabelText("Ваша нотатка"),
    "Заплануй зустріч якось потім",
  );
  await userEvent.click(screen.getByRole("button", { name: "Розібрати" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Коли саме запланувати зустріч?",
  );

  await userEvent.click(screen.getByRole("button", { name: "Назад" }));

  expect(screen.getByLabelText("Ваша нотатка")).toHaveValue(
    "Заплануй зустріч якось потім",
  );
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

it("surfaces a local draft load failure without disabling capture", async () => {
  draftStoreMocks.load.mockRejectedValue(new Error("IndexedDB unavailable"));

  render(
    <TaskProvider repository={createMemoryTaskRepository()}>
      <CaptureScreen />
    </TaskProvider>,
  );

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Не вдалося відкрити локальну чернетку",
  );
  expect(screen.getByLabelText("Ваша нотатка")).toBeEnabled();
});

it("surfaces a local draft write failure and keeps the entered text", async () => {
  draftStoreMocks.save.mockRejectedValue(new Error("quota exceeded"));

  render(
    <TaskProvider repository={createMemoryTaskRepository()}>
      <CaptureScreen />
    </TaskProvider>,
  );

  await userEvent.type(screen.getByLabelText("Ваша нотатка"), "Локальна чернетка");

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Не вдалося зберегти чернетку",
  );
  expect(screen.getByLabelText("Ваша нотатка")).toHaveValue("Локальна чернетка");
});

it("keeps a deferred draft write failure visible after preview opens", async () => {
  let rejectDraftWrite!: (error: Error) => void;
  draftStoreMocks.save.mockReturnValue(
    new Promise<void>((_resolve, reject) => {
      rejectDraftWrite = reject;
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
  expect(await screen.findByLabelText("Назва задачі")).toHaveValue(
    "Купити молоко",
  );

  await act(async () => rejectDraftWrite(new Error("quota exceeded")));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Не вдалося зберегти чернетку",
  );
  expect(screen.getByLabelText("Назва задачі")).toHaveValue("Купити молоко");
});

it("keeps the edited preview mounted and retries a failed task save without duplicates", async () => {
  const baseRepository = createMemoryTaskRepository();
  const saveMany = vi
    .fn<TaskRepository["saveMany"]>()
    .mockRejectedValueOnce(new Error("quota exceeded"))
    .mockImplementation((tasks) => baseRepository.saveMany(tasks));
  const repository: TaskRepository = { ...baseRepository, saveMany };
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
  const title = await screen.findByLabelText("Назва задачі");
  await userEvent.clear(title);
  await userEvent.type(title, "Купити хліб");
  await userEvent.click(screen.getByRole("button", { name: "Додати все" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Не вдалося зберегти задачі",
  );
  expect(screen.getByLabelText("Назва задачі")).toHaveValue("Купити хліб");
  expect(baseRepository.saved).toHaveLength(0);

  await userEvent.click(
    screen.getByRole("button", {
      name: "Спробувати зберегти задачі ще раз",
    }),
  );

  await waitFor(() => expect(baseRepository.saved).toHaveLength(1));
  expect(baseRepository.saved[0].title).toBe("Купити хліб");
  expect(saveMany).toHaveBeenCalledTimes(2);
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
