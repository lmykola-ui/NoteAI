"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { Task } from "@/features/tasks/domain/task";
import { TaskCard } from "./TaskCard";

type PlanScreenProps = {
  tasks: Task[];
  today: string;
  onComplete(id: string): void | Promise<void>;
  onRestore(id: string): void | Promise<void>;
  onEdit?(task: Task): void;
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
  const [revealedDate, setRevealedDate] = useState<string | null>(null);
  const selectedTasks = useMemo(() => tasks
    .filter(
      (task) => task.scheduledDate === today,
    )
    .sort(comparePlanTasks), [tasks, today]);
  const completedCount = selectedTasks.filter((task) => task.status === "completed").length;
  const progress = selectedTasks.length ? Math.round((completedCount / selectedTasks.length) * 100) : 0;
  const allComplete = selectedTasks.length > 0 && completedCount === selectedTasks.length;
  const showCompleted = revealedDate === today;
  const cat = progress <= 25
    ? { src: "/progress-cats/0-25.png", label: "Емоція прогресу: 0–25%" }
    : progress <= 50
      ? { src: "/progress-cats/26-50.png", label: "Емоція прогресу: 26–50%" }
      : progress < 100
        ? { src: "/progress-cats/51-99.png", label: "Емоція прогресу: 51–99%" }
        : { src: "/progress-cats/100.png", label: "Емоція прогресу: 100%" };

  return (
    <section className="task-screen" aria-label="Сьогодні">
      <h1>Сьогодні</h1>
      {selectedTasks.length ? (
        <>
          {allComplete ? (
            <section className="today-celebration" aria-live="polite">
              <Image className="today-celebration-cat" src={cat.src} alt="" aria-hidden="true" width={92} height={92} />
              <div>
                <h2>Вітаємо!</h2>
                <p>Сьогодні всі плани виконані</p>
              </div>
            </section>
          ) : (
            <section className="today-status" aria-label={`Виконано ${progress}% задач на сьогодні`}>
              <div className="today-progress-panel">
                <strong>{progress}%</strong>
                <div className="today-progress-track" aria-hidden="true">
                  <span className="today-progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="today-emotion-panel">
                <Image className="today-emotion-cat" src={cat.src} alt={cat.label} width={82} height={82} />
              </div>
            </section>
          )}

          {(!allComplete || showCompleted) ? (
            <div role={allComplete ? "list" : undefined} aria-label={allComplete ? "Виконані задачі сьогодні" : undefined} className="task-list today-task-list">
              {selectedTasks.map((task) => (
                <TaskCard key={task.id} task={task} today={today} {...actions} />
              ))}
            </div>
          ) : null}

          {allComplete ? (
            <button type="button" className="today-completed-toggle" onClick={() => setRevealedDate((value) => value === today ? null : today)}>
              {showCompleted ? `Сховати виконані (${completedCount})` : `Показати виконані (${completedCount})`}
            </button>
          ) : null}
        </>
      ) : (
        <p className="empty-state">На сьогодні задач немає.</p>
      )}
    </section>
  );
}
