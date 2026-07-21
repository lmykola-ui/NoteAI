import { render, screen } from "@testing-library/react";
import HomePage from "./page";

it("opens on the Ukrainian Inbox screen", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", { name: "Вхідні" })).toBeVisible();
  expect(screen.getByRole("region", { name: "Вхідні" })).toBeVisible();
  expect(screen.getByRole("navigation", { name: "Основна навігація" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Вхідні" })).toHaveAttribute("aria-current", "page");
});
