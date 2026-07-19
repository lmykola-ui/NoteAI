import { noteAiDb } from "./indexedDb";
import { indexedDbTaskRepository } from "./IndexedDbTaskRepository";
import type { Task } from "../domain/task";

const task: Task = {
  id: "task-1",
  title: "Купити молоко",
  scheduledDate: null,
  scheduledTime: null,
  status: "active",
  priority: null,
  inputMethod: "text",
  createdAt: "2026-07-19T10:00:00.000Z",
  updatedAt: "2026-07-19T10:00:00.000Z",
  completedAt: null,
};

beforeEach(async () => {
  const db = await noteAiDb;
  await db.clear("tasks");
});

it("persists tasks across repository calls", async () => {
  await indexedDbTaskRepository.saveMany([task]);

  expect(await indexedDbTaskRepository.list()).toEqual([task]);
});

it("updates and deletes a task", async () => {
  await indexedDbTaskRepository.saveMany([task]);
  await indexedDbTaskRepository.save({ ...task, title: "Купити хліб" });

  expect((await indexedDbTaskRepository.list())[0].title).toBe("Купити хліб");

  await indexedDbTaskRepository.remove(task.id);

  expect(await indexedDbTaskRepository.list()).toEqual([]);
});
