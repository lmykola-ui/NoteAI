"use client";

import { useState, type FormEvent } from "react";
import { isOverdue } from "@/features/tasks/domain/dateWindow";
import {
  formatTaskSchedule,
  priorityPresentation,
} from "@/features/tasks/domain/taskPresentation";
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

function toEditableTask(task: Task): EditableTask {
  return {
    title: task.title,
    scheduledDate: task.scheduledDate,
    scheduledTime: task.scheduledTime,
    priority: task.priority,
  };
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
              <option value="">Без пріоритету</option>
              <option value="low">Мінімальна</option>
              <option value="medium">Середня</option>
              <option value="high">Висока</option>
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

  const priority = priorityPresentation(task.priority);

  return (
    <article aria-label={task.title} className="task-card">
      <button
        type="button"
        className={`task-completion task-completion--${priority.tone}`}
        aria-label={
          task.status === "active"
            ? `Позначити «${task.title}» виконаною`
            : `Відновити «${task.title}»`
        }
        onClick={() =>
          runTaskAction(task.status === "active" ? onComplete : onRestore)
        }
      />
      <div className="task-card-content">
        <div className="task-card-heading">
          <h2>{task.title}</h2>
          {task.status === "completed" ? <span>Виконано</span> : null}
        </div>
        <p className="task-meta">{formatTaskSchedule(task, today)}</p>
      </div>
      <span
        aria-label={`Пріоритет: ${priority.label}`}
        className={`priority-chevron priority-chevron--${priority.tone} priority-chevron--${priority.direction}`}
      >
        {priority.direction === "up" ? "⌃" : priority.direction === "down" ? "⌄" : "—"}
      </span>
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
        {task.status === "active" ? null : (
          <button type="button" className="secondary-button" onClick={() => runTaskAction(onRestore)}>
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
