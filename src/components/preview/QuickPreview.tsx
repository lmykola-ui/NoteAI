"use client";

import { useState } from "react";
import type {
  TaskDraft,
  TaskPriority,
  TaskStatus,
} from "@/features/tasks/domain/task";

type QuickPreviewProps = {
  initialTasks: TaskDraft[];
  clarification: string | null;
  confirmationError?: string | null;
  storageError?: string | null;
  onCancel(): void;
  onConfirm(tasks: TaskDraft[]): Promise<void>;
};

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: "active", label: "Активна" },
  { value: "completed", label: "Виконана" },
];

const priorityOptions: Array<{ value: TaskPriority; label: string }> = [
  { value: "low", label: "Низький" },
  { value: "medium", label: "Середній" },
  { value: "high", label: "Високий" },
];

export function QuickPreview({
  initialTasks,
  clarification,
  confirmationError = null,
  storageError = null,
  onCancel,
  onConfirm,
}: QuickPreviewProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [isConfirming, setIsConfirming] = useState(false);
  const validTasks = tasks.filter((task) => task.title.trim().length > 0);
  const hasUnresolvedClarification = clarification !== null;

  function updateTask(index: number, patch: Partial<TaskDraft>) {
    setTasks((current) =>
      current.map((task, taskIndex) =>
        taskIndex === index ? { ...task, ...patch } : task,
      ),
    );
  }

  function removeTask(index: number) {
    setTasks((current) => current.filter((_, taskIndex) => taskIndex !== index));
  }

  async function confirm() {
    if (validTasks.length === 0 || hasUnresolvedClarification || isConfirming) {
      return;
    }

    setIsConfirming(true);
    try {
      await onConfirm(validTasks);
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <section aria-label="Попередній перегляд задач" className="quick-preview">
      <div className="preview-heading">
        <h2>Перевірте задачі</h2>
        <button type="button" className="secondary-button" onClick={onCancel}>
          Назад
        </button>
      </div>

      {clarification ? (
        <p className="clarification" role="status">
          {clarification}
        </p>
      ) : null}

      {confirmationError ? (
        <p className="capture-error" role="alert">
          {confirmationError}
        </p>
      ) : null}

      {storageError ? (
        <p className="capture-error" role="alert">
          {storageError}
        </p>
      ) : null}

      <div className="preview-cards">
        {tasks.map((task, index) => (
          <article className="preview-card" key={index}>
            <label>
              Назва задачі
              <input
                value={task.title}
                onChange={(event) => updateTask(index, { title: event.target.value })}
              />
            </label>
            <label>
              Дата
              <input
                type="date"
                value={task.scheduledDate ?? ""}
                onChange={(event) =>
                  updateTask(index, { scheduledDate: event.target.value || null })
                }
              />
            </label>
            <label>
              Час
              <input
                type="time"
                value={task.scheduledTime ?? ""}
                onChange={(event) =>
                  updateTask(index, { scheduledTime: event.target.value || null })
                }
              />
            </label>
            <label>
              Статус
              <select
                value={task.status}
                onChange={(event) =>
                  updateTask(index, { status: event.target.value as TaskStatus })
                }
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Пріоритет
              <select
                value={task.priority ?? ""}
                onChange={(event) =>
                  updateTask(index, {
                    priority: (event.target.value || null) as TaskPriority | null,
                  })
                }
              >
                <option value="">Не вказано</option>
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="secondary-button"
              onClick={() => removeTask(index)}
            >
              Видалити пропозицію
            </button>
          </article>
        ))}
      </div>

      <button
        type="button"
        className="primary-button"
        disabled={
          validTasks.length === 0 || hasUnresolvedClarification || isConfirming
        }
        aria-label={
          confirmationError
            ? "Спробувати зберегти задачі ще раз"
            : undefined
        }
        onClick={confirm}
      >
        {confirmationError ? "Спробувати ще раз" : "Додати все"}
      </button>
    </section>
  );
}
