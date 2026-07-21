"use client";

import type { Task } from "@/features/tasks/domain/task";
import { TaskCard } from "./TaskCard";

type PlanScreenProps = {
  tasks: Task[];
  today: string;
  onChange(task: Task): void | Promise<void>;
  onComplete(id: string): void | Promise<void>;
  onRestore(id: string): void | Promise<void>;
  onDelete(id: string): void | Promise<void>;
};

export function comparePlanTasks(a: Task, b: Task): number {
  if (a.scheduledTime && b.scheduledTime) {
    return a.scheduledTime.localeCompare(b.scheduledTime);
  }
  if (a.scheduledTime) return -1;
  if (b.scheduledTime) return 1;
  return a.createdAt.localeCompare(b.createdAt);
}

export function PlanScreen({ tasks, today, ...actions }: PlanScreenProps) {
  const selectedTasks = tasks
    .filter(
      (task) => task.status === "active" && task.scheduledDate === today,
    )
    .sort(comparePlanTasks);

  return (
    <section className="task-screen" aria-label="Сьогодні">
      <h1>Сьогодні</h1>
      {selectedTasks.length ? (
        <div className="task-list">
          {selectedTasks.map((task) => (
            <TaskCard key={task.id} task={task} today={today} {...actions} />
          ))}
        </div>
      ) : (
        <p className="empty-state">На сьогодні задач немає.</p>
      )}
    </section>
  );
}
