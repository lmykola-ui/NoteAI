import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { makeTask } from "../../../tests/fixtures/taskFactory";
import { HistoryScreen } from "./HistoryScreen";

it("keeps history when clearing is cancelled", async () => {
  const user = userEvent.setup();
  const onClear = vi.fn();

  render(
    <HistoryScreen
      tasks={[makeTask({ status: "completed", completedAt: "2026-07-22T09:00:00.000Z" })]}
      today="2026-07-22"
      onRestore={vi.fn()}
      onClose={vi.fn()}
      onClear={onClear}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Очистити історію" }));

  expect(screen.getByRole("dialog", { name: "Очистити історію" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Скасувати" }));

  expect(onClear).not.toHaveBeenCalled();
  expect(screen.getByText("Купити молоко")).toBeVisible();
});

it("confirms clearing and disables the trash control when empty", async () => {
  const user = userEvent.setup();
  const onClear = vi.fn().mockResolvedValue(undefined);
  const { rerender } = render(
    <HistoryScreen
      tasks={[makeTask({ status: "completed", completedAt: "2026-07-22T09:00:00.000Z" })]}
      today="2026-07-22"
      onRestore={vi.fn()}
      onClose={vi.fn()}
      onClear={onClear}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Очистити історію" }));
  await user.click(screen.getByRole("button", { name: "Очистити" }));

  expect(onClear).toHaveBeenCalledOnce();

  rerender(
    <HistoryScreen
      tasks={[]}
      today="2026-07-22"
      onRestore={vi.fn()}
      onClose={vi.fn()}
      onClear={onClear}
    />,
  );

  expect(screen.getByRole("button", { name: "Очистити історію" })).toBeDisabled();
});
