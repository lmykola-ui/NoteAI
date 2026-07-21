import { render, screen } from "@testing-library/react";
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
