import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import type { TaskRepository } from "../infrastructure/TaskRepository";
import { TaskProvider, useTasks } from "./TaskProvider";

const saved: Awaited<ReturnType<TaskRepository["list"]>> = [];
const repository: TaskRepository = {
  list: async () => saved,
  save: async (task) => {
    const index = saved.findIndex((item) => item.id === task.id);
    if (index === -1) saved.push(task);
    else saved.splice(index, 1, task);
  },
  saveMany: async (tasks) => {
    saved.push(...tasks);
  },
  remove: async (id) => {
    const index = saved.findIndex((task) => task.id === id);
    if (index >= 0) saved.splice(index, 1);
  },
};

it("materializes and persists confirmed drafts", async () => {
  const wrapper = ({ children }: PropsWithChildren) => (
    <TaskProvider repository={repository}>{children}</TaskProvider>
  );
  const { result } = renderHook(() => useTasks(), { wrapper });

  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(() =>
    result.current.addDrafts([
      {
        title: "Купити молоко",
        scheduledDate: null,
        scheduledTime: null,
        status: "active",
        priority: null,
        inputMethod: "text",
      },
    ]),
  );

  expect(result.current.tasks).toHaveLength(1);
  expect(saved).toHaveLength(1);
});
