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

it("opens on today and exposes the week from the top-right period menu", async () => {
  const user = userEvent.setup();

  render(
    <PlanScreen
      tasks={[todayTask, tomorrowTask]}
      today="2026-07-19"
      {...actions}
    />,
  );

  expect(screen.getByRole("heading", { name: "Сьогодні" })).toBeVisible();
  expect(screen.getByText(todayTask.title)).toBeVisible();
  expect(screen.queryByText(tomorrowTask.title)).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Змінити період" }));
  await user.click(screen.getByRole("menuitemradio", { name: "Тиждень" }));

  expect(screen.getByRole("heading", { name: "Тиждень" })).toBeVisible();
  expect(screen.getAllByRole("group", { name: /День/ })).toHaveLength(7);
  expect(screen.getByText(todayTask.title)).toBeVisible();
  expect(screen.getByText(tomorrowTask.title)).toBeVisible();
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

it("keeps today mode aligned when the date rolls", () => {
  const newTodayTask = makeTask({
    id: "new-today",
    title: "Нова сьогоднішня задача",
    scheduledDate: "2026-07-20",
  });
  const { rerender } = render(
    <PlanScreen tasks={[todayTask, newTodayTask]} today="2026-07-19" {...actions} />,
  );

  rerender(
    <PlanScreen tasks={[todayTask, newTodayTask]} today="2026-07-20" {...actions} />,
  );

  expect(screen.getByRole("heading", { name: "Сьогодні" })).toBeVisible();
  expect(screen.getByText("Нова сьогоднішня задача")).toBeVisible();
  expect(screen.queryByText(todayTask.title)).not.toBeInTheDocument();
});

it("shows one calm state when the whole week is empty", async () => {
  const user = userEvent.setup();
  render(<PlanScreen tasks={[]} today="2026-07-19" {...actions} />);

  await user.click(screen.getByRole("button", { name: "Змінити період" }));
  await user.click(screen.getByRole("menuitemradio", { name: "Тиждень" }));

  expect(screen.getByText("На цей тиждень задач немає.")).toBeVisible();
  expect(screen.queryByRole("group", { name: /День/ })).not.toBeInTheDocument();
});
