import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openAIMocks = vi.hoisted(() => ({
  construct: vi.fn(),
  parse: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("openai", () => ({
  default: class MockOpenAI {
    responses = { parse: openAIMocks.parse };

    constructor(options: { apiKey?: string } = {}) {
      openAIMocks.construct(options);
      if (!options.apiKey) {
        throw new Error("Missing credentials");
      }
    }
  },
}));

const validBody = {
  text: "Купити молоко",
  today: "2026-07-19",
  timeZone: "Europe/Warsaw",
  inputMethod: "text",
};

function requestWithBody(body: string) {
  return new Request("http://localhost/api/parse", {
    method: "POST",
    body,
  });
}

async function loadPost() {
  return (await import("./route")).POST;
}

describe("POST /api/parse", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    openAIMocks.construct.mockReset();
    openAIMocks.parse.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects malformed JSON before contacting OpenAI", async () => {
    const POST = await loadPost();
    const response = await POST(requestWithBody("{"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ code: "INVALID_REQUEST" });
    expect(openAIMocks.construct).not.toHaveBeenCalled();
  });

  it("rejects blank task input before contacting OpenAI", async () => {
    const POST = await loadPost();
    const response = await POST(
      requestWithBody(JSON.stringify({ ...validBody, text: "" })),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ code: "INVALID_REQUEST" });
    expect(openAIMocks.construct).not.toHaveBeenCalled();
  });

  it.each([
    ["an impossible date", { today: "2026-02-29" }],
    ["an invalid IANA time zone", { timeZone: "Mars/Olympus" }],
    ["a numeric UTC offset", { timeZone: "+01:00" }],
  ])("rejects %s before contacting OpenAI", async (_case, override) => {
    const POST = await loadPost();
    const response = await POST(
      requestWithBody(JSON.stringify({ ...validBody, ...override })),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ code: "INVALID_REQUEST" });
    expect(openAIMocks.construct).not.toHaveBeenCalled();
  });

  it("maps a provider failure to AI_UNAVAILABLE", async () => {
    openAIMocks.parse.mockRejectedValue(new Error("provider unavailable"));
    const POST = await loadPost();
    const response = await POST(requestWithBody(JSON.stringify(validBody)));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ code: "AI_UNAVAILABLE" });
  });

  it("loads without credentials and maps their absence to AI_UNAVAILABLE", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const POST = await loadPost();
    expect(openAIMocks.construct).not.toHaveBeenCalled();

    const response = await POST(requestWithBody(JSON.stringify(validBody)));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ code: "AI_UNAVAILABLE" });
    expect(openAIMocks.construct).toHaveBeenCalledOnce();
  });

  it("returns the normalized parsed task response", async () => {
    openAIMocks.parse.mockResolvedValue({
      output_parsed: {
        tasks: [
          {
            title: "  Купити молоко  ",
            scheduledDate: "2026-07-19",
            scheduledTime: "09:30",
            status: "active",
            priority: null,
          },
        ],
        clarification: null,
      },
    });
    const POST = await loadPost();
    const response = await POST(requestWithBody(JSON.stringify(validBody)));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      tasks: [
        {
          title: "Купити молоко",
          scheduledDate: "2026-07-19",
          scheduledTime: "09:30",
          status: "active",
          priority: null,
          inputMethod: "text",
        },
      ],
      clarification: null,
    });
  });
});
