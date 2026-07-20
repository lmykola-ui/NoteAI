import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { ukrainianParserContractCases } from "../tests/fixtures/ukrainian-cases";
import {
  evaluateUkrainianModelCase,
  resolveUkrainianModel,
  runUkrainianModelEval,
  ukrainianModelEvalCases,
} from "./ukrainianModelEval.mjs";

it("provides an opt-in model-backed Ukrainian evaluation harness", () => {
  expect(existsSync("scripts/ukrainianModelEval.mjs")).toBe(true);
});

it("uses the configured OpenAI model and falls back to gpt-5-nano", () => {
  expect(resolveUkrainianModel({ OPENAI_MODEL: "configured-model" })).toBe(
    "configured-model",
  );
  expect(resolveUkrainianModel({})).toBe("gpt-5-nano");
  expect(resolveUkrainianModel({ OPENAI_MODEL: "" })).toBe("gpt-5-nano");
});

it("evaluates the exact same eleven inputs as the mocked parser contract", () => {
  expect(ukrainianModelEvalCases).toHaveLength(11);
  expect(ukrainianModelEvalCases.map(({ input, today }) => ({ input, today }))).toEqual(
    ukrainianParserContractCases.map(({ input, today }) => ({ input, today })),
  );
});

it("allows documented title wording variants while grading semantics exactly", () => {
  const definition = ukrainianModelEvalCases[1];
  const issues = evaluateUkrainianModelCase(definition, {
    tasks: [
      {
        title: "Зателефонувати до лікаря",
        scheduledDate: "2026-07-19",
        scheduledTime: "17:00",
        status: "active",
        priority: null,
      },
    ],
    clarification: null,
  });

  expect(issues).toEqual([]);
});

it("rejects semantic drift and invented tasks in the ambiguity case", () => {
  const wrongTime = evaluateUkrainianModelCase(ukrainianModelEvalCases[1], {
    tasks: [
      {
        title: "Подзвонити лікарю",
        scheduledDate: "2026-07-19",
        scheduledTime: "18:00",
        status: "active",
        priority: null,
      },
    ],
    clarification: null,
  });
  const inventedTask = evaluateUkrainianModelCase(ukrainianModelEvalCases[5], {
    tasks: [
      {
        title: "Запланувати зустріч",
        scheduledDate: "2026-07-30",
        scheduledTime: null,
        status: "active",
        priority: null,
      },
    ],
    clarification: "Коли саме?",
  });

  expect(wrongTime).toContain(
    "task 1 scheduledTime: expected 17:00, received 18:00",
  );
  expect(inventedTask).toContain("task count: expected 0, received 1");
});

it("rejects repeated shared context in atomic template titles", () => {
  const definition = ukrainianModelEvalCases[10];
  const issues = evaluateUkrainianModelCase(definition, {
    tasks: [
      {
        title:
          "Схема: зробити три шаблони (перший — пріоритетний, другий — середній, третій — низька пріоритетність)",
        scheduledDate: null,
        scheduledTime: null,
        status: "active",
        priority: "high",
      },
      {
        title: "Схема: зробити три шаблони (другий — середній)",
        scheduledDate: null,
        scheduledTime: null,
        status: "active",
        priority: "medium",
      },
      {
        title: "Схема: зробити три шаблони (третій — низька пріоритетність)",
        scheduledDate: null,
        scheduledTime: null,
        status: "active",
        priority: "low",
      },
    ],
    clarification: null,
  });

  expect(issues).toContain("task 1 title: contains repeated shared context");
  expect(issues).toContain("task 2 title: contains repeated shared context");
  expect(issues).toContain("task 3 title: contains repeated shared context");
});

it("runs every case through a model-backed structured-output request", async () => {
  const parse = vi.fn();
  for (const definition of ukrainianParserContractCases) {
    parse.mockResolvedValueOnce({ output_parsed: definition.modelOutput });
  }

  const results = await runUkrainianModelEval({
    client: { responses: { parse } },
    model: "configured-model",
  });

  expect(results).toHaveLength(11);
  expect(results.every(({ issues }) => issues.length === 0)).toBe(true);
  expect(parse).toHaveBeenCalledTimes(11);
  expect(parse.mock.calls[0]?.[0]).toEqual(
    expect.objectContaining({
      model: "configured-model",
      input: [
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining(
            "Не вигадуй дату, час, статус або пріоритет",
          ),
        }),
        {
          role: "user",
          content:
            "Локальна дата: 2026-07-19\nЧасовий пояс: Europe/Warsaw\nНотатка: Молоко купити сьогодні, пошту глянути завтра, а рахунок я вже оплатив",
        },
      ],
    }),
  );
});

it("refuses to run the paid command without OPENAI_API_KEY", () => {
  const env = { ...process.env };
  delete env.OPENAI_API_KEY;

  const result = spawnSync(
    process.execPath,
    ["scripts/ukrainianModelEval.mjs"],
    { cwd: process.cwd(), env, encoding: "utf8" },
  );

  expect(result.status).toBe(2);
  expect(`${result.stdout}${result.stderr}`).toContain(
    "OPENAI_API_KEY is required",
  );
});
