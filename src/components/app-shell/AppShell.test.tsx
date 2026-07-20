import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TaskProvider } from "@/features/tasks/application/TaskProvider";
import type { TaskRepository } from "@/features/tasks/infrastructure/TaskRepository";
import { createMemoryTaskRepository } from "../../../tests/fixtures/memoryTaskRepository";
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
  vi.unstubAllGlobals();
});

it("opens Capture and exposes exactly three icon-only destinations", async () => {
  const user = userEvent.setup();
  const repository = createMemoryTaskRepository();

  render(
    <TaskProvider repository={repository}>
      <AppShell />
    </TaskProvider>,
  );

  const navigation = screen.getByRole("navigation", {
    name: "Основна навігація",
  });
  expect(within(navigation).getAllByRole("button")).toHaveLength(3);
  expect(screen.getByRole("button", { name: "Запис" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await user.click(screen.getByRole("button", { name: "Inbox" }));
  expect(screen.getByRole("heading", { name: "Inbox" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Inbox" }).parentElement).toHaveClass(
    "screen-enter",
  );
  expect(screen.getByRole("button", { name: "Inbox" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await user.click(screen.getByRole("button", { name: "Задачі" }));
  expect(screen.getByRole("heading", { name: "Сьогодні" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Задачі" })).toHaveAttribute(
    "aria-current",
    "page",
  );
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

  fireEvent.change(screen.getByLabelText("Ваша нотатка"), {
    target: { value: "Купити молоко" },
  });

  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  act(() => {
    window.dispatchEvent(new Event("offline"));
    fireEvent.click(screen.getByRole("button", { name: "Проаналізувати" }));
  });

  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Проаналізувати" })).toBeDisabled();
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
  await user.type(screen.getByLabelText("Ваша нотатка"), "Перша нотатка");
  await user.click(screen.getByRole("button", { name: "Проаналізувати" }));
  await user.click(await screen.findByRole("button", { name: "Додати все" }));

  expect(saveMany).toHaveBeenCalledOnce();
  expect(shellMocks.requestPersistence).not.toHaveBeenCalled();

  resolveFirstSave();
  await waitFor(() =>
    expect(shellMocks.requestPersistence).toHaveBeenCalledOnce(),
  );

  await user.type(screen.getByLabelText("Ваша нотатка"), "Друга нотатка");
  await user.click(screen.getByRole("button", { name: "Проаналізувати" }));
  await user.click(await screen.findByRole("button", { name: "Додати все" }));
  await waitFor(() => expect(saveMany).toHaveBeenCalledTimes(2));

  expect(shellMocks.requestPersistence).toHaveBeenCalledOnce();
});
