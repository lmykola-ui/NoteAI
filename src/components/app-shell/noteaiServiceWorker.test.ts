import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

type FetchEvent = {
  request: {
    method: string;
    mode: string;
    url: string;
  };
  respondWith: ReturnType<typeof vi.fn>;
};

function loadFetchHandler() {
  let fetchHandler: ((event: FetchEvent) => void) | undefined;
  const self = {
    location: { origin: "https://noteai.example" },
    addEventListener: vi.fn((type: string, handler: (event: FetchEvent) => void) => {
      if (type === "fetch") fetchHandler = handler;
    }),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };

  runInNewContext(
    readFileSync("public/noteai-sw.js", "utf8"),
    {
      self,
      caches: {
        keys: vi.fn().mockResolvedValue([]),
        match: vi.fn().mockResolvedValue(undefined),
        open: vi.fn().mockResolvedValue({ put: vi.fn() }),
      },
      fetch: vi.fn().mockResolvedValue({ ok: true, clone: vi.fn() }),
      URL,
    },
  );

  if (!fetchHandler) throw new Error("Service worker fetch handler was not registered");
  return fetchHandler;
}

function request(pathname: string, mode = "cors"): FetchEvent {
  return {
    request: {
      method: "GET",
      mode,
      url: `https://noteai.example${pathname}`,
    },
    respondWith: vi.fn(),
  };
}

it("does not intercept arbitrary same-origin GET requests", () => {
  const handleFetch = loadFetchHandler();
  const event = request("/private-export.json");

  handleFetch(event);

  expect(event.respondWith).not.toHaveBeenCalled();
});

it("intercepts only the root shell and explicit Next static assets", () => {
  const handleFetch = loadFetchHandler();
  const root = request("/", "navigate");
  const staticAsset = request("/_next/static/chunks/app.js");
  const api = request("/api/parse");

  handleFetch(root);
  handleFetch(staticAsset);
  handleFetch(api);

  expect(root.respondWith).toHaveBeenCalledOnce();
  expect(staticAsset.respondWith).toHaveBeenCalledOnce();
  expect(api.respondWith).not.toHaveBeenCalled();
});
