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

it("keeps the editor open and reports a save failure", async () => {
  const user = userEvent.setup();
  const task = makeTask({ scheduledDate: "2026-07-19" });
  const onChange = vi.fn().mockRejectedValue(new Error("save failed"));

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

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Не вдалося зберегти зміни. Спробуйте ще раз.",
  );
  expect(screen.getByDisplayValue("Купити хліб")).toBeVisible();
});

it.each([
  {
    task: makeTask(),
    action: "onComplete" as const,
    button: "Позначити виконаною",
  },
  {
    task: makeTask({ status: "completed" }),
    action: "onRestore" as const,
    button: "Відновити задачу",
  },
  {
    task: makeTask(),
    action: "onDelete" as const,
    button: "Видалити задачу",
  },
])("reports an action failure for $button", async ({ task, action, button }) => {
  const user = userEvent.setup();
  const failedAction = vi.fn().mockRejectedValue(new Error("action failed"));

  render(
    <TaskCard
      task={task}
      today="2026-07-19"
      onChange={vi.fn()}
      onComplete={action === "onComplete" ? failedAction : vi.fn()}
      onRestore={action === "onRestore" ? failedAction : vi.fn()}
      onDelete={action === "onDelete" ? failedAction : vi.fn()}
    />,
  );

  await user.click(screen.getByRole("button", { name: button }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Не вдалося оновити задачу. Спробуйте ще раз.",
  );
  expect(failedAction).toHaveBeenCalledWith(task.id);
});

it("does not mark a completed past task as overdue", () => {
  render(
    <TaskCard
      task={makeTask({ status: "completed", scheduledDate: "2026-07-18" })}
      today="2026-07-19"
      onChange={vi.fn()}
      onComplete={vi.fn()}
      onRestore={vi.fn()}
      onDelete={vi.fn()}
    />,
  );

  expect(screen.queryByText("Прострочено")).not.toBeInTheDocument();
});
