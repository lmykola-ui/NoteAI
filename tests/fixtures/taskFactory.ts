import type { Task } from "@/features/tasks/domain/task";

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Купити молоко",
    scheduledDate: null,
    scheduledTime: null,
    status: "active",
    priority: null,
    inputMethod: "text",
    createdAt: "2026-07-19T10:00:00.000Z",
    updatedAt: "2026-07-19T10:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}
