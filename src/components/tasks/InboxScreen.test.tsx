import { act, fireEvent, render, screen } from "@testing-library/react";
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

it("keeps a short task tap for editing", () => {
  const onEdit = vi.fn();
  render(
    <InboxScreen
      tasks={[undated]}
      today="2026-07-19"
      {...actions}
      onEdit={onEdit}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: `Редагувати «${undated.title}»` }));

  expect(onEdit).toHaveBeenCalledWith(undated);
});

it("shows an insertion marker after a long press and saves the dropped order", () => {
  vi.useFakeTimers();
  const first = makeTask({ id: "first", title: "Перша", inboxOrder: 0 });
  const second = makeTask({ id: "second", title: "Друга", inboxOrder: 1 });
  const onReorder = vi.fn();
  render(
    <InboxScreen
      tasks={[first, second]}
      today="2026-07-19"
      {...actions}
      onReorder={onReorder}
    />,
  );

  const firstCard = screen.getByLabelText(first.title);
  const secondCard = screen.getByLabelText(second.title);
  Object.defineProperty(firstCard, "getBoundingClientRect", {
    value: () => ({ top: 0, height: 80 }),
  });
  Object.defineProperty(secondCard, "getBoundingClientRect", {
    value: () => ({ top: 100, height: 80 }),
  });

  fireEvent.pointerDown(firstCard, { pointerId: 1, clientY: 40 });
  act(() => vi.advanceTimersByTime(350));
  fireEvent.pointerMove(firstCard, { pointerId: 1, clientY: 190 });

  expect(screen.getByTestId("inbox-drop-marker")).toBeVisible();

  fireEvent.pointerUp(firstCard, { pointerId: 1, clientY: 190 });

  expect(onReorder).toHaveBeenCalledWith([second.id, first.id]);
  vi.useRealTimers();
});

it("does not change the order when dragging is cancelled", () => {
  vi.useFakeTimers();
  const first = makeTask({ id: "first", title: "Перша", inboxOrder: 0 });
  const second = makeTask({ id: "second", title: "Друга", inboxOrder: 1 });
  const onReorder = vi.fn();
  render(
    <InboxScreen
      tasks={[first, second]}
      today="2026-07-19"
      {...actions}
      onReorder={onReorder}
    />,
  );

  const firstCard = screen.getByLabelText(first.title);
  fireEvent.pointerDown(firstCard, { pointerId: 1, clientY: 40 });
  act(() => vi.advanceTimersByTime(350));
  fireEvent.pointerMove(firstCard, { pointerId: 1, clientY: 190 });
  fireEvent.pointerCancel(firstCard, { pointerId: 1 });

  expect(onReorder).not.toHaveBeenCalled();
  vi.useRealTimers();
});

it("does not start dragging when a touch becomes a normal vertical scroll", () => {
  vi.useFakeTimers();
  const first = makeTask({ id: "first", title: "Перша", inboxOrder: 0 });
  render(
    <InboxScreen
      tasks={[first, makeTask({ id: "second", title: "Друга", inboxOrder: 1 })]}
      today="2026-07-19"
      {...actions}
    />,
  );

  const firstCard = screen.getByLabelText(first.title);
  fireEvent.pointerDown(firstCard, { pointerId: 1, clientY: 40 });
  fireEvent.pointerMove(firstCard, { pointerId: 1, clientY: 66 });
  act(() => vi.advanceTimersByTime(350));

  expect(screen.queryByTestId("inbox-drop-marker")).not.toBeInTheDocument();
  vi.useRealTimers();
});

it("keeps a long-press drag active when the finger releases in a gap between cards", () => {
  vi.useFakeTimers();
  const first = makeTask({ id: "first", title: "Перша", inboxOrder: 0 });
  const second = makeTask({ id: "second", title: "Друга", inboxOrder: 1 });
  const onReorder = vi.fn();
  render(
    <InboxScreen
      tasks={[first, second]}
      today="2026-07-19"
      {...actions}
      onReorder={onReorder}
    />,
  );

  const firstCard = screen.getByLabelText(first.title);
  const list = firstCard.closest(".task-list");
  if (!list) throw new Error("Task list is unavailable");
  fireEvent.pointerDown(firstCard, { pointerId: 1, clientY: 40 });
  act(() => vi.advanceTimersByTime(350));
  fireEvent.pointerUp(list, { pointerId: 1, clientY: 190 });

  expect(onReorder).toHaveBeenCalledWith([second.id, first.id]);
  vi.useRealTimers();
});

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

it("shows the empty Inbox prompt when there are no active tasks", () => {
  render(<InboxScreen tasks={[]} today="2026-07-19" {...actions} />);

  expect(screen.getByText("Запиши зараз, сплануй потім")).toBeVisible();
  expect(screen.getByAltText("")).toHaveAttribute(
    "src",
    expect.stringContaining("empty-task-state-cat.png"),
  );
});

it("waits for completion feedback before completing an Inbox task", async () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  render(<InboxScreen tasks={[undated]} today="2026-07-19" {...actions} onComplete={onComplete} />);
  fireEvent.click(screen.getByRole("button", { name: /Позначити.*виконаною/ }));
  expect(onComplete).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(360); });
  expect(onComplete).toHaveBeenCalledWith(undated.id);
  vi.useRealTimers();
});
