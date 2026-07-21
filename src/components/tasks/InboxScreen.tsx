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
  const activeTasks = tasks
    .filter((task) => task.status === "active")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  return (
    <section className="task-screen" aria-label="Вхідні">
      <h1>Вхідні</h1>
      {activeTasks.length ? (
        <div className="task-list">
          {activeTasks.map((task) => (
            <TaskCard key={task.id} task={task} today={today} {...actions} />
          ))}
        </div>
      ) : (
        <p className="empty-state">У Вхідних немає активних задач.</p>
      )}
    </section>
  );
}
