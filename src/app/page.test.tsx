import { render, screen } from "@testing-library/react";
import HomePage from "./page";

it("opens on the Ukrainian Capture screen", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", { name: "Що в голові?" })).toBeVisible();
  expect(screen.getByRole("navigation", { name: "Основна навігація" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Capture" })).toHaveAttribute("aria-current", "page");
});
