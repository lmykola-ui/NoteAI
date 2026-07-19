import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { parseText } from "./parseClient";

const request = {
  text: "Купити молоко",
  today: "2026-07-19",
  timeZone: "Europe/Warsaw",
  inputMethod: "text" as const,
};

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("does not cross the parse fetch boundary while offline", async () => {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  await expect(parseText(request)).rejects.toThrow("OFFLINE");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("aborts a pending parse request immediately on an offline event", async () => {
  const fetchMock = vi.fn((_url: string, options: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const pending = parseText(request);
  const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  window.dispatchEvent(new Event("offline"));

  expect(options.signal).toBeInstanceOf(AbortSignal);
  expect(options.signal?.aborted).toBe(true);
  await expect(pending).rejects.toThrow("OFFLINE");
});

it("discards a parsed response if connectivity is lost while reading it", async () => {
  let resolveJson!: (value: unknown) => void;
  const json = new Promise((resolve) => {
    resolveJson = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockReturnValue(json),
    } as unknown as Response),
  );

  const pending = parseText(request);
  await Promise.resolve();
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  window.dispatchEvent(new Event("offline"));
  resolveJson({ tasks: [], clarification: null });

  await expect(pending).rejects.toThrow("OFFLINE");
});
