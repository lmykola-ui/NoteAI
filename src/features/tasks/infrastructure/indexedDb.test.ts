import { expect, it, vi } from "vitest";

it("does not open IndexedDB while the module is evaluated on the server", async () => {
  vi.stubGlobal("indexedDB", undefined);
  vi.resetModules();

  await expect(import("./indexedDb")).resolves.toMatchObject({
    getNoteAiDb: expect.any(Function),
  });

  vi.unstubAllGlobals();
});
