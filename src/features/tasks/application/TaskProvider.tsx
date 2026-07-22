"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { materializeTask, type Task, type TaskDraft } from "../domain/task";
import { expiredCompletedTaskIds } from "../domain/historyRetention";
import { indexedDbTaskRepository } from "../infrastructure/IndexedDbTaskRepository";
import type { TaskRepository } from "../infrastructure/TaskRepository";

type TaskContextValue = {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  addDrafts(drafts: TaskDraft[]): Promise<Task[]>;
  updateTask(task: Task): Promise<void>;
  completeTask(id: string): Promise<void>;
  restoreTask(id: string): Promise<void>;
  deleteTask(id: string): Promise<void>;
  clearCompletedTasks(): Promise<void>;
  reorderInboxTasks(ids: string[]): Promise<void>;
};

const TaskContext = createContext<TaskContextValue | null>(null);

type PendingMutation =
  | { type: "add"; tasks: Task[] }
  | { type: "upsert"; task: Task }
  | { type: "delete"; id: string };

function applyPendingMutations(
  loaded: Task[],
  mutations: PendingMutation[],
): Task[] {
  return mutations.reduce<Task[]>((current, mutation) => {
    if (mutation.type === "add") {
      const addedIds = new Set(mutation.tasks.map((task) => task.id));
      return [
        ...current.filter((task) => !addedIds.has(task.id)),
        ...mutation.tasks,
      ];
    }

    if (mutation.type === "upsert") {
      const index = current.findIndex((task) => task.id === mutation.task.id);
      if (index === -1) return [...current, mutation.task];

      return current.map((task) =>
        task.id === mutation.task.id ? mutation.task : task,
      );
    }

    return current.filter((task) => task.id !== mutation.id);
  }, [...loaded]);
}

async function removeTaskIds(
  repository: TaskRepository,
  ids: string[],
): Promise<{ removedIds: string[]; failed: boolean }> {
  const results = await Promise.allSettled(ids.map((id) => repository.remove(id)));
  const removedIds = ids.filter((_, index) => results[index]?.status === "fulfilled");

  return {
    removedIds,
    failed: results.some((result) => result.status === "rejected"),
  };
}

export function TaskProvider({
  children,
  repository = indexedDbTaskRepository,
}: PropsWithChildren<{ repository?: TaskRepository }>) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadComplete = useRef(false);
  const pendingMutations = useRef<PendingMutation[]>([]);

  useEffect(() => {
    let cancelled = false;
    initialLoadComplete.current = false;
    pendingMutations.current = [];

    repository
      .list()
      .then(async (loaded) => {
        if (cancelled) return;

        const hydrated = applyPendingMutations(loaded, pendingMutations.current);
        const { removedIds } = await removeTaskIds(
          repository,
          expiredCompletedTaskIds(hydrated, new Date()),
        );
        if (cancelled) return;

        removedIds.forEach((id) => {
          pendingMutations.current.push({ type: "delete", id });
        });
        const retained = applyPendingMutations(loaded, pendingMutations.current);
        setTasks(retained);
        initialLoadComplete.current = true;
        pendingMutations.current = [];
        if (retained.length > 0) {
          window.dispatchEvent(new Event("noteai:local-data-ready"));
        }
      })
      .catch(() => {
        if (!cancelled) setError("Не вдалося відкрити локальні задачі");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [repository]);

  const value = useMemo<TaskContextValue>(() => {
    async function persistUpdate(task: Task): Promise<void> {
      const updated = { ...task, updatedAt: new Date().toISOString() };
      await repository.save(updated);
      if (!initialLoadComplete.current) {
        pendingMutations.current.push({ type: "upsert", task: updated });
      }
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
        if (!initialLoadComplete.current) {
          pendingMutations.current.push({ type: "add", tasks: created });
        }
        setTasks((current) => [...current, ...created]);
        return created;
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
        if (!initialLoadComplete.current) {
          pendingMutations.current.push({ type: "delete", id });
        }
        setTasks((current) => current.filter((task) => task.id !== id));
      },
      async clearCompletedTasks() {
        const completedIds = tasks
          .filter((task) => task.status === "completed")
          .map((task) => task.id);
        const { removedIds, failed } = await removeTaskIds(repository, completedIds);
        const removedIdSet = new Set(removedIds);

        if (!initialLoadComplete.current) {
          removedIds.forEach((id) => {
            pendingMutations.current.push({ type: "delete", id });
          });
        }
        setTasks((current) => current.filter((task) => !removedIdSet.has(task.id)));

        if (failed) throw new Error("Не вдалося очистити історію");
      },
      async reorderInboxTasks(ids) {
        const orderById = new Map(ids.map((id, index) => [id, index]));
        const taskById = new Map(tasks.map((task) => [task.id, task]));
        const reordered = ids.flatMap((id) => {
          const task = taskById.get(id);
          if (!task) return [];

          return [{
            ...task,
            inboxOrder: orderById.get(id) ?? null,
            updatedAt: new Date().toISOString(),
          }];
        });

        await repository.saveMany(reordered);
        setTasks((current) =>
          current.map((task) =>
            reordered.find((updated) => updated.id === task.id) ?? task,
          ),
        );
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
