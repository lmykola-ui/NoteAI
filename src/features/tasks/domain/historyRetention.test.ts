import { makeTask } from "../../../../tests/fixtures/taskFactory";
import { expiredCompletedTaskIds } from "./historyRetention";

it("selects only completed tasks older than 30 days", () => {
  const now = new Date("2026-07-22T12:00:00.000Z");
  const expired = makeTask({
    id: "expired",
    status: "completed",
    completedAt: "2026-06-22T11:59:59.999Z",
  });
  const boundary = makeTask({
    id: "boundary",
    status: "completed",
    completedAt: "2026-06-22T12:00:00.000Z",
  });
  const active = makeTask({
    id: "active",
    status: "active",
    completedAt: "2026-06-01T00:00:00.000Z",
  });
  const timestampLess = makeTask({
    id: "unknown",
    status: "completed",
    completedAt: null,
  });

  expect(
    expiredCompletedTaskIds([expired, boundary, active, timestampLess], now),
  ).toEqual(["expired"]);
});
