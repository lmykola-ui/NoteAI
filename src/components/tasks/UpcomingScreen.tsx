"use client";

import { useState } from "react";
import type { Task } from "@/features/tasks/domain/task";
import { TaskCard } from "./TaskCard";
import { comparePlanTasks } from "./PlanScreen";

type Props = { tasks: Task[]; today: string; onChange(task: Task): void | Promise<void>; onComplete(id: string): void | Promise<void>; onRestore(id: string): void | Promise<void>; onDelete(id: string): void | Promise<void> };
function fromKey(key: string) { return new Date(`${key}T12:00:00`); }
function key(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

export function UpcomingScreen({ tasks, today, ...actions }: Props) {
  const [month, setMonth] = useState(() => fromKey(today)); const [selected, setSelected] = useState(today);
  const year = month.getFullYear(); const monthIndex = month.getMonth(); const firstDay = new Date(year, monthIndex, 1).getDay(); const days = new Date(year, monthIndex + 1, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat("uk-UA", { month: "long", year: "numeric" }).format(month);
  const selectedTasks = tasks.filter((task) => task.status === "active" && task.scheduledDate === selected).sort(comparePlanTasks);
  return <section className="task-screen" aria-label="Заплановані"><h1>Заплановані</h1><div className="month-calendar"><div className="month-header"><button type="button" aria-label="Попередній місяць" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}>‹</button><strong>{monthLabel}</strong><button type="button" aria-label="Наступний місяць" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}>›</button></div><div className="calendar-grid" aria-label="Календар"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Нд</span>{Array.from({ length: (firstDay + 6) % 7 }, (_, index) => <i key={`blank-${index}`} />)}{Array.from({ length: days }, (_, index) => { const date = new Date(year, monthIndex, index + 1); const dateKey = key(date); return <button key={dateKey} type="button" aria-label={`Обрати ${index + 1} ${new Intl.DateTimeFormat("uk-UA", { month: "long" }).format(date)}`} aria-pressed={selected === dateKey} onClick={() => setSelected(dateKey)}>{index + 1}</button>; })}</div></div><h2 className="selected-date">{new Intl.DateTimeFormat("uk-UA", { weekday: "long", day: "numeric", month: "long" }).format(fromKey(selected))}</h2>{selectedTasks.length ? <div className="task-list">{selectedTasks.map((task) => <TaskCard key={task.id} task={task} today={today} {...actions} />)}</div> : <p className="empty-state">На цей день задач немає.</p>}</section>;
}
