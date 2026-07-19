import type { Task } from "../domain/task";

export interface TaskRepository {
  list(): Promise<Task[]>;
  save(task: Task): Promise<void>;
  saveMany(tasks: Task[]): Promise<void>;
  remove(id: string): Promise<void>;
}
