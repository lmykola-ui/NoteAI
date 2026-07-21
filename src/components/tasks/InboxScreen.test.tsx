import { render, screen } from "@testing-library/react";
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

it("keeps every active task in one Inbox list", () => {
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
  expect(screen.getByText(todayTask.title)).toBeVisible();
});

it("does not mix completed tasks into Inbox", () => {
  render(
    <InboxScreen
      tasks={[undated, completed]}
      today="2026-07-19"
      {...actions}
    />,
  );

  expect(screen.queryByText(completed.title)).not.toBeInTheDocument();
});
