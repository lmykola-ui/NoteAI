import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { makeTask } from "../../../tests/fixtures/taskFactory";
import { TaskCard } from "./TaskCard";

it("shows task content without edit or delete actions", () => {
  render(<TaskCard task={makeTask({ description: "Надіслати до обіду", priority: "high" })} today="2026-07-19" onComplete={vi.fn()} onRestore={vi.fn()} />);

  expect(screen.getByText("Надіслати до обіду")).toBeVisible();
  expect(screen.getByLabelText("Пріоритет: Висока").querySelector("svg")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Редагувати задачу" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Видалити задачу" })).not.toBeInTheDocument();
});

it("marks an active task complete from its completion circle", async () => {
  const user = userEvent.setup(); const onComplete = vi.fn();
  render(<TaskCard task={makeTask()} today="2026-07-19" onComplete={onComplete} onRestore={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: /Позначити.*виконаною/ }));
  expect(onComplete).toHaveBeenCalledWith("task-1");
});

it("opens editing from the task content without completing it", async () => {
  const user = userEvent.setup();
  const onEdit = vi.fn();
  const onComplete = vi.fn();
  render(<TaskCard task={makeTask({ title: "Надіслати бриф" })} today="2026-07-19" onComplete={onComplete} onRestore={vi.fn()} onEdit={onEdit} />);

  await user.click(screen.getByRole("button", { name: "Редагувати «Надіслати бриф»" }));

  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "task-1" }));
  expect(onComplete).not.toHaveBeenCalled();
});

it("restores a completed task from its completion circle", async () => {
  const user = userEvent.setup(); const onRestore = vi.fn();
  render(<TaskCard task={makeTask({ status: "completed" })} today="2026-07-19" onComplete={vi.fn()} onRestore={onRestore} />);
  const completion = screen.getByRole("button", { name: /Відновити/ });
  expect(screen.getByRole("article")).toHaveClass("task-card--completed");
  expect(completion.querySelector("svg")).toBeInTheDocument();
  await user.click(completion);
  expect(onRestore).toHaveBeenCalledWith("task-1");
});

it("does not mark a completed past task as overdue", () => {
  render(<TaskCard task={makeTask({ status: "completed", scheduledDate: "2026-07-18" })} today="2026-07-19" onComplete={vi.fn()} onRestore={vi.fn()} />);
  expect(screen.queryByText("Прострочено")).not.toBeInTheDocument();
});
