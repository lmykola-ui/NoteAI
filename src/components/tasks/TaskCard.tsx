"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock, Check, ChevronDown, ChevronUp, ChevronsUp, Minus } from "lucide-react";
import { isOverdue } from "@/features/tasks/domain/dateWindow";
import { formatTaskSchedule, priorityPresentation } from "@/features/tasks/domain/taskPresentation";
import type { Task } from "@/features/tasks/domain/task";

type TaskCardProps = {
  task: Task;
  today: string;
  onComplete(id: string): void | Promise<void>;
  onRestore(id: string): void | Promise<void>;
  onCompletionAnimationEnd?(id: string): void | Promise<void>;
  onEdit?(task: Task): void;
};

export function TaskCard({ task, today, onComplete, onRestore, onCompletionAnimationEnd, onEdit }: TaskCardProps) {
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const completionTimeoutRef = useRef<number | null>(null);
  const priority = priorityPresentation(task.priority);
  const PriorityIcon = priority.direction === "highest" ? ChevronsUp : priority.direction === "up" ? ChevronUp : priority.direction === "down" ? ChevronDown : Minus;

  useEffect(() => () => {
    if (completionTimeoutRef.current !== null) {
      window.clearTimeout(completionTimeoutRef.current);
    }
  }, []);

  async function toggleCompletion() {
    if (isCompleting) return;

    setMutationError(null);

    if (task.status === "active" && onCompletionAnimationEnd) {
      setIsCompleting(true);
      completionTimeoutRef.current = window.setTimeout(() => {
        completionTimeoutRef.current = null;
        void Promise.resolve()
          .then(() => onCompletionAnimationEnd(task.id))
          .catch(() => {
            setMutationError("Не вдалося оновити задачу. Спробуйте ще раз.");
            setIsCompleting(false);
          });
      }, 360);
      return;
    }

    try {
      await (task.status === "active" ? onComplete(task.id) : onRestore(task.id));
    } catch {
      setMutationError("Не вдалося оновити задачу. Спробуйте ще раз.");
    }
  }

  return (
    <article aria-label={task.title} className={`task-card${task.status === "completed" ? " task-card--completed" : ""}${isCompleting ? " task-card--completing" : ""}`}>
      <button type="button" className={`task-completion task-completion--${priority.tone}`} aria-label={task.status === "active" ? `Позначити «${task.title}» виконаною` : `Відновити «${task.title}»`} onClick={toggleCompletion}>
        {task.status === "completed" || isCompleting ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}
      </button>
      <button type="button" className="task-card-content" aria-label={`Редагувати «${task.title}»`} onClick={() => onEdit?.(task)}>
        <div className="task-card-heading"><h2>{task.title}</h2></div>
        {task.description ? <p className="task-description">{task.description}</p> : null}
        <p className="task-meta"><CalendarClock size={15} strokeWidth={2} aria-hidden="true" />{formatTaskSchedule(task, today)}</p>
      </button>
      <span aria-label={`Пріоритет: ${priority.label}`} className={`priority-indicator priority-indicator--${priority.tone}`}><PriorityIcon size={21} strokeWidth={2.4} aria-hidden="true" /></span>
      {task.status === "active" && isOverdue(task.scheduledDate, today) ? <p className="task-overdue">Прострочено</p> : null}
      {mutationError ? <p role="alert" className="capture-error">{mutationError}</p> : null}
    </article>
  );
}
