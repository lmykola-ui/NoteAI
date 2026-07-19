import { afterEach, expect, it, vi } from "vitest";
import { requestLocalPersistence } from "./storagePersistence";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("reports granted persistent storage", async () => {
  vi.stubGlobal("navigator", {
    storage: {
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(true),
    },
  });

  await expect(requestLocalPersistence()).resolves.toBe("persistent");
});

it("does not request persistence when it is already granted", async () => {
  const persist = vi.fn();
  vi.stubGlobal("navigator", {
    storage: {
      persisted: vi.fn().mockResolvedValue(true),
      persist,
    },
  });

  await expect(requestLocalPersistence()).resolves.toBe("persistent");
  expect(persist).not.toHaveBeenCalled();
});

it("falls back honestly when the API is unavailable", async () => {
  vi.stubGlobal("navigator", {});

  await expect(requestLocalPersistence()).resolves.toBe("best-effort");
});
