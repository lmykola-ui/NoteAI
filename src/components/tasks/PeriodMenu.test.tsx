import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { PeriodMenu } from "./PeriodMenu";

it("selects today or week from a compact accessible menu", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();

  render(<PeriodMenu value="today" onChange={onChange} />);

  const trigger = screen.getByRole("button", { name: "Змінити період" });
  expect(trigger).toHaveTextContent("Сьогодні");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();

  await user.click(trigger);
  expect(screen.getByRole("menu", { name: "Період задач" })).toBeVisible();
  expect(screen.getByRole("menuitemradio", { name: "Сьогодні" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  await user.click(screen.getByRole("menuitemradio", { name: "Тиждень" }));
  expect(onChange).toHaveBeenCalledWith("week");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("closes on Escape and returns focus to the trigger", async () => {
  const user = userEvent.setup();

  render(<PeriodMenu value="week" onChange={vi.fn()} />);
  const trigger = screen.getByRole("button", { name: "Змінити період" });

  await user.click(trigger);
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("moves focus through menu options with arrow, Home, and End keys", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();

  render(<PeriodMenu value="today" onChange={onChange} />);
  await user.click(screen.getByRole("button", { name: "Змінити період" }));

  const today = screen.getByRole("menuitemradio", { name: "Сьогодні" });
  const week = screen.getByRole("menuitemradio", { name: "Тиждень" });
  expect(today).toHaveFocus();

  await user.keyboard("{ArrowDown}");
  expect(week).toHaveFocus();
  await user.keyboard("{Home}");
  expect(today).toHaveFocus();
  await user.keyboard("{End}{Enter}");

  expect(onChange).toHaveBeenCalledWith("week");
});
