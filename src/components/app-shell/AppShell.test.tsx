import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskProvider } from "@/features/tasks/application/TaskProvider";
import { createMemoryTaskRepository } from "../../../tests/fixtures/memoryTaskRepository";
import { AppShell } from "./AppShell";

it("opens Capture and switches between exactly three destinations", async () => {
  const user = userEvent.setup();
  const repository = createMemoryTaskRepository();

  render(
    <TaskProvider repository={repository}>
      <AppShell />
    </TaskProvider>,
  );

  expect(screen.getByRole("heading", { name: "Що в голові?" })).toBeVisible();
  expect(screen.getAllByRole("navigation")).toHaveLength(1);
  expect(
    screen.getAllByRole("button", { name: /^(Capture|Inbox|План)$/ }),
  ).toHaveLength(3);

  await user.click(screen.getByRole("button", { name: "Inbox" }));
  expect(screen.getByRole("heading", { name: "Inbox" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Inbox" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await user.click(screen.getByRole("button", { name: "План" }));
  expect(screen.getByRole("heading", { name: "План" })).toBeVisible();
});
