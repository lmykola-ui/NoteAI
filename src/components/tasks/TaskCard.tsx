"use client";

import { useState, type FormEvent } from "react";
import { isOverdue } from "@/features/tasks/domain/dateWindow";
import type { Task, TaskPriority } from "@/features/tasks/domain/task";
import { AppIcon } from "@/components/icons/AppIcon";

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

function priorityPresentation(priority: TaskPriority | null) {
  if (priority === "high") {
    return { className: "priority-high", label: "Високий пріоритет" };
  }
  if (priority === "medium") {
    return { className: "priority-medium", label: "Середній пріоритет" };
  }
  return { className: "priority-normal", label: "Звичайний пріоритет" };
}

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
  const priority = priorityPresentation(task.priority);
  const priorityDescriptionId = `task-priority-${task.id}`;

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
      <article
        aria-label={task.title}
        aria-describedby={priorityDescriptionId}
        className={`task-card ${priority.className}`}
      >
        <span id={priorityDescriptionId} className="sr-only">
          {priority.label}
        </span>
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
    <article
      aria-label={task.title}
      aria-describedby={priorityDescriptionId}
      className={`task-card ${priority.className}`}
    >
      <span id={priorityDescriptionId} className="sr-only">
        {priority.label}
      </span>
      <div className="task-card-heading">
        <h2>{task.title}</h2>
        {task.status === "completed" ? <span>Виконано</span> : null}
      </div>
      <p className="task-meta">
        {task.scheduledDate ? formatDate(task.scheduledDate) : "Без дати"}
        {task.scheduledTime ? ` · ${task.scheduledTime}` : ""}
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
        <button
          type="button"
          className="task-icon-button"
          aria-label="Редагувати задачу"
          title="Редагувати"
          onClick={startEditing}
        >
          <AppIcon name="edit" size={18} decorative />
        </button>
        {task.status === "active" ? (
          <button
            type="button"
            className="task-icon-button"
            aria-label="Позначити виконаною"
            title="Виконано"
            onClick={() => runTaskAction(onComplete)}
          >
            <AppIcon name="check" size={18} decorative />
          </button>
        ) : (
          <button
            type="button"
            className="task-icon-button"
            aria-label="Відновити задачу"
            title="Відновити"
            onClick={() => runTaskAction(onRestore)}
          >
            <AppIcon name="retry" size={18} decorative />
          </button>
        )}
        <button
          type="button"
          className="task-icon-button task-delete-button"
          aria-label="Видалити задачу"
          title="Видалити"
          onClick={() => runTaskAction(onDelete)}
        >
          <AppIcon name="trash" size={18} decorative />
        </button>
      </div>
    </article>
  );
}
