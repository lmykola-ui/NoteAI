import { addLocalDays } from "@/features/tasks/domain/dateWindow";
import type { Task } from "@/features/tasks/domain/task";
import { TaskCard } from "./TaskCard";
import { comparePlanTasks } from "./PlanScreen";

type UpcomingScreenProps = {
  tasks: Task[];
  today: string;
  onChange(task: Task): void | Promise<void>;
  onComplete(id: string): void | Promise<void>;
  onRestore(id: string): void | Promise<void>;
  onDelete(id: string): void | Promise<void>;
};

function label(date: string, today: string) {
  if (date === today) return "Сьогодні";
  if (date === addLocalDays(today, 1)) return "Завтра";
  return new Intl.DateTimeFormat("uk-UA", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`));
}

export function UpcomingScreen({ tasks, today, ...actions }: UpcomingScreenProps) {
  const grouped = tasks
    .filter((task) => task.status === "active" && task.scheduledDate && task.scheduledDate >= today)
    .reduce<Record<string, Task[]>>((groups, task) => {
      groups[task.scheduledDate!] ??= [];
      groups[task.scheduledDate!].push(task);
      return groups;
    }, {});
  const dates = Object.keys(grouped).sort();
  return <section className="task-screen" aria-label="Заплановані"><h1>Заплановані</h1>{dates.length ? dates.map((date) => <section key={date} className="upcoming-day"><h2>{label(date, today)}</h2><div className="task-list">{grouped[date].sort(comparePlanTasks).map((task) => <TaskCard key={task.id} task={task} today={today} {...actions} />)}</div></section>) : <p className="empty-state">Запланованих задач немає.</p>}</section>;
}
