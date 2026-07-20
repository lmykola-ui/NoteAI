import { makeTask } from "./taskFactory";
import { createMemoryTaskRepository } from "./memoryTaskRepository";

it("upserts duplicate ids in saveMany", async () => {
  const repository = createMemoryTaskRepository();

  await repository.saveMany([
    makeTask(),
    makeTask({ title: "Купити хліб" }),
  ]);

  expect(await repository.list()).toEqual([makeTask({ title: "Купити хліб" })]);
});
