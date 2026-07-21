import type { Task } from "@/features/tasks/domain/task";
import { TaskCard } from "./TaskCard";

export function HistoryScreen({ tasks, today, onRestore, onClose }: { tasks: Task[]; today: string; onRestore(id: string): void | Promise<void>; onClose(): void }) {
  const completed = tasks.filter((task) => task.status === "completed");
  return <section className="task-screen" aria-label="Історія"><div className="screen-heading"><h1>Історія</h1><button type="button" className="secondary-button" onClick={onClose}>Назад</button></div>{completed.length ? <div className="task-list">{completed.map((task) => <TaskCard key={task.id} task={task} today={today} onComplete={() => undefined} onRestore={onRestore} />)}</div> : <p className="empty-state">Виконаних задач ще немає.</p>}</section>;
}
