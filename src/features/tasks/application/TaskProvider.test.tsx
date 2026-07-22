import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach } from "vitest";
import { makeTask } from "../../../../tests/fixtures/taskFactory";
import type { Task, TaskDraft } from "../domain/task";
import type { TaskRepository } from "../infrastructure/TaskRepository";
import { TaskProvider, useTasks } from "./TaskProvider";

const draft: TaskDraft = {
  title: "Купити молоко",
  scheduledDate: null,
  scheduledTime: null,
  status: "active",
  priority: null,
  inputMethod: "text",
};

afterEach(() => {
  vi.useRealTimers();
});

function createRepository(initial: Task[] = []) {
  const saved = [...initial];
  const repository: TaskRepository = {
    list: async () => [...saved],
    save: async (task) => {
      const index = saved.findIndex((item) => item.id === task.id);
      if (index === -1) saved.push(task);
      else saved.splice(index, 1, task);
    },
    saveMany: async (tasks) => {
      for (const task of tasks) {
        const index = saved.findIndex((item) => item.id === task.id);
        if (index === -1) saved.push(task);
        else saved.splice(index, 1, task);
      }
    },
    remove: async (id) => {
      const index = saved.findIndex((task) => task.id === id);
      if (index >= 0) saved.splice(index, 1);
    },
  };

  return { repository, saved };
}

function renderTasks(repository: TaskRepository) {
  const wrapper = ({ children }: PropsWithChildren) => (
    <TaskProvider repository={repository}>{children}</TaskProvider>
  );

  return renderHook(() => useTasks(), { wrapper });
}

async function addDraft(result: { current: ReturnType<typeof useTasks> }) {
  await act(() => result.current.addDrafts([draft]));
}

it("materializes and persists confirmed drafts", async () => {
  const { repository, saved } = createRepository();
  const { result } = renderTasks(repository);

  await waitFor(() => expect(result.current.loading).toBe(false));
  await addDraft(result);

  expect(result.current.tasks).toHaveLength(1);
  expect(saved).toHaveLength(1);
});

it("returns the task records it persists", async () => {
  const { repository } = createRepository();
  const { result } = renderTasks(repository);

  await waitFor(() => expect(result.current.loading).toBe(false));
  let created!: Task[];
  await act(async () => {
    created = await result.current.addDrafts([draft]);
  });

  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({ title: draft.title, status: "active" });
  expect(created[0]?.id).toEqual(expect.any(String));
});

it("signals offline initialization after hydrating existing tasks", async () => {
  const existingTask = makeTask({ title: "Вже збережена задача" });
  const { repository } = createRepository([existingTask]);
  const onLocalDataReady = vi.fn();
  window.addEventListener("noteai:local-data-ready", onLocalDataReady);

  const { result, unmount } = renderTasks(repository);

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.tasks).toEqual([existingTask]);
  expect(onLocalDataReady).toHaveBeenCalledOnce();

  unmount();
  window.removeEventListener("noteai:local-data-ready", onLocalDataReady);
});

it("removes only completed tasks older than 30 days during hydration", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-22T12:00:00.000Z"));
  const expired = makeTask({
    id: "expired",
    status: "completed",
    completedAt: "2026-06-22T11:59:59.999Z",
  });
  const retained = makeTask({
    id: "retained",
    status: "completed",
    completedAt: "2026-06-22T12:00:00.000Z",
  });
  const active = makeTask({ id: "active" });
  const { repository, saved } = createRepository([expired, retained, active]);
  const { result } = renderTasks(repository);

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(result.current.loading).toBe(false);
  expect(result.current.tasks).toEqual([retained, active]);
  expect(saved).toEqual([retained, active]);
});

it("clears every completed task without deleting active tasks", async () => {
  const completed = makeTask({
    id: "completed",
    status: "completed",
    completedAt: "2026-07-22T09:00:00.000Z",
  });
  const active = makeTask({ id: "active" });
  const { repository, saved } = createRepository([completed, active]);
  const { result } = renderTasks(repository);

  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(() => result.current.clearCompletedTasks());

  expect(result.current.tasks).toEqual([active]);
  expect(saved).toEqual([active]);
});

it("keeps drafts added before a stale initial load resolves", async () => {
  const { repository, saved } = createRepository();
  let resolveList!: (tasks: Task[]) => void;
  repository.list = () =>
    new Promise<Task[]>((resolve) => {
      resolveList = resolve;
    });
  const { result } = renderTasks(repository);

  await addDraft(result);
  await act(async () => resolveList([]));

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.tasks).toHaveLength(1);
  expect(saved).toHaveLength(1);
});

it("persists a completed task", async () => {
  const { repository, saved } = createRepository();
  const { result } = renderTasks(repository);

  await waitFor(() => expect(result.current.loading).toBe(false));
  await addDraft(result);
  await act(() => result.current.completeTask(result.current.tasks[0].id));

  expect(result.current.tasks[0]).toMatchObject({ status: "completed" });
  expect(result.current.tasks[0].completedAt).not.toBeNull();
  expect(saved[0]).toEqual(result.current.tasks[0]);
});

it("persists a restored task", async () => {
  const { repository, saved } = createRepository();
  const { result } = renderTasks(repository);

  await waitFor(() => expect(result.current.loading).toBe(false));
  await addDraft(result);
  await act(() => result.current.completeTask(result.current.tasks[0].id));
  await act(() => result.current.restoreTask(result.current.tasks[0].id));

  expect(result.current.tasks[0]).toMatchObject({
    status: "active",
    completedAt: null,
  });
  expect(saved[0]).toEqual(result.current.tasks[0]);
});

it("persists a direct task edit before exposing it in provider state", async () => {
  const existing = makeTask({ title: "Стара назва" });
  const { repository, saved } = createRepository([existing]);
  const save = vi.fn(repository.save);
  const { result } = renderTasks({ ...repository, save });

  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(() =>
    result.current.updateTask({
      ...existing,
      title: "Нова назва",
      scheduledDate: "2026-07-20",
    }),
  );

  expect(save).toHaveBeenCalledOnce();
  expect(saved[0]).toMatchObject({
    title: "Нова назва",
    scheduledDate: "2026-07-20",
  });
  expect(result.current.tasks[0]).toEqual(saved[0]);
});

it("removes a deleted task from state and the repository", async () => {
  const { repository, saved } = createRepository();
  const { result } = renderTasks(repository);

  await waitFor(() => expect(result.current.loading).toBe(false));
  await addDraft(result);
  await act(() => result.current.deleteTask(result.current.tasks[0].id));

  expect(result.current.tasks).toEqual([]);
  expect(saved).toEqual([]);
});

it("persists a manual Inbox order without changing task details", async () => {
  const first = makeTask({ id: "first", inboxOrder: 0 });
  const second = makeTask({ id: "second", inboxOrder: 1 });
  const { repository, saved } = createRepository([first, second]);
  const saveMany = vi.fn(repository.saveMany);
  const { result } = renderTasks({ ...repository, saveMany });

  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(() => result.current.reorderInboxTasks(["second", "first"]));

  expect(saveMany).toHaveBeenCalledWith([
    expect.objectContaining({ id: "second", inboxOrder: 0 }),
    expect.objectContaining({ id: "first", inboxOrder: 1 }),
  ]);
  expect(saved.map((task) => [task.id, task.inboxOrder])).toEqual([
    ["first", 1],
    ["second", 0],
  ]);
  expect(result.current.tasks.map((task) => [task.id, task.inboxOrder])).toEqual([
    ["first", 1],
    ["second", 0],
  ]);
});
