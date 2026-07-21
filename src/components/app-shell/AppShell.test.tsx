import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  await user.click(screen.getByRole("button", { name: "Сьогодні" }));
  expect(screen.getByRole("heading", { name: "Сьогодні" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Сьогодні" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await user.click(screen.getByRole("button", { name: "Заплановані" }));
  expect(screen.getByRole("heading", { name: "Заплановані" })).toBeVisible();
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
  fireEvent.change(screen.getByLabelText("Ваша нотатка"), {
    target: { value: "Купити молоко" },
  });

  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  act(() => {
    window.dispatchEvent(new Event("offline"));
    fireEvent.click(screen.getByRole("button", { name: "Розібрати" }));
  });

  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Розібрати" })).toBeDisabled();
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
  await user.click(screen.getByRole("button", { name: "Записати голосом" }));
  await user.type(screen.getByLabelText("Ваша нотатка"), "Перша нотатка");
  await user.click(screen.getByRole("button", { name: "Розібрати" }));
  await user.click(await screen.findByRole("button", { name: "Додати все" }));

  expect(saveMany).toHaveBeenCalledOnce();
  expect(shellMocks.requestPersistence).not.toHaveBeenCalled();

  resolveFirstSave();
  await waitFor(() =>
    expect(shellMocks.requestPersistence).toHaveBeenCalledOnce(),
  );

  await user.click(screen.getByRole("button", { name: "Додати задачу" }));
  await user.click(screen.getByRole("button", { name: "Записати голосом" }));
  await user.type(screen.getByLabelText("Ваша нотатка"), "Друга нотатка");
  await user.click(screen.getByRole("button", { name: "Розібрати" }));
  await user.click(await screen.findByRole("button", { name: "Додати все" }));
  await waitFor(() => expect(saveMany).toHaveBeenCalledTimes(2));

  expect(shellMocks.requestPersistence).toHaveBeenCalledOnce();
});
