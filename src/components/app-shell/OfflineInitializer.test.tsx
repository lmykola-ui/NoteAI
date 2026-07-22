import { render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OfflineInitializer } from "./OfflineInitializer";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.offlineReady;
});

it("caches only the root shell and explicit Next static assets", async () => {
  const put = vi.fn().mockResolvedValue(undefined);
  const fetch = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("caches", {
    open: vi.fn().mockResolvedValue({ put }),
  });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      controller: null,
      ready: Promise.resolve({}),
      register: vi.fn().mockResolvedValue({}),
    },
  });
  vi.spyOn(performance, "getEntriesByType").mockReturnValue([
    { name: `${window.location.origin}/_next/static/chunks/app.js` },
    { name: `${window.location.origin}/private-export.json` },
    { name: "https://third-party.example/tracker.js" },
  ] as PerformanceResourceTiming[]);

  render(<OfflineInitializer />);
  window.dispatchEvent(new Event("noteai:local-data-ready"));

  await waitFor(() =>
    expect(document.documentElement.dataset.offlineReady).toBe("true"),
  );
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenCalledWith(`${window.location.origin}/`, {
    cache: "reload",
  });
  expect(fetch).toHaveBeenCalledWith(
    `${window.location.origin}/_next/static/chunks/app.js`,
    { cache: "reload" },
  );
  expect(fetch).not.toHaveBeenCalledWith(
    `${window.location.origin}/private-export.json`,
    expect.anything(),
  );
});

it("removes a stale offline worker and its shell cache during development", async () => {
  const unregister = vi.fn().mockResolvedValue(true);
  const deleteCache = vi.fn().mockResolvedValue(true);
  vi.stubEnv("NODE_ENV", "development");
  vi.stubGlobal("caches", { delete: deleteCache });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistrations: vi.fn().mockResolvedValue([{ unregister }]),
    },
  });

  render(<OfflineInitializer />);

  await waitFor(() => expect(unregister).toHaveBeenCalledOnce());
  expect(deleteCache).toHaveBeenCalledWith("noteai-shell-v2");
});
