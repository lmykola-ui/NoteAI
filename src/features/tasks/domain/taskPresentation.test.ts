import { expect, it } from "vitest";
import { formatTaskSchedule, priorityPresentation } from "./taskPresentation";

it("maps stored priorities to the approved Ukrainian presentation", () => {
  expect(priorityPresentation("high")).toMatchObject({
    label: "Висока",
    tone: "high",
    direction: "highest",
  });
  expect(priorityPresentation("medium")).toMatchObject({
    label: "Середня",
    tone: "medium",
    direction: "up",
  });
  expect(priorityPresentation("low")).toMatchObject({
    label: "Мінімальна",
    tone: "minimal",
    direction: "down",
  });
  expect(priorityPresentation(null)).toMatchObject({
    label: "Без пріоритету",
    tone: "none",
    direction: "flat",
  });
});

it("formats relative Ukrainian date and optional time", () => {
  expect(
    formatTaskSchedule(
      { scheduledDate: "2026-07-21", scheduledTime: "11:00" },
      "2026-07-21",
    ),
  ).toBe("Сьогодні · 11:00");
  expect(
    formatTaskSchedule(
      { scheduledDate: "2026-07-22", scheduledTime: null },
      "2026-07-21",
    ),
  ).toBe("Завтра");
  expect(
    formatTaskSchedule(
      { scheduledDate: null, scheduledTime: null },
      "2026-07-21",
    ),
  ).toBe("Без терміну");
});
