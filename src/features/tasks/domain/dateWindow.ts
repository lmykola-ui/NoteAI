export type TaskDestination = "inbox" | "plan";

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addLocalDays(key: string, amount: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + amount);
  return toLocalDateKey(date);
}

export function classifyTaskDate(date: string | null, today: string): TaskDestination {
  if (!date) return "inbox";
  const finalPlanDate = addLocalDays(today, 6);
  return date >= today && date <= finalPlanDate ? "plan" : "inbox";
}

export function isOverdue(date: string | null, today: string): boolean {
  return Boolean(date && date < today);
}
