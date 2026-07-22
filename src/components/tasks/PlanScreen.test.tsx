import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { makeTask } from "../../../tests/fixtures/taskFactory";
import { PlanScreen } from "./PlanScreen";

const actions = { onChange: vi.fn(), onComplete: vi.fn(), onRestore: vi.fn(), onDelete: vi.fn() };

it("shows only active tasks scheduled for today", () => {
  const today = makeTask({ id: "today", scheduledDate: "2026-07-19" });
  const tomorrow = makeTask({ id: "tomorrow", title: "Завтра", scheduledDate: "2026-07-20" });
  render(<PlanScreen tasks={[today, tomorrow]} today="2026-07-19" {...actions} />);
  expect(screen.getByRole("heading", { name: "Сьогодні" })).toBeVisible();
  expect(screen.getByText(today.title)).toBeVisible();
  expect(screen.queryByText(tomorrow.title)).not.toBeInTheDocument();
});

it("orders timed today tasks before untimed tasks", () => {
  const timed = makeTask({ id: "timed", title: "Раніше", scheduledDate: "2026-07-19", scheduledTime: "09:00" });
  const untimed = makeTask({ id: "untimed", title: "Без часу", scheduledDate: "2026-07-19", scheduledTime: null });
  render(<PlanScreen tasks={[untimed, timed]} today="2026-07-19" {...actions} />);
  expect(screen.getAllByRole("article").map((card) => card.getAttribute("aria-label"))).toEqual(["Раніше", "Без часу"]);
});

it("shows the empty Today prompt when nothing is scheduled", () => {
  render(<PlanScreen tasks={[]} today="2026-07-19" {...actions} />);

  expect(screen.getByText("Що сьогодні тобі треба зробити?")).toBeVisible();
  expect(screen.getByAltText("")).toHaveAttribute(
    "src",
    expect.stringContaining("empty-task-state-cat.png"),
  );
});

it("calculates today progress from every task scheduled for the day", () => {
  const tasks = [
    makeTask({ id: "one", scheduledDate: "2026-07-19", status: "completed" }),
    makeTask({ id: "two", scheduledDate: "2026-07-19" }),
    makeTask({ id: "three", scheduledDate: "2026-07-19" }),
    makeTask({ id: "four", scheduledDate: "2026-07-19" }),
    makeTask({ id: "tomorrow", scheduledDate: "2026-07-20", status: "completed" }),
  ];

  render(<PlanScreen tasks={tasks} today="2026-07-19" {...actions} />);

  expect(screen.getByText("25%")).toBeVisible();
  expect(screen.getByRole("img", { name: "Емоція прогресу: 0–25%" })).toBeVisible();
});

it("celebrates completion and lets people reveal completed tasks", async () => {
  const user = userEvent.setup();
  const tasks = [
    makeTask({ id: "one", scheduledDate: "2026-07-19", status: "completed" }),
    makeTask({ id: "two", scheduledDate: "2026-07-19", status: "completed" }),
  ];

  render(<PlanScreen tasks={tasks} today="2026-07-19" {...actions} />);

  expect(screen.getByRole("heading", { name: "Вітаємо!" })).toBeVisible();
  expect(screen.getByText("Сьогодні всі плани виконані")).toBeVisible();
  expect(screen.getByRole("button", { name: "Показати виконані (2)" })).toBeVisible();
  expect(screen.queryByRole("list", { name: "Виконані задачі сьогодні" })).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Показати виконані (2)" }));

  expect(screen.getByRole("button", { name: "Сховати виконані (2)" })).toBeVisible();
  expect(screen.getByRole("list", { name: "Виконані задачі сьогодні" })).toBeVisible();
});
