import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { TaskComposer } from "./TaskComposer";
import { makeTask } from "../../../tests/fixtures/taskFactory";

it("opens Ukrainian date, time and priority popovers and saves description", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn().mockResolvedValue(undefined);
  render(<TaskComposer today="2026-07-21" onClose={vi.fn()} onCreate={onCreate} onStartVoice={vi.fn()} />);
  await user.type(screen.getByLabelText("Що потрібно зробити?"), "Підготувати бриф");
  await user.type(screen.getByLabelText("Опис задачі"), "Для зустрічі з клієнтом");
  await user.click(screen.getByRole("button", { name: "Сьогодні" }));
  expect(screen.getByRole("dialog", { name: "Вибір дати" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Вибрати завтра" }));
  await user.click(screen.getByRole("button", { name: "Без часу" }));
  expect(screen.getByRole("dialog", { name: "Вибір часу" })).toBeVisible();
  expect(screen.getByLabelText("Години")).toHaveAttribute("size", "3");
  expect(screen.getByLabelText("Хвилини")).toHaveAttribute("size", "3");
  await user.click(screen.getByRole("button", { name: "Застосувати час" }));
  await user.click(screen.getByRole("button", { name: "Без пріоритету" }));
  expect(screen.getByRole("dialog", { name: "Вибір пріоритету" })).toBeVisible();
  const priorityDialog = screen.getByRole("dialog", { name: "Вибір пріоритету" });
  expect(within(priorityDialog).getByRole("button", { name: "Висока" }).querySelector("svg")).toHaveClass("lucide-chevrons-up");
  expect(within(priorityDialog).getByRole("button", { name: "Середня" }).querySelector("svg")).toHaveClass("lucide-chevron-up");
  expect(within(priorityDialog).getByRole("button", { name: "Мінімальна" }).querySelector("svg")).toHaveClass("lucide-chevron-down");
  expect(within(priorityDialog).getByRole("button", { name: "Без пріоритету" }).querySelector("svg")).toHaveClass("lucide-minus");
  await user.click(screen.getByRole("button", { name: "Середня" }));
  await user.click(screen.getByRole("button", { name: "Зберегти задачу" }));
  expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ title: "Підготувати бриф", priority: "medium", scheduledDate: "2026-07-22", scheduledTime: "09:00" }));
});

it("shows the chosen date, time, and priority in the task controls", async () => {
  const user = userEvent.setup();
  render(<TaskComposer today="2026-07-21" onClose={vi.fn()} onCreate={vi.fn()} onStartVoice={vi.fn()} />);

  expect(screen.getByRole("button", { name: "Сьогодні" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Без часу" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Без пріоритету" })).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Без часу" }));
  await user.selectOptions(screen.getByLabelText("Години"), "14");
  await user.selectOptions(screen.getByLabelText("Хвилини"), "30");
  await user.click(screen.getByRole("button", { name: "Застосувати час" }));
  expect(screen.getByRole("button", { name: "14:30" })).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Без пріоритету" }));
  await user.click(screen.getByRole("button", { name: "Середня" }));
  expect(screen.getByRole("button", { name: "Середня" })).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Сьогодні" }));
  fireEvent.change(screen.getByLabelText("Вибрати дату"), { target: { value: "2026-07-30" } });
  expect(screen.getByRole("button", { name: "30 липня" })).toBeVisible();
});

it("keeps today available after clearing a date and uses neutral time actions", async () => {
  const user = userEvent.setup();
  render(<TaskComposer today="2026-07-21" onClose={vi.fn()} onCreate={vi.fn()} onStartVoice={vi.fn()} />);

  await user.click(screen.getByRole("button", { name: "Сьогодні" }));
  await user.click(screen.getByRole("button", { name: "Без дати" }));
  await user.click(screen.getByRole("button", { name: "Без дати" }));
  await user.click(screen.getByRole("button", { name: "Сьогодні" }));
  expect(screen.getByRole("button", { name: "Сьогодні" })).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Без часу" }));
  expect(screen.getByRole("button", { name: "Застосувати час" })).toHaveClass("time-wheel-action");
  expect(screen.getAllByRole("button", { name: "Без часу" })[1]).toHaveClass("time-wheel-action");
});

it("saves a task for the day after tomorrow", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn().mockResolvedValue(undefined);
  render(<TaskComposer today="2026-07-21" onClose={vi.fn()} onCreate={onCreate} onStartVoice={vi.fn()} />);

  await user.type(screen.getByLabelText("Що потрібно зробити?"), "Зателефонувати");
  await user.click(screen.getByRole("button", { name: "Сьогодні" }));
  await user.click(screen.getByRole("button", { name: "Післязавтра" }));
  await user.click(screen.getByRole("button", { name: "Зберегти задачу" }));

  expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ scheduledDate: "2026-07-23" }));
});

it("grows the description field to fit typed text before it becomes scrollable", () => {
  render(<TaskComposer today="2026-07-21" onClose={vi.fn()} onCreate={vi.fn()} onStartVoice={vi.fn()} />);
  const description = screen.getByLabelText("Опис задачі");
  Object.defineProperty(description, "scrollHeight", { configurable: true, value: 96 });

  fireEvent.input(description, { target: { value: "Детальний опис задачі" } });

  expect(description).toHaveStyle({ height: "96px" });
});

it("prefills an existing task and saves its edited fields", async () => {
  const user = userEvent.setup();
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  render(<TaskComposer today="2026-07-21" task={makeTask({ title: "Старий заголовок", description: "Старий опис", scheduledDate: "2026-07-23", scheduledTime: "14:30", priority: "high" })} onClose={vi.fn()} onCreate={vi.fn()} onUpdate={onUpdate} onStartVoice={vi.fn()} />);

  expect(screen.getByRole("heading", { name: "Редагувати задачу" })).toBeVisible();
  expect(screen.getByLabelText("Що потрібно зробити?")).toHaveValue("Старий заголовок");
  expect(screen.getByLabelText("Опис задачі")).toHaveValue("Старий опис");
  await user.clear(screen.getByLabelText("Що потрібно зробити?"));
  await user.type(screen.getByLabelText("Що потрібно зробити?"), "Новий заголовок");
  await user.click(screen.getByRole("button", { name: "Зберегти зміни" }));

  expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ title: "Новий заголовок", scheduledDate: "2026-07-23", scheduledTime: "14:30", priority: "high" }));
});
