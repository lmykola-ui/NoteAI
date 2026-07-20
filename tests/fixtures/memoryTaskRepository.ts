import type { Task } from "@/features/tasks/domain/task";
import type { TaskRepository } from "@/features/tasks/infrastructure/TaskRepository";

export function createMemoryTaskRepository(
  initial: Task[] = [],
): TaskRepository & { saved: Task[] } {
  const saved = [...initial];
  const upsert = (task: Task) => {
    const index = saved.findIndex((item) => item.id === task.id);
    if (index === -1) saved.push(task);
    else saved.splice(index, 1, task);
  };

  return {
    saved,
    list: async () => [...saved],
    async save(task) {
      upsert(task);
    },
    async saveMany(tasks) {
      tasks.forEach(upsert);
    },
    async remove(id) {
      const index = saved.findIndex((task) => task.id === id);
      if (index >= 0) saved.splice(index, 1);
    },
  };
}
