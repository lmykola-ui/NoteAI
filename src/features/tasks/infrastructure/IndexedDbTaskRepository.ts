import type { TaskRepository } from "./TaskRepository";
import { getNoteAiDb } from "./indexedDb";

export const indexedDbTaskRepository: TaskRepository = {
  async list() {
    const db = await getNoteAiDb();
    return db.getAll("tasks");
  },
  async save(task) {
    const db = await getNoteAiDb();
    await db.put("tasks", task);
  },
  async saveMany(tasks) {
    const db = await getNoteAiDb();
    const transaction = db.transaction("tasks", "readwrite");
    await Promise.all([
      ...tasks.map((task) => transaction.store.put(task)),
      transaction.done,
    ]);
  },
  async remove(id) {
    const db = await getNoteAiDb();
    await db.delete("tasks", id);
  },
};
