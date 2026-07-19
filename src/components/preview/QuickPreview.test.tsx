import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, vi } from "vitest";
import type { TaskDraft } from "@/features/tasks/domain/task";
import { QuickPreview } from "./QuickPreview";

const firstDraft: TaskDraft = {
  title: "Купити молоко",
  scheduledDate: null,
  scheduledTime: null,
  status: "active",
  priority: null,
  inputMethod: "text",
};

const secondDraft: TaskDraft = {
  title: "Перевірити пошту",
  scheduledDate: "2026-07-20",
  scheduledTime: null,
  status: "active",
  priority: null,
  inputMethod: "text",
};

it("edits and removes AI suggestions before confirmation", async () => {
  const onConfirm = vi.fn();
  render(
    <QuickPreview
      initialTasks={[firstDraft, secondDraft]}
      clarification={null}
      onCancel={vi.fn()}
      onConfirm={onConfirm}
    />,
  );

  await userEvent.clear(screen.getAllByLabelText("Назва задачі")[0]);
  await userEvent.type(screen.getAllByLabelText("Назва задачі")[0], "Купити хліб");
  await userEvent.click(
    screen.getAllByRole("button", { name: "Видалити пропозицію" })[1],
  );
  await userEvent.click(screen.getByRole("button", { name: "Додати все" }));

  expect(onConfirm).toHaveBeenCalledWith([
    expect.objectContaining({ title: "Купити хліб" }),
  ]);
});

it("blocks confirmation whenever an unresolved clarification is present", async () => {
  const onConfirm = vi.fn();
  render(
    <QuickPreview
      initialTasks={[firstDraft]}
      clarification="Коли саме виконати цю задачу?"
      onCancel={vi.fn()}
      onConfirm={onConfirm}
    />,
  );

  expect(screen.getByRole("button", { name: "Додати все" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Додати все" }));
  expect(onConfirm).not.toHaveBeenCalled();
});
