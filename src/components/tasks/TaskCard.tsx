"use client";

import { useState, type FormEvent } from "react";
import { isOverdue } from "@/features/tasks/domain/dateWindow";
import type { Task, TaskPriority } from "@/features/tasks/domain/task";

type TaskCardProps = {
  task: Task;
  today: string;
  onChange(task: Task): void | Promise<void>;
  onComplete(id: string): void | Promise<void>;
  onRestore(id: string): void | Promise<void>;
  onDelete(id: string): void | Promise<void>;
};

type EditableTask = Pick<
  Task,
  "title" | "scheduledDate" | "scheduledTime" | "priority"
>;

type TaskAction = (id: string) => void | Promise<void>;

const priorityLabels: Record<NonNullable<TaskPriority>, string> = {
  low: "Низький",
  medium: "Середній",
  high: "Високий",
};

function toEditableTask(task: Task): EditableTask {
  return {
    title: task.title,
    scheduledDate: task.scheduledDate,
    scheduledTime: task.scheduledTime,
    priority: task.priority,
  };
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}

export function TaskCard({
  task,
  today,
  onChange,
  onComplete,
  onRestore,
  onDelete,
}: TaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditableTask>(() => toEditableTask(task));
  const [mutationError, setMutationError] = useState<string | null>(null);

  function startEditing() {
    setMutationError(null);
    setDraft(toEditableTask(task));
    setEditing(true);
  }

  async function saveChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMutationError(null);

    try {
      await onChange({ ...task, ...draft });
      setEditing(false);
    } catch {
      setMutationError("Не вдалося зберегти зміни. Спробуйте ще раз.");
    }
  }

  async function runTaskAction(action: TaskAction) {
    setMutationError(null);

    try {
      await action(task.id);
    } catch {
      setMutationError("Не вдалося оновити задачу. Спробуйте ще раз.");
    }
  }

  if (editing) {
    return (
      <article aria-label={task.title} className="task-card">
        <form className="task-edit-form" onSubmit={saveChanges}>
          {mutationError ? (
            <p role="alert" className="capture-error">
              {mutationError}
            </p>
          ) : null}
          <label>
            Назва задачі
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
              required
            />
          </label>
          <label>
            Дата
            <input
              type="date"
              value={draft.scheduledDate ?? ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  scheduledDate: event.target.value || null,
                }))
              }
            />
          </label>
          <label>
            Час
            <input
              type="time"
              value={draft.scheduledTime ?? ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  scheduledTime: event.target.value || null,
                }))
              }
            />
          </label>
          <label>
            Пріоритет
            <select
              value={draft.priority ?? ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  priority: (event.target.value || null) as TaskPriority | null,
                }))
              }
            >
              <option value="">Не вказано</option>
              <option value="low">Низький</option>
              <option value="medium">Середній</option>
              <option value="high">Високий</option>
            </select>
          </label>
          <div className="task-card-actions">
            <button type="submit" className="primary-button">
              Зберегти зміни
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setEditing(false)}
            >
              Скасувати
            </button>
          </div>
        </form>
      </article>
    );
  }

  return (
    <article aria-label={task.title} className="task-card">
      <div className="task-card-heading">
        <h2>{task.title}</h2>
        {task.status === "completed" ? <span>Виконано</span> : null}
      </div>
      <p className="task-meta">
        {task.scheduledDate ? `Дата: ${formatDate(task.scheduledDate)}` : "Без дати"}
        {task.scheduledTime ? ` · ${task.scheduledTime}` : ""}
      </p>
      <p className="task-meta">
        Пріоритет: {task.priority ? priorityLabels[task.priority] : "не вказано"}
      </p>
      {task.status === "active" && isOverdue(task.scheduledDate, today) ? (
        <p className="task-overdue">Прострочено</p>
      ) : null}
      {mutationError ? (
        <p role="alert" className="capture-error">
          {mutationError}
        </p>
      ) : null}
      <div className="task-card-actions">
        <button type="button" className="secondary-button" onClick={startEditing}>
          Редагувати задачу
        </button>
        {task.status === "active" ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => runTaskAction(onComplete)}
          >
            Позначити виконаною
          </button>
        ) : (
          <button
            type="button"
            className="secondary-button"
            onClick={() => runTaskAction(onRestore)}
          >
            Відновити задачу
          </button>
        )}
        <button
          type="button"
          className="secondary-button"
          onClick={() => runTaskAction(onDelete)}
        >
          Видалити задачу
        </button>
      </div>
    </article>
  );
}
