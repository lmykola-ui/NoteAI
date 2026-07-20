import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { makeTask } from "../../../tests/fixtures/taskFactory";
import { InboxScreen } from "./InboxScreen";

const undated = makeTask({ id: "undated" });
const overdue = makeTask({
  id: "overdue",
  title: "Прострочена",
  scheduledDate: "2026-07-18",
});
const laterFuture = makeTask({
  id: "future",
  title: "Майбутня",
  scheduledDate: "2026-07-28",
});
const todayTask = makeTask({
  id: "today",
  title: "Сьогоднішня",
  scheduledDate: "2026-07-19",
});
const completed = makeTask({
  id: "completed",
  title: "Готово",
  status: "completed",
  completedAt: "2026-07-19T10:30:00.000Z",
});
const actions = {
  onChange: vi.fn(),
  onComplete: vi.fn(),
  onRestore: vi.fn(),
  onDelete: vi.fn(),
};

it("keeps undated, overdue, and later-future tasks in Inbox", () => {
  render(
    <InboxScreen
      tasks={[undated, overdue, laterFuture, todayTask]}
      today="2026-07-19"
      {...actions}
    />,
  );

  expect(screen.getByText(undated.title)).toBeVisible();
  expect(screen.getByText(overdue.title)).toBeVisible();
  expect(screen.getByText("Прострочено")).toBeVisible();
  expect(screen.getByText(laterFuture.title)).toBeVisible();
  expect(screen.queryByText(todayTask.title)).not.toBeInTheDocument();
});

it("keeps completed tasks in a collapsed restore section", async () => {
  const user = userEvent.setup();
  render(
    <InboxScreen
      tasks={[undated, completed]}
      today="2026-07-19"
      {...actions}
    />,
  );

  const completedSection = screen.getByText("Виконані").closest("details");
  expect(completedSection).not.toHaveAttribute("open");
  expect(screen.getByText(completed.title)).not.toBeVisible();

  await user.click(screen.getByText("Виконані"));
  expect(screen.getByText(completed.title)).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Відновити задачу" }),
  ).toBeVisible();
});
