"use client";

import { useState } from "react";
import { addLocalDays } from "@/features/tasks/domain/dateWindow";
import type { Task } from "@/features/tasks/domain/task";
import { PeriodMenu, type PlanPeriod } from "./PeriodMenu";
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
  const [period, setPeriod] = useState<PlanPeriod>("today");
  const dates = Array.from({ length: 7 }, (_, index) => addLocalDays(today, index));
  const activeTasks = tasks
    .filter((task) => task.status === "active")
    .sort(comparePlanTasks);
  const todayTasks = activeTasks.filter((task) => task.scheduledDate === today);

  return (
    <section className="task-screen" aria-label="План">
      <div className="plan-header">
        <h1>{period === "today" ? "Сьогодні" : "Тиждень"}</h1>
        <PeriodMenu value={period} onChange={setPeriod} />
      </div>

      {period === "today" ? (
        todayTasks.length ? (
          <div className="task-list period-content-enter">
            {todayTasks.map((task) => (
              <TaskCard key={task.id} task={task} today={today} {...actions} />
            ))}
          </div>
        ) : (
          <p className="empty-state period-content-enter">
            На сьогодні задач немає.
          </p>
        )
      ) : (
        <div className="week-list period-content-enter">
          {dates.map((date) => {
            const dayTasks = activeTasks.filter(
              (task) => task.scheduledDate === date,
            );
            return (
              <section
                key={date}
                className="week-day"
                role="group"
                aria-label={`День ${formatPlanDate(date)}`}
              >
                <h2>{date === today ? "Сьогодні" : formatPlanDate(date)}</h2>
                {dayTasks.length ? (
                  <div className="task-list">
                    {dayTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        today={today}
                        {...actions}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="week-empty">Немає задач</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
