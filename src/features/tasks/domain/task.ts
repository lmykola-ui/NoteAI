export type TaskStatus = "active" | "completed";
export type TaskPriority = "low" | "medium" | "high";
export type InputMethod = "text" | "voice";

export type Task = {
  id: string;
  title: string;
  description?: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  status: TaskStatus;
  priority: TaskPriority | null;
  inputMethod: InputMethod;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  inboxOrder?: number | null;
};

export type TaskDraft = Pick<
  Task,
  "title" | "description" | "scheduledDate" | "scheduledTime" | "status" | "priority" | "inputMethod"
>;

export type ParseResult = {
  tasks: TaskDraft[];
  clarification: string | null;
};

export function materializeTask(draft: TaskDraft, now = new Date()): Task {
  const timestamp = now.toISOString();
  return {
    ...draft,
    id: crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: draft.status === "completed" ? timestamp : null,
    inboxOrder: null,
  };
}
