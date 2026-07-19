import { afterEach, expect, it, vi } from "vitest";
import { trackSafeEvent } from "./analytics";

const analyticsMocks = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("@vercel/analytics", () => ({
  track: analyticsMocks.track,
}));

afterEach(() => {
  analyticsMocks.track.mockReset();
  vi.unstubAllEnvs();
});

it("tracks an allowlisted event without event data when analytics is enabled", () => {
  vi.stubEnv("NEXT_PUBLIC_ENABLE_ANALYTICS", "true");

  trackSafeEvent("capture_confirmed");

  expect(analyticsMocks.track).toHaveBeenCalledOnce();
  expect(analyticsMocks.track.mock.calls[0]).toEqual(["capture_confirmed"]);
});

it("does not track when analytics is disabled", () => {
  vi.stubEnv("NEXT_PUBLIC_ENABLE_ANALYTICS", "false");

  trackSafeEvent("parse_failed");

  expect(analyticsMocks.track).not.toHaveBeenCalled();
});
