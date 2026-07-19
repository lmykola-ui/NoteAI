import { describe, expect, it, vi } from "vitest";
import { parseTasksWithClient } from "./parseTasks";

vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({
  createOpenAIClient: vi.fn(),
  taskModel: "gpt-5.6-terra",
}));

describe("parseTasksWithClient", () => {
  it("normalizes structured Ukrainian task output", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        tasks: [
          {
            title: "Купити молоко",
            scheduledDate: "2026-07-19",
            scheduledTime: null,
            status: "active",
            priority: null,
          },
          {
            title: "Перевірити пошту",
            scheduledDate: "2026-07-20",
            scheduledTime: null,
            status: "active",
            priority: null,
          },
          {
            title: "Оплатити рахунок",
            scheduledDate: null,
            scheduledTime: null,
            status: "completed",
            priority: null,
          },
        ],
        clarification: null,
      },
    });
    const client = {
      responses: { parse },
    } as unknown as Parameters<typeof parseTasksWithClient>[0];

    const result = await parseTasksWithClient(client, {
      text: "Молоко купити сьогодні, пошту глянути завтра, а рахунок я вже оплатив",
      today: "2026-07-19",
      timeZone: "Europe/Warsaw",
      inputMethod: "text",
    });

    expect(result).toEqual({
      clarification: null,
      tasks: [
        {
          title: "Купити молоко",
          scheduledDate: "2026-07-19",
          scheduledTime: null,
          status: "active",
          priority: null,
          inputMethod: "text",
        },
        {
          title: "Перевірити пошту",
          scheduledDate: "2026-07-20",
          scheduledTime: null,
          status: "active",
          priority: null,
          inputMethod: "text",
        },
        {
          title: "Оплатити рахунок",
          scheduledDate: null,
          scheduledTime: null,
          status: "completed",
          priority: null,
          inputMethod: "text",
        },
      ],
    });
  });

  it("fails closed when no parsed payload is returned", async () => {
    const parse = vi.fn().mockResolvedValue({ output_parsed: null });
    const client = {
      responses: { parse },
    } as unknown as Parameters<typeof parseTasksWithClient>[0];

    await expect(
      parseTasksWithClient(client, {
        text: "Купити молоко",
        today: "2026-07-19",
        timeZone: "Europe/Warsaw",
        inputMethod: "text",
      }),
    ).rejects.toThrow("INVALID_AI_RESPONSE");
  });

  it.each([
    ["a whitespace-only title", { title: "   " }],
    ["an impossible calendar date", { scheduledDate: "2026-02-29" }],
    ["an impossible time", { scheduledTime: "24:00" }],
  ])("fails closed when parsed output contains %s", async (_case, override) => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        tasks: [
          {
            title: "Купити молоко",
            scheduledDate: "2026-07-19",
            scheduledTime: "09:30",
            status: "active",
            priority: null,
            ...override,
          },
        ],
        clarification: null,
      },
    });
    const client = {
      responses: { parse },
    } as unknown as Parameters<typeof parseTasksWithClient>[0];

    await expect(
      parseTasksWithClient(client, {
        text: "Купити молоко",
        today: "2026-07-19",
        timeZone: "Europe/Warsaw",
        inputMethod: "text",
      }),
    ).rejects.toThrow("INVALID_AI_RESPONSE");
  });
});
