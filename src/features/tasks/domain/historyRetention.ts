import type { Task } from "./task";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function expiredCompletedTaskIds(tasks: Task[], now: Date): string[] {
  const cutoff = now.getTime() - RETENTION_MS;

  return tasks.flatMap((task) =>
    task.status === "completed" &&
    task.completedAt !== null &&
    new Date(task.completedAt).getTime() < cutoff
      ? [task.id]
      : [],
  );
}
