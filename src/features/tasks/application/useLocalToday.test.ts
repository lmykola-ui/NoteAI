import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  millisecondsUntilNextLocalMidnight,
  useLocalToday,
} from "./useLocalToday";

afterEach(() => {
  vi.useRealTimers();
});

it("computes the next local midnight from calendar fields so DST-length days are respected", () => {
  const now = new Date(2026, 2, 29, 0, 30, 0, 0);
  const expectedMidnight = new Date(2026, 2, 30, 0, 0, 0, 0);

  expect(millisecondsUntilNextLocalMidnight(now)).toBe(
    expectedMidnight.getTime() - now.getTime(),
  );
});

it("rolls today at the next local midnight without another application render", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 19, 23, 59, 59, 900));
  const { result } = renderHook(() => useLocalToday());

  expect(result.current).toBe("2026-07-19");

  act(() => {
    vi.advanceTimersByTime(100);
  });

  expect(result.current).toBe("2026-07-20");
});
