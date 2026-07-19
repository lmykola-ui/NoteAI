import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
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

it("removes a deleted task from state and the repository", async () => {
  const { repository, saved } = createRepository();
  const { result } = renderTasks(repository);

  await waitFor(() => expect(result.current.loading).toBe(false));
  await addDraft(result);
  await act(() => result.current.deleteTask(result.current.tasks[0].id));

  expect(result.current.tasks).toEqual([]);
  expect(saved).toEqual([]);
});
