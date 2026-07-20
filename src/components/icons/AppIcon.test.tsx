import { render, screen } from "@testing-library/react";
import { AppIcon } from "./AppIcon";

it("hides decorative icons from assistive technology", () => {
  const { container } = render(<AppIcon name="mic" decorative />);

  expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
});

it("labels semantic icons", () => {
  render(<AppIcon name="calendar" />);

  expect(screen.getByRole("img", { name: "Календар" })).toBeVisible();
});
