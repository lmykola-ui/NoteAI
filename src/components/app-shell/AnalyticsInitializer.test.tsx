import { render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AnalyticsInitializer } from "./AnalyticsInitializer";

afterEach(() => {
  Object.defineProperty(window, "va", {
    configurable: true,
    value: undefined,
    writable: true,
  });
  Object.defineProperty(window, "vaq", {
    configurable: true,
    value: undefined,
    writable: true,
  });
  document
    .querySelectorAll('script[data-disable-auto-track="1"]')
    .forEach((script) => script.remove());
  vi.unstubAllEnvs();
});

it("initializes safe custom-event analytics after the client mounts", async () => {
  vi.stubEnv("NEXT_PUBLIC_ENABLE_ANALYTICS", "true");

  render(<AnalyticsInitializer />);

  await waitFor(() => {
    expect(
      document.querySelector('script[data-disable-auto-track="1"]'),
    ).not.toBeNull();
  });
  expect(window.vaq?.map(([command]) => command)).toEqual(["beforeSend"]);
});
