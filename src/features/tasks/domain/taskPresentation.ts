import { addLocalDays } from "./dateWindow";
import type { Task, TaskPriority } from "./task";

export type PriorityPresentation = {
  label: string;
  tone: "high" | "medium" | "minimal" | "none";
  direction: "highest" | "up" | "flat" | "down";
};

export function priorityPresentation(
  priority: TaskPriority | null,
): PriorityPresentation {
  if (priority === "high") {
    return { label: "Висока", tone: "high", direction: "highest" };
  }
  if (priority === "medium") {
    return { label: "Середня", tone: "medium", direction: "up" };
  }
  if (priority === "low") {
    return { label: "Мінімальна", tone: "minimal", direction: "down" };
  }
  return { label: "Без пріоритету", tone: "none", direction: "flat" };
}

export function formatTaskSchedule(
  task: Pick<Task, "scheduledDate" | "scheduledTime">,
  today: string,
): string {
  if (!task.scheduledDate) return "Без терміну";

  const day =
    task.scheduledDate === today
      ? "Сьогодні"
      : task.scheduledDate === addLocalDays(today, 1)
        ? "Завтра"
        : new Intl.DateTimeFormat("uk-UA", {
            day: "numeric",
            month: "long",
          }).format(new Date(`${task.scheduledDate}T12:00:00`));

  return task.scheduledTime ? `${day} · ${task.scheduledTime}` : day;
}
