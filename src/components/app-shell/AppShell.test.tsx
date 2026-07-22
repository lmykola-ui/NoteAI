import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TaskProvider } from "@/features/tasks/application/TaskProvider";
import type { TaskRepository } from "@/features/tasks/infrastructure/TaskRepository";
import { createMemoryTaskRepository } from "../../../tests/fixtures/memoryTaskRepository";
import { makeTask } from "../../../tests/fixtures/taskFactory";
import { AppShell } from "./AppShell";

const shellMocks = vi.hoisted(() => ({
  clearDraft: vi.fn(),
  loadDraft: vi.fn(),
  requestPersistence: vi.fn(),
  saveDraft: vi.fn(),
}));

vi.mock("@/features/capture/infrastructure/draftStore", () => ({
  clearCaptureDraft: shellMocks.clearDraft,
  loadCaptureDraft: shellMocks.loadDraft,
  saveCaptureDraft: shellMocks.saveDraft,
}));

vi.mock("@/lib/storagePersistence", () => ({
  requestLocalPersistence: shellMocks.requestPersistence,
}));

const parsedTaskResponse = () =>
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
  );

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
  shellMocks.clearDraft.mockReset().mockResolvedValue(undefined);
  shellMocks.loadDraft.mockReset().mockResolvedValue("");
  shellMocks.saveDraft.mockReset().mockResolvedValue(undefined);
  shellMocks.requestPersistence.mockReset().mockResolvedValue("persistent");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("opens Inbox and switches between exactly three destinations", async () => {
  const user = userEvent.setup();
  const repository = createMemoryTaskRepository();

  render(
    <TaskProvider repository={repository}>
      <AppShell />
    </TaskProvider>,
  );

  expect(screen.getByRole("heading", { name: "Вхідні" })).toBeVisible();
  expect(screen.getAllByRole("navigation")).toHaveLength(1);
  expect(
    screen.getAllByRole("button", { name: /^(Вхідні|Сьогодні|Заплановані)$/ }),
  ).toHaveLength(3);
  expect(screen.getAllByTestId("nav-icon")).toHaveLength(3);
  expect(screen.getAllByTestId("nav-icon").every((icon) => icon.querySelector("svg"))).toBe(true);
  expect(screen.getByRole("button", { name: "Сьогодні" }).querySelector("svg")).toHaveClass("lucide-sun");
  expect(screen.getByRole("button", { name: "Заплановані" }).querySelector("svg")).toHaveClass("lucide-calendar-range");

  await user.click(screen.getByRole("button", { name: "Сьогодні" }));
  expect(screen.getByRole("heading", { name: "Сьогодні" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Сьогодні" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await user.click(screen.getByRole("button", { name: "Заплановані" }));
  expect(screen.getByRole("heading", { name: "Заплановані" })).toBeVisible();
});

it("keeps Today open after saving a task with a future date", async () => {
  const user = userEvent.setup();
  render(<TaskProvider repository={createMemoryTaskRepository()}><AppShell /></TaskProvider>);

  await user.click(screen.getByRole("button", { name: "Сьогодні" }));
  await user.click(screen.getByRole("button", { name: "Додати задачу" }));
  await user.type(screen.getByLabelText("Що потрібно зробити?"), "Запланувати дзвінок");
  await user.click(within(screen.getByRole("dialog", { name: "Нова задача" })).getByRole("button", { name: "Сьогодні" }));
  fireEvent.change(screen.getByLabelText("Вибрати дату"), { target: { value: "2026-07-23" } });
  await user.click(screen.getByRole("button", { name: "Зберегти задачу" }));

  expect(await screen.findByRole("heading", { name: "Сьогодні" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Сьогодні" })).toHaveAttribute("aria-current", "page");
});

it("keeps Planned open after saving a task", async () => {
  const user = userEvent.setup();
  render(<TaskProvider repository={createMemoryTaskRepository()}><AppShell /></TaskProvider>);

  await user.click(screen.getByRole("button", { name: "Заплановані" }));
  await user.click(screen.getByRole("button", { name: "Додати задачу" }));
  await user.type(screen.getByLabelText("Що потрібно зробити?"), "Забронювати зустріч");
  await user.click(screen.getByRole("button", { name: "Зберегти задачу" }));

  expect(await screen.findByRole("heading", { name: "Заплановані" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Заплановані" })).toHaveAttribute("aria-current", "page");
});

it("opens an overflow menu before showing history", async () => {
  const user = userEvent.setup();
  render(<TaskProvider repository={createMemoryTaskRepository()}><AppShell /></TaskProvider>);
  await user.click(screen.getByRole("button", { name: "Відкрити меню" }));
  expect(screen.getByRole("menu")).toBeVisible();
  expect(screen.getByRole("menuitem", { name: "Історія" })).toBeVisible();
  expect(screen.getByRole("menuitem", { name: "Premium" })).toBeVisible();
  expect(screen.getByRole("menuitem", { name: "Налаштування" })).toBeVisible();
  expect(screen.getByRole("menuitem", { name: "Онбординг" })).toBeVisible();
  await user.click(screen.getByRole("menuitem", { name: "Історія" }));
  expect(screen.getByRole("heading", { name: "Історія" })).toBeVisible();
});

it("moves cleared completed Today tasks to history", async () => {
  const user = userEvent.setup();
  const today = new Date().toLocaleDateString("en-CA");
  const repository = createMemoryTaskRepository([
    makeTask({ id: "first", title: "Перша виконана", scheduledDate: today, scheduledTime: "09:00", status: "completed" }),
    makeTask({ id: "second", title: "Друга виконана", scheduledDate: today, scheduledTime: null, status: "completed" }),
  ]);

  render(<TaskProvider repository={repository}><AppShell /></TaskProvider>);

  await user.click(screen.getByRole("button", { name: "Сьогодні" }));
  await user.click(await screen.findByRole("button", { name: "Очистити" }));

  expect(await screen.findByText("Запиши справи на сьогодні")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Відкрити меню" }));
  await user.click(screen.getByRole("menuitem", { name: "Історія" }));
  expect(screen.getByText("Перша виконана")).toBeVisible();
  expect(screen.getByText("Друга виконана")).toBeVisible();
});

it("edits a task from its card in the shared composer", async () => {
  const user = userEvent.setup();
  const repository = createMemoryTaskRepository([makeTask({ title: "Підготувати бриф", description: "До зустрічі" })]);
  render(<TaskProvider repository={repository}><AppShell /></TaskProvider>);

  await user.click(await screen.findByRole("button", { name: "Редагувати «Підготувати бриф»" }));
  expect(screen.getByRole("dialog", { name: "Редагувати задачу" })).toBeVisible();
  expect(screen.getByLabelText("Опис задачі")).toHaveValue("До зустрічі");
  await user.clear(screen.getByLabelText("Що потрібно зробити?"));
  await user.type(screen.getByLabelText("Що потрібно зробити?"), "Оновити бриф");
  await user.click(screen.getByRole("button", { name: "Зберегти зміни" }));

  expect(await screen.findByRole("button", { name: "Редагувати «Оновити бриф»" })).toBeVisible();
});

it("dismisses the completion undo message after three seconds", async () => {
  const repository = createMemoryTaskRepository([makeTask()]);
  render(<TaskProvider repository={repository}><AppShell /></TaskProvider>);

  const completionButton = await screen.findByRole("button", { name: /Позначити.*виконаною/ });
  vi.useFakeTimers();
  await act(async () => { fireEvent.click(completionButton); await Promise.resolve(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(360); });
  expect(screen.getByRole("status", { name: "Задача виконана" })).toBeVisible();

  act(() => { vi.advanceTimersByTime(3_000); });
  expect(screen.queryByRole("status", { name: "Задача виконана" })).not.toBeInTheDocument();
});

it("announces local task hydration until the repository load settles", async () => {
  let resolveList!: () => void;
  const repository = createMemoryTaskRepository();
  repository.list = vi.fn(
    () =>
      new Promise<Awaited<ReturnType<TaskRepository["list"]>>>((resolve) => {
        resolveList = () => resolve([]);
      }),
  );

  render(
    <TaskProvider repository={repository}>
      <AppShell />
    </TaskProvider>,
  );

  expect(screen.getByRole("status", { name: "Локальні задачі" })).toHaveTextContent(
    "Завантажуємо локальні задачі",
  );

  resolveList();
  await waitFor(() =>
    expect(
      screen.queryByRole("status", { name: "Локальні задачі" }),
    ).not.toBeInTheDocument(),
  );
});

it("never starts an AI request from a same-tick offline event", async () => {
  const fetchMock = vi.fn().mockResolvedValue(parsedTaskResponse());
  vi.stubGlobal("fetch", fetchMock);
  render(
    <TaskProvider repository={createMemoryTaskRepository()}>
      <AppShell />
    </TaskProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Додати задачу" }));
  fireEvent.click(screen.getByRole("button", { name: "Записати голосом" }));

  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  act(() => {
    window.dispatchEvent(new Event("offline"));
  });

  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Розібрати" })).not.toBeInTheDocument();
});

it("requests persistence once, only after the first successful confirmation resolves", async () => {
  let resolveFirstSave!: () => void;
  const baseRepository = createMemoryTaskRepository();
  const saveMany = vi
    .fn<TaskRepository["saveMany"]>()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFirstSave = resolve;
        }),
    )
    .mockImplementation(async (tasks) => {
      await baseRepository.saveMany(tasks);
    });
  const repository: TaskRepository = { ...baseRepository, saveMany };
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => parsedTaskResponse()));
  const user = userEvent.setup();
  render(
    <TaskProvider repository={repository}>
      <AppShell />
    </TaskProvider>,
  );

  expect(shellMocks.requestPersistence).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Додати задачу" }));
  await user.type(screen.getByLabelText("Що потрібно зробити?"), "Перша нотатка");
  await user.click(screen.getByRole("button", { name: "Зберегти задачу" }));

  expect(saveMany).toHaveBeenCalledOnce();
  expect(shellMocks.requestPersistence).not.toHaveBeenCalled();

  resolveFirstSave();
  await waitFor(() =>
    expect(shellMocks.requestPersistence).toHaveBeenCalledOnce(),
  );

  await user.click(screen.getByRole("button", { name: "Додати задачу" }));
  await user.type(screen.getByLabelText("Що потрібно зробити?"), "Друга нотатка");
  await user.click(screen.getByRole("button", { name: "Зберегти задачу" }));
  await waitFor(() => expect(saveMany).toHaveBeenCalledTimes(2));

  expect(shellMocks.requestPersistence).toHaveBeenCalledOnce();
});
