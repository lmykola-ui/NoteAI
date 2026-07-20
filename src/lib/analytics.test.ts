import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { initializeSafeAnalytics, trackSafeEvent } from "./analytics";

function resetAnalyticsBrowserState() {
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
}

beforeEach(() => {
  resetAnalyticsBrowserState();
});

afterEach(() => {
  resetAnalyticsBrowserState();
  vi.unstubAllEnvs();
});

it("initializes the real SDK without automatic views and rejects page context", () => {
  vi.stubEnv("NEXT_PUBLIC_ENABLE_ANALYTICS", "true");

  initializeSafeAnalytics();

  const script = document.querySelector<HTMLScriptElement>(
    'script[data-disable-auto-track="1"]',
  );
  expect(script).not.toBeNull();
  expect(window.vaq).toHaveLength(1);

  const [command, middleware] = window.vaq![0];
  expect(command).toBe("beforeSend");
  expect(middleware).toBeTypeOf("function");

  const beforeSend = middleware as (
    event: { type: "pageview" | "event"; url: string },
  ) => { type: "event"; url: string } | null;
  expect(
    beforeSend({
      type: "pageview",
      url: "https://note-ai-smoky.vercel.app/private-note?draft=secret",
    }),
  ).toBeNull();
  expect(
    beforeSend({
      type: "event",
      url: "https://note-ai-smoky.vercel.app/private-note?draft=secret",
    }),
  ).toEqual({ type: "event", url: "https://note-ai-smoky.vercel.app/" });
});

it("queues exactly one allowlisted custom name without properties or page context", () => {
  vi.stubEnv("NEXT_PUBLIC_ENABLE_ANALYTICS", "true");
  initializeSafeAnalytics();

  trackSafeEvent("capture_confirmed");

  expect(window.vaq).toHaveLength(2);
  expect(window.vaq![1]).toEqual([
    "event",
    { name: "capture_confirmed", options: undefined },
  ]);
  expect(window.vaq![1][1]).not.toHaveProperty("data");
  expect(window.vaq![1][1]).not.toHaveProperty("url");
  expect(window.vaq![1][1]).not.toHaveProperty("path");
  expect(window.vaq![1][1]).not.toHaveProperty("route");
});

it("rejects a non-allowlisted event name at runtime", () => {
  vi.stubEnv("NEXT_PUBLIC_ENABLE_ANALYTICS", "true");
  initializeSafeAnalytics();

  trackSafeEvent("private_note_opened" as never);

  expect(window.vaq?.map(([command]) => command)).toEqual(["beforeSend"]);
});

it("does not initialize or track when analytics is disabled", () => {
  vi.stubEnv("NEXT_PUBLIC_ENABLE_ANALYTICS", "false");

  initializeSafeAnalytics();
  trackSafeEvent("parse_failed");

  expect(window.va).toBeUndefined();
  expect(window.vaq).toBeUndefined();
  expect(
    document.querySelector('script[data-disable-auto-track="1"]'),
  ).toBeNull();
});
