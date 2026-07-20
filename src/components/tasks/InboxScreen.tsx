import { classifyTaskDate } from "@/features/tasks/domain/dateWindow";
import type { Task } from "@/features/tasks/domain/task";
import { TaskCard } from "./TaskCard";

type InboxScreenProps = {
  tasks: Task[];
  today: string;
  onChange(task: Task): void | Promise<void>;
  onComplete(id: string): void | Promise<void>;
  onRestore(id: string): void | Promise<void>;
  onDelete(id: string): void | Promise<void>;
};

export function InboxScreen({ tasks, today, ...actions }: InboxScreenProps) {
  const activeTasks = tasks.filter(
    (task) =>
      task.status === "active" &&
      classifyTaskDate(task.scheduledDate, today) === "inbox",
  );
  const completedTasks = tasks.filter((task) => task.status === "completed");

  return (
    <section className="task-screen screen-enter" aria-label="Inbox">
      <h1>Inbox</h1>
      {activeTasks.length ? (
        <div className="task-list">
          {activeTasks.map((task) => (
            <TaskCard key={task.id} task={task} today={today} {...actions} />
          ))}
        </div>
      ) : (
        <p className="empty-state">У Inbox немає активних задач.</p>
      )}
      {completedTasks.length ? (
        <details className="completed-tasks">
          <summary>Виконані</summary>
          <div className="task-list">
            {completedTasks.map((task) => (
              <TaskCard key={task.id} task={task} today={today} {...actions} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
