import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ukrainianParserContractCases } from "../../../tests/fixtures/ukrainian-cases";
import { parseTasksWithClient } from "./parseTasks";

vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({
  createOpenAIClient: vi.fn(),
  taskModel: "gpt-5.6-terra",
}));

describe("parseTasksWithClient", () => {
  it("keeps the mocked Ukrainian parser contract at ten cases", () => {
    expect(ukrainianParserContractCases).toHaveLength(10);
  });

  it.each(ukrainianParserContractCases)(
    "honors mocked parser contract: $name",
    async ({ input, today, modelOutput, expected }) => {
      const parse = vi.fn().mockResolvedValue({ output_parsed: modelOutput });
      const client = {
        responses: { parse },
      } as unknown as Parameters<typeof parseTasksWithClient>[0];

      const result = await parseTasksWithClient(client, {
        text: input,
        today,
        timeZone: "Europe/Warsaw",
        inputMethod: "text",
      });

      expect(result).toEqual(expected);
      expect(parse).toHaveBeenCalledOnce();
      const request = parse.mock.calls[0]?.[0];
      expect(request.input).toEqual([
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("Не вигадуй дату, час, статус або пріоритет"),
        }),
        {
          role: "user",
          content: `Локальна дата: ${today}\nЧасовий пояс: Europe/Warsaw\nНотатка: ${input}`,
        },
      ]);
    },
  );

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
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("trims a bounded non-blank clarification outcome", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        tasks: [],
        clarification: "  Коли саме запланувати зустріч?  ",
      },
    });
    const client = {
      responses: { parse },
    } as unknown as Parameters<typeof parseTasksWithClient>[0];

    await expect(
      parseTasksWithClient(client, {
        text: "Заплануй зустріч якось потім",
        today: "2026-07-19",
        timeZone: "Europe/Warsaw",
        inputMethod: "text",
      }),
    ).resolves.toEqual({
      tasks: [],
      clarification: "Коли саме запланувати зустріч?",
    });
  });

  it.each([
    ["a blank clarification", { tasks: [], clarification: "   " }],
    ["neither tasks nor a clarification", { tasks: [], clarification: null }],
  ])("fails closed after two attempts for %s", async (_case, outputParsed) => {
    const parse = vi.fn().mockResolvedValue({ output_parsed: outputParsed });
    const client = {
      responses: { parse },
    } as unknown as Parameters<typeof parseTasksWithClient>[0];

    await expect(
      parseTasksWithClient(client, {
        text: "Заплануй зустріч",
        today: "2026-07-19",
        timeZone: "Europe/Warsaw",
        inputMethod: "text",
      }),
    ).rejects.toThrow("INVALID_AI_RESPONSE");
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("bounds a clarification to 300 characters", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        tasks: [],
        clarification: `  ${"а".repeat(301)}  `,
      },
    });
    const client = {
      responses: { parse },
    } as unknown as Parameters<typeof parseTasksWithClient>[0];

    await expect(
      parseTasksWithClient(client, {
        text: "Заплануй зустріч",
        today: "2026-07-19",
        timeZone: "Europe/Warsaw",
        inputMethod: "text",
      }),
    ).resolves.toEqual({
      tasks: [],
      clarification: "а".repeat(300),
    });
    expect(parse).toHaveBeenCalledOnce();
  });

  it("keeps tasks and discards a simultaneous clarification", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        tasks: [
          {
            title: "  Запланувати зустріч  ",
            scheduledDate: null,
            scheduledTime: null,
            status: "active",
            priority: null,
          },
        ],
        clarification: "Коли саме?",
      },
    });
    const client = {
      responses: { parse },
    } as unknown as Parameters<typeof parseTasksWithClient>[0];

    await expect(
      parseTasksWithClient(client, {
        text: "Заплануй зустріч",
        today: "2026-07-19",
        timeZone: "Europe/Warsaw",
        inputMethod: "text",
      }),
    ).resolves.toEqual({
      tasks: [
        {
          title: "Запланувати зустріч",
          scheduledDate: null,
          scheduledTime: null,
          status: "active",
          priority: null,
          inputMethod: "text",
        },
      ],
      clarification: null,
    });
  });

  it("keeps a task while discarding an impossible optional date and time", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        tasks: [
          {
            title: "  Купити молоко  ",
            scheduledDate: "2026-02-29",
            scheduledTime: "24:00",
            status: "active",
            priority: null,
          },
        ],
        clarification: "Коли саме?",
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
    ).resolves.toEqual({
      tasks: [
        {
          title: "Купити молоко",
          scheduledDate: null,
          scheduledTime: null,
          status: "active",
          priority: null,
          inputMethod: "text",
        },
      ],
      clarification: null,
    });
  });

  it("discards blank tasks and fails after two attempts", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        tasks: [
          {
            title: "   ",
            scheduledDate: null,
            scheduledTime: null,
            status: "active",
            priority: null,
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
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("retries once after an SDK structured-output parse failure", async () => {
    const schemaFailure = (() => {
      try {
        z.string().parse(123);
      } catch (error) {
        return error;
      }
    })();
    const parse = vi
      .fn()
      .mockRejectedValueOnce(schemaFailure)
      .mockResolvedValueOnce({
        output_parsed: {
          tasks: [
            {
              title: "Купити молоко",
              scheduledDate: null,
              scheduledTime: null,
              status: "active",
              priority: null,
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
    ).resolves.toMatchObject({
      tasks: [expect.objectContaining({ title: "Купити молоко" })],
      clarification: null,
    });
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("retries a bundled ZodError from a different module instance", async () => {
    const ForeignZodError = class ZodError extends Error {};
    const parse = vi
      .fn()
      .mockRejectedValueOnce(new ForeignZodError("private model output"))
      .mockResolvedValueOnce({
        output_parsed: {
          tasks: [
            {
              title: "Купити молоко",
              scheduledDate: null,
              scheduledTime: null,
              status: "active",
              priority: null,
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
    ).resolves.toMatchObject({
      tasks: [expect.objectContaining({ title: "Купити молоко" })],
      clarification: null,
    });
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("does not retry a provider API error", async () => {
    class RateLimitError extends Error {
      status = 429;
      code = "rate_limit_exceeded";
    }

    const providerError = new RateLimitError("provider detail");
    const parse = vi.fn().mockRejectedValue(providerError);
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
    ).rejects.toBe(providerError);
    expect(parse).toHaveBeenCalledOnce();
  });

  it("fails after two unusable structured responses", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: { tasks: [], clarification: null },
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
    expect(parse).toHaveBeenCalledTimes(2);
  });
});
