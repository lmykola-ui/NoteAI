"use client";

import { useState } from "react";
import { addLocalDays } from "@/features/tasks/domain/dateWindow";
import type { Task } from "@/features/tasks/domain/task";
import { TaskCard } from "./TaskCard";
import { comparePlanTasks } from "./PlanScreen";

type Props = { tasks: Task[]; today: string; onChange(task: Task): void | Promise<void>; onComplete(id: string): void | Promise<void>; onRestore(id: string): void | Promise<void>; onDelete(id: string): void | Promise<void> };
const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
function toDate(key: string) { return new Date(`${key}T12:00:00`); }
function toKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function title(date: string, today: string) { const full = new Intl.DateTimeFormat("uk-UA", { weekday: "long", day: "numeric", month: "long" }).format(toDate(date)); return date === today ? `${full} · Сьогодні` : date === addLocalDays(today, 1) ? `${full} · Завтра` : full; }

export function UpcomingScreen({ tasks, today, ...actions }: Props) {
  const [selected, setSelected] = useState(today); const [expanded, setExpanded] = useState(false);
  const selectedDate = toDate(selected); const year = selectedDate.getFullYear(); const month = selectedDate.getMonth();
  const monthLabel = new Intl.DateTimeFormat("uk-UA", { month: "long", year: "numeric" }).format(selectedDate);
  const first = new Date(year, month, 1); const offset = (first.getDay() + 6) % 7;
  const monday = addLocalDays(selected, -(selectedDate.getDay() + 6) % 7); const visibleDates = Array.from({ length: 42 }, (_, i) => toKey(new Date(year, month, i - offset + 1)));
  const taskFor = (date: string) => tasks.filter((task) => task.status === "active" && task.scheduledDate === date).sort(comparePlanTasks);
  const agendaDates = Array.from({ length: 30 }, (_, index) => addLocalDays(selected, index));
  function shiftMonth(delta: number) { const next = new Date(year, month + delta, 1); setSelected(toKey(next)); }
  return <section className="task-screen upcoming-screen" aria-label="Заплановані"><div className="upcoming-title"><h1>Заплановані</h1></div><div className={`upcoming-calendar ${expanded ? "upcoming-calendar--expanded" : ""}`}><div className="month-row">{expanded ? <button type="button" aria-label="Попередній місяць" onClick={() => shiftMonth(-1)}>‹</button> : null}<button type="button" className="month-select" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{monthLabel} <span>{expanded ? "⌃" : "⌄"}</span></button>{expanded ? <button type="button" aria-label="Наступний місяць" onClick={() => shiftMonth(1)}>›</button> : null}</div><div className="calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-days">{(expanded ? visibleDates : Array.from({ length: 7 }, (_, index) => addLocalDays(monday, index))).map((date) => { const current = toDate(date); const inMonth = current.getMonth() === month; return <button key={date} type="button" aria-label={`Обрати ${current.getDate()} ${new Intl.DateTimeFormat("uk-UA", { month: "long" }).format(current)}`} aria-pressed={date === selected} className={!inMonth ? "calendar-day--other" : undefined} onClick={() => setSelected(date)}>{current.getDate()}</button>; })}</div><button type="button" className="calendar-handle" aria-label={expanded ? "Згорнути календар" : "Розгорнути календар"} onClick={() => setExpanded((value) => !value)}><span /></button></div><div className="upcoming-agenda">{agendaDates.map((date) => { const dayTasks = taskFor(date); return <section key={date} className={`agenda-day ${dayTasks.length ? "agenda-day--has-tasks" : ""}`}><h2>{title(date, today)}</h2>{dayTasks.length ? <div className="task-list">{dayTasks.map((task) => <TaskCard key={task.id} task={task} today={today} {...actions} />)}</div> : null}</section>; })}</div></section>;
}
