import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { makeTask } from "../../../tests/fixtures/taskFactory";
import { UpcomingScreen } from "./UpcomingScreen";

const actions = { onChange: vi.fn(), onComplete: vi.fn(), onRestore: vi.fn(), onDelete: vi.fn() };

it("shows a weekly calendar that expands to a full month and selects a date", async () => {
  const user = userEvent.setup();
  render(<UpcomingScreen tasks={[makeTask({ scheduledDate: "2026-07-22", title: "Завтрашня" })]} today="2026-07-21" {...actions} />);
  expect(screen.getByRole("heading", { name: "Заплановані" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Розгорнути календар" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Обрати 22 липень" }));
  expect(screen.getByText("Завтрашня")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Розгорнути календар" }));
  expect(screen.getByRole("button", { name: "Згорнути календар" })).toBeVisible();
});

it("keeps month text static and places the agenda in a separate bottom sheet", async () => {
  render(<UpcomingScreen tasks={[]} today="2026-07-21" {...actions} />);

  expect(screen.getByText("Липень 2026")).not.toHaveAttribute("role", "button");
  expect(screen.getByRole("region", { name: "Список запланованих задач" })).toBeVisible();
});

it("syncs a day selected from the agenda back to the calendar", async () => {
  const user = userEvent.setup();
  render(<UpcomingScreen tasks={[]} today="2026-07-21" {...actions} />);

  await user.click(screen.getByRole("button", { name: "середа, 22 липня · Завтра" }));

  expect(screen.getByRole("button", { name: "Обрати 22 липень" })).toHaveAttribute("aria-pressed", "true");
});

it("offers a quick return to today after selecting another date", async () => {
  const user = userEvent.setup();
  render(<UpcomingScreen tasks={[]} today="2026-07-21" {...actions} />);

  expect(screen.queryByRole("button", { name: "Повернутися до сьогодні" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Обрати 22 липень" }));
  await user.click(screen.getByRole("button", { name: "Повернутися до сьогодні" }));

  expect(screen.getByRole("button", { name: "Обрати 21 липень" })).toHaveAttribute("aria-pressed", "true");
});
