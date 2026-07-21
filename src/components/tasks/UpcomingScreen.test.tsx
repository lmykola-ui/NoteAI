import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { makeTask } from "../../../tests/fixtures/taskFactory";
import { UpcomingScreen } from "./UpcomingScreen";

const actions = { onChange: vi.fn(), onComplete: vi.fn(), onRestore: vi.fn(), onDelete: vi.fn() };

it("shows a month calendar that can change months and select a date", async () => {
  const user = userEvent.setup();
  render(<UpcomingScreen tasks={[makeTask({ scheduledDate: "2026-07-22", title: "Завтрашня" })]} today="2026-07-21" {...actions} />);
  expect(screen.getByRole("heading", { name: "Заплановані" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Наступний місяць" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Обрати 22 липень" }));
  expect(screen.getByText("Завтрашня")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Наступний місяць" }));
  expect(screen.getByText(/серпень/i)).toBeVisible();
});
