import { expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@/server/openai/client", () => ({
  openai: { responses: {} },
  taskModel: "gpt-5.6-terra",
}));

it("rejects blank task input before contacting OpenAI", async () => {
  const response = await POST(
    new Request("http://localhost/api/parse", {
      method: "POST",
      body: JSON.stringify({
        text: "",
        today: "2026-07-19",
        timeZone: "Europe/Warsaw",
        inputMethod: "text",
      }),
    }),
  );

  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({ code: "INVALID_REQUEST" });
});
