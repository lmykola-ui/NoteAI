import { render, screen } from "@testing-library/react";
import { EmptyTaskState } from "./EmptyTaskState";

it("renders the decorative illustration and its message", () => {
  render(<EmptyTaskState message="Запиши зараз, сплануй потім" />);

  expect(screen.getByAltText("")).toHaveAttribute(
    "src",
    expect.stringContaining("empty-task-state-cat.png"),
  );
  expect(screen.getByText("Запиши зараз, сплануй потім")).toBeVisible();
});
