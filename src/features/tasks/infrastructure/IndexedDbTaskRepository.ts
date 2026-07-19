import type { TaskRepository } from "./TaskRepository";
import { noteAiDb } from "./indexedDb";

export const indexedDbTaskRepository: TaskRepository = {
  async list() {
    const db = await noteAiDb;
    return db.getAll("tasks");
  },
  async save(task) {
    const db = await noteAiDb;
    await db.put("tasks", task);
  },
  async saveMany(tasks) {
    const db = await noteAiDb;
    const transaction = db.transaction("tasks", "readwrite");
    await Promise.all([
      ...tasks.map((task) => transaction.store.put(task)),
      transaction.done,
    ]);
  },
  async remove(id) {
    const db = await noteAiDb;
    await db.delete("tasks", id);
  },
};
