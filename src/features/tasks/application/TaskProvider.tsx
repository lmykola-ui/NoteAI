"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { materializeTask, type Task, type TaskDraft } from "../domain/task";
import { indexedDbTaskRepository } from "../infrastructure/IndexedDbTaskRepository";
import type { TaskRepository } from "../infrastructure/TaskRepository";

type TaskContextValue = {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  addDrafts(drafts: TaskDraft[]): Promise<void>;
  updateTask(task: Task): Promise<void>;
  completeTask(id: string): Promise<void>;
  restoreTask(id: string): Promise<void>;
  deleteTask(id: string): Promise<void>;
};

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({
  children,
  repository = indexedDbTaskRepository,
}: PropsWithChildren<{ repository?: TaskRepository }>) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    repository
      .list()
      .then((loaded) => setTasks([...loaded]))
      .catch(() => setError("Не вдалося відкрити локальні задачі"))
      .finally(() => setLoading(false));
  }, [repository]);

  const value = useMemo<TaskContextValue>(() => {
    async function persistUpdate(task: Task): Promise<void> {
      const updated = { ...task, updatedAt: new Date().toISOString() };
      await repository.save(updated);
      setTasks((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    }

    return {
      tasks,
      loading,
      error,
      async addDrafts(drafts) {
        const created = drafts.map((draft) => materializeTask(draft));
        await repository.saveMany(created);
        setTasks((current) => [...current, ...created]);
      },
      async updateTask(task) {
        await persistUpdate(task);
      },
      async completeTask(id) {
        const task = tasks.find((item) => item.id === id);
        if (!task) return;

        const now = new Date().toISOString();
        await persistUpdate({ ...task, status: "completed", completedAt: now });
      },
      async restoreTask(id) {
        const task = tasks.find((item) => item.id === id);
        if (!task) return;

        await persistUpdate({ ...task, status: "active", completedAt: null });
      },
      async deleteTask(id) {
        await repository.remove(id);
        setTasks((current) => current.filter((task) => task.id !== id));
      },
    };
  }, [repository, tasks, loading, error]);

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks(): TaskContextValue {
  const value = useContext(TaskContext);
  if (!value) throw new Error("useTasks must be used inside TaskProvider");
  return value;
}
