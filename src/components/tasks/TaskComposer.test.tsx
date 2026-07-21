import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { TaskComposer } from "./TaskComposer";

it("opens Ukrainian date, time and priority popovers and saves description", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn().mockResolvedValue(undefined);
  render(<TaskComposer today="2026-07-21" onClose={vi.fn()} onCreate={onCreate} onStartVoice={vi.fn()} />);
  await user.type(screen.getByLabelText("Що потрібно зробити?"), "Підготувати бриф");
  await user.type(screen.getByLabelText("Опис задачі"), "Для зустрічі з клієнтом");
  await user.click(screen.getByRole("button", { name: "Сьогодні" }));
  expect(screen.getByRole("dialog", { name: "Вибір дати" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Вибрати завтра" }));
  await user.click(screen.getByRole("button", { name: "Час" }));
  expect(screen.getByRole("dialog", { name: "Вибір часу" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Застосувати час" }));
  await user.click(screen.getByRole("button", { name: "Пріоритет" }));
  expect(screen.getByRole("dialog", { name: "Вибір пріоритету" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Середня" }));
  await user.click(screen.getByRole("button", { name: "Зберегти задачу" }));
  expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ title: "Підготувати бриф", priority: "medium", scheduledDate: "2026-07-22", scheduledTime: "09:00" }));
});
