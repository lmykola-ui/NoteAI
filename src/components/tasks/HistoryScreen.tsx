"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Task } from "@/features/tasks/domain/task";
import { TaskCard } from "./TaskCard";

type HistoryScreenProps = {
  tasks: Task[];
  today: string;
  onRestore(id: string): void | Promise<void>;
  onClose(): void;
  onClear(): Promise<void>;
};

export function HistoryScreen({
  tasks,
  today,
  onRestore,
  onClose,
  onClear,
}: HistoryScreenProps) {
  const completed = tasks.filter((task) => task.status === "completed");
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState(false);

  async function clearHistory() {
    setClearing(true);
    setClearError(false);

    try {
      await onClear();
      setConfirming(false);
    } catch {
      setClearError(true);
    } finally {
      setClearing(false);
    }
  }

  return (
    <section className="task-screen" aria-label="Історія">
      <div className="history-heading">
        <button type="button" className="history-back" onClick={onClose}>
          Назад
        </button>
        <h1>Історія</h1>
        <button
          type="button"
          className="history-clear-button"
          aria-label="Очистити історію"
          disabled={!completed.length}
          onClick={() => {
            setClearError(false);
            setConfirming(true);
          }}
        >
          <Trash2 size={19} strokeWidth={2.1} aria-hidden="true" />
        </button>
      </div>
      {completed.length ? (
        <div className="task-list">
          {completed.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              today={today}
              onComplete={() => undefined}
              onRestore={onRestore}
            />
          ))}
        </div>
      ) : (
        <p className="empty-state">Виконаних задач ще немає.</p>
      )}
      {confirming ? (
        <div className="history-confirm-backdrop" onMouseDown={() => setConfirming(false)}>
          <section
            className="history-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Очистити історію"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2>Очистити історію?</h2>
            <p>Видалити всі завершені задачі з історії? Цю дію не можна скасувати.</p>
            {clearError ? <p role="alert" className="capture-error">Не вдалося очистити історію. Спробуйте ще раз.</p> : null}
            <div className="history-confirm-actions">
              <button type="button" className="secondary-button" disabled={clearing} onClick={() => setConfirming(false)}>
                Скасувати
              </button>
              <button type="button" className="history-confirm-delete" disabled={clearing} onClick={() => void clearHistory()}>
                Очистити
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
