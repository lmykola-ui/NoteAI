import { addLocalDays, classifyTaskDate } from "./dateWindow";

const today = "2026-07-19";

it.each([
  [null, "inbox"],
  ["2026-07-18", "inbox"],
  ["2026-07-19", "plan"],
  ["2026-07-25", "plan"],
  ["2026-07-26", "inbox"],
] as const)("classifies %s as %s", (date, destination) => {
  expect(classifyTaskDate(date, today)).toBe(destination);
});

it("adds local calendar days without UTC conversion", () => {
  expect(addLocalDays("2026-03-28", 2)).toBe("2026-03-30");
});
