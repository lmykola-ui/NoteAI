import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { makeTask } from "../../../tests/fixtures/taskFactory";
import { TaskCard } from "./TaskCard";

it("edits a task before saving the change", async () => {
  const user = userEvent.setup();
  const task = makeTask({ scheduledDate: "2026-07-19" });
  const onChange = vi.fn();

  render(
    <TaskCard
      task={task}
      today="2026-07-19"
      onChange={onChange}
      onComplete={vi.fn()}
      onRestore={vi.fn()}
      onDelete={vi.fn()}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Редагувати задачу" }));
  await user.clear(screen.getByLabelText("Назва задачі"));
  await user.type(screen.getByLabelText("Назва задачі"), "Купити хліб");
  await user.click(screen.getByRole("button", { name: "Зберегти зміни" }));

  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ id: task.id, title: "Купити хліб" }),
  );
});

it("marks an active task complete and allows deletion", async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();
  const onDelete = vi.fn();

  render(
    <TaskCard
      task={makeTask()}
      today="2026-07-19"
      onChange={vi.fn()}
      onComplete={onComplete}
      onRestore={vi.fn()}
      onDelete={onDelete}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Позначити виконаною" }));
  await user.click(screen.getByRole("button", { name: "Видалити задачу" }));

  expect(onComplete).toHaveBeenCalledWith("task-1");
  expect(onDelete).toHaveBeenCalledWith("task-1");
});
