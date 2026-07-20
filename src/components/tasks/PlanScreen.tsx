"use client";

import { useState } from "react";
import { addLocalDays } from "@/features/tasks/domain/dateWindow";
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

function formatPlanDate(date: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}

export function PlanScreen({ tasks, today, ...actions }: PlanScreenProps) {
  const [storedSelectedDate, setSelectedDate] = useState(today);
  const dates = Array.from({ length: 7 }, (_, index) => addLocalDays(today, index));
  const selectedDate = dates.includes(storedSelectedDate)
    ? storedSelectedDate
    : today;

  const selectedTasks = tasks
    .filter(
      (task) => task.status === "active" && task.scheduledDate === selectedDate,
    )
    .sort(comparePlanTasks);

  return (
    <section className="task-screen" aria-label="План">
      <h1>План</h1>
      <div className="plan-dates" aria-label="Сім днів">
        {dates.map((date) => (
          <button
            key={date}
            type="button"
            className="plan-date-button"
            aria-label={`Обрати ${formatPlanDate(date)}`}
            aria-pressed={selectedDate === date}
            onClick={() => setSelectedDate(date)}
          >
            {formatPlanDate(date)}
          </button>
        ))}
      </div>
      {selectedTasks.length ? (
        <div className="task-list">
          {selectedTasks.map((task) => (
            <TaskCard key={task.id} task={task} today={today} {...actions} />
          ))}
        </div>
      ) : (
        <p className="empty-state">На цей день задач немає.</p>
      )}
    </section>
  );
}
