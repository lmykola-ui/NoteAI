import { describe, expect, it, vi } from "vitest";
import { ukrainianParserContractCases } from "../../../tests/fixtures/ukrainian-cases";
import { parseTasksWithClient } from "./parseTasks";

const usageMocks = vi.hoisted(() => ({
  emit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({
  createOpenAIClient: vi.fn(),
  taskModel: "gpt-5-nano",
}));
vi.mock("./usageDiagnostics", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("./usageDiagnostics")
  >();
  return { ...original, emitOpenAIUsage: usageMocks.emit };
});

describe("parseTasksWithClient", () => {
  it("keeps the mocked Ukrainian parser contract at thirteen cases", () => {
    expect(ukrainianParserContractCases).toHaveLength(13);
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
          content: expect.stringMatching(
            /атомарну дію[\s\S]*не повторюй спільний вступ[\s\S]*не додавай.*пріоритет.*title/i,
          ),
        }),
        {
          role: "user",
          content: `Локальна дата: ${today}\nЧасовий пояс: Europe/Warsaw\nНотатка: ${input}`,
        },
      ]);
      expect(request).toMatchObject({
        model: "gpt-5-nano",
        max_output_tokens: 1_200,
        reasoning: { effort: "minimal" },
      });
      expect(parse.mock.calls[0]?.[1]).toEqual({
        timeout: 15_000,
        maxRetries: 1,
      });
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

  it("keeps a grouped shopping list in one task description", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        tasks: [
          {
            title: "  Сходити в магазин  ",
            description: "  • Кава\n• Молоко\n• Хліб  ",
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
        text: "Треба сходити в магазин і купити каву, молоко та хліб",
        today: "2026-07-22",
        timeZone: "Europe/Warsaw",
        inputMethod: "voice",
      }),
    ).resolves.toEqual({
      tasks: [
        {
          title: "Сходити в магазин",
          description: "• Кава\n• Молоко\n• Хліб",
          scheduledDate: null,
          scheduledTime: null,
          status: "active",
          priority: null,
          inputMethod: "voice",
        },
      ],
      clarification: null,
    });
  });

  it("omits an unspecified description from a basic task", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        tasks: [{
          title: "Сходити в магазин",
          description: " unspecified ",
          scheduledDate: null,
          scheduledTime: null,
          status: "active",
          priority: null,
        }],
        clarification: null,
      },
    });
    const client = { responses: { parse } } as unknown as Parameters<typeof parseTasksWithClient>[0];

    await expect(parseTasksWithClient(client, {
      text: "Сходити в магазин",
      today: "2026-07-22",
      timeZone: "Europe/Warsaw",
      inputMethod: "text",
    })).resolves.toEqual({
      tasks: [{
        title: "Сходити в магазин",
        scheduledDate: null,
        scheduledTime: null,
        status: "active",
        priority: null,
        inputMethod: "text",
      }],
      clarification: null,
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
    expect(parse).toHaveBeenCalledOnce();
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
  ])("fails closed without retrying for %s", async (_case, outputParsed) => {
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
    expect(parse).toHaveBeenCalledOnce();
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

  it("discards blank tasks without retrying", async () => {
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
    expect(parse).toHaveBeenCalledOnce();
  });

  it.each([
    ["Zod", class ZodError extends Error {}],
    ["OpenAI parser", class OpenAIError extends Error {}],
    ["length finish", class LengthFinishReasonError extends Error {}],
  ])(
    "does not buy a second analysis after a local %s error",
    async (_case, ErrorType) => {
      const failure = new ErrorType("private model output");
      const parse = vi.fn().mockRejectedValue(failure);
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
      ).rejects.toBe(failure);
      expect(parse).toHaveBeenCalledOnce();
    },
  );

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

  it("fails after one unusable structured response", async () => {
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
    expect(parse).toHaveBeenCalledOnce();
  });

  it("emits only normalized usage for a provider response", async () => {
    usageMocks.emit.mockReset();
    const parse = vi.fn().mockResolvedValue({
      _request_id: "req_parse_123",
      usage: {
        input_tokens: 100,
        input_tokens_details: { cached_tokens: 10 },
        output_tokens: 20,
        output_tokens_details: { reasoning_tokens: 5 },
        total_tokens: 120,
        privateNote: "Купити молоко",
      },
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

    await parseTasksWithClient(client, {
      text: "Купити молоко",
      today: "2026-07-19",
      timeZone: "Europe/Warsaw",
      inputMethod: "text",
    });

    expect(usageMocks.emit).toHaveBeenCalledWith({
      event: "openai_usage",
      operation: "parse",
      outcome: "provider_response",
      model: "gpt-5-nano",
      requestId: "req_parse_123",
      inputTokens: 100,
      cachedInputTokens: 10,
      outputTokens: 20,
      reasoningTokens: 5,
      totalTokens: 120,
      audioDurationSeconds: null,
      estimatedCostUsdMicros: 13,
      pricingSnapshot: "2026-07-20",
      retryPolicy: "sdk_max_1",
    });
    expect(JSON.stringify(usageMocks.emit.mock.calls)).not.toContain(
      "Купити молоко",
    );
  });
});
