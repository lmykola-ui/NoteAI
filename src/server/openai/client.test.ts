import { beforeEach, describe, expect, it, vi } from "vitest";

const openAIMocks = vi.hoisted(() => ({
  construct: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("openai", () => ({
  default: class OpenAI {
    constructor(options: unknown) {
      openAIMocks.construct(options);
    }
  },
}));

describe("OpenAI client configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    openAIMocks.construct.mockReset();
  });

  it("uses OPENAI_MODEL for task analysis", async () => {
    vi.stubEnv("OPENAI_MODEL", "configured-task-model");

    const { taskModel } = await import("./client");

    expect(taskModel).toBe("configured-task-model");
  });

  it("falls back to gpt-5-nano", async () => {
    vi.stubEnv("OPENAI_MODEL", "");

    const { taskModel } = await import("./client");

    expect(taskModel).toBe("gpt-5-nano");
  });

  it("does not instantiate the SDK when imported without an API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    await import("./client");

    expect(openAIMocks.construct).not.toHaveBeenCalled();
  });
});
