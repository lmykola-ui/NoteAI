import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { makeTask } from "../../../tests/fixtures/taskFactory";
import { PlanScreen } from "./PlanScreen";

const todayTask = makeTask({ id: "today", scheduledDate: "2026-07-19" });
const tomorrowTask = makeTask({
  id: "tomorrow",
  title: "Перевірити пошту",
  scheduledDate: "2026-07-20",
});
const actions = {
  onChange: vi.fn(),
  onComplete: vi.fn(),
  onRestore: vi.fn(),
  onDelete: vi.fn(),
};

it("shows exactly today plus six days and only the selected day tasks", async () => {
  const user = userEvent.setup();

  render(
    <PlanScreen
      tasks={[todayTask, tomorrowTask]}
      today="2026-07-19"
      {...actions}
    />,
  );

  expect(screen.getAllByRole("button", { name: /Обрати/ })).toHaveLength(7);
  expect(screen.getByText(todayTask.title)).toBeVisible();
  expect(screen.queryByText(tomorrowTask.title)).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /Обрати 20 липня/ }));
  expect(screen.getByText(tomorrowTask.title)).toBeVisible();
  expect(screen.queryByText(todayTask.title)).not.toBeInTheDocument();
});

it("orders timed Plan tasks before untimed tasks by creation time", () => {
  const late = makeTask({
    id: "late",
    title: "Пізніше",
    scheduledDate: "2026-07-19",
    scheduledTime: "17:00",
    createdAt: "2026-07-19T10:00:00.000Z",
  });
  const early = makeTask({
    id: "early",
    title: "Раніше",
    scheduledDate: "2026-07-19",
    scheduledTime: "09:00",
    createdAt: "2026-07-19T11:00:00.000Z",
  });
  const untimed = makeTask({
    id: "untimed",
    title: "Без часу",
    scheduledDate: "2026-07-19",
    createdAt: "2026-07-19T09:00:00.000Z",
  });

  render(
    <PlanScreen
      tasks={[late, untimed, early]}
      today="2026-07-19"
      {...actions}
    />,
  );

  expect(
    screen.getAllByRole("article").map((card) => card.textContent),
  ).toEqual(expect.arrayContaining([expect.stringContaining("Раніше")]));
  expect(
    screen.getAllByRole("article").map((card) => card.textContent),
  ).toEqual(
    expect.arrayContaining([
      expect.stringContaining("Раніше"),
      expect.stringContaining("Пізніше"),
      expect.stringContaining("Без часу"),
    ]),
  );
  const titles = screen
    .getAllByRole("article")
    .map((card) => card.getAttribute("aria-label"));
  expect(titles).toEqual(["Раніше", "Пізніше", "Без часу"]);
});
