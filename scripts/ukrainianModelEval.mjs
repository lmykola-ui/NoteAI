import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { taskSystemPrompt } from "../src/server/openai/taskPrompt.mjs";

const wireResultSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(300),
        scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
        scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
        status: z.enum(["active", "completed"]),
        priority: z.enum(["low", "medium", "high"]).nullable(),
      }),
    )
    .max(50),
  clarification: z.string().max(300).nullable(),
});

function expectedTask(titleConcepts, fields) {
  return { titleConcepts, ...fields };
}

export const ukrainianModelEvalCases = [
  {
    name: "today tomorrow and completed",
    input:
      "Молоко купити сьогодні, пошту глянути завтра, а рахунок я вже оплатив",
    today: "2026-07-19",
    expected: {
      tasks: [
        expectedTask([["куп"], ["молок"]], {
          scheduledDate: "2026-07-19",
          scheduledTime: null,
          status: "active",
          priority: null,
        }),
        expectedTask([["перевір", "глян"], ["пошт"]], {
          scheduledDate: "2026-07-20",
          scheduledTime: null,
          status: "active",
          priority: null,
        }),
        expectedTask([["оплат"], ["рахунок"]], {
          scheduledDate: null,
          scheduledTime: null,
          status: "completed",
          priority: null,
        }),
      ],
      clarification: "none",
    },
  },
  {
    name: "colloquial deadline time",
    input: "Подзвони лікарю сьогодні до п’ятої",
    today: "2026-07-19",
    expected: {
      tasks: [
        expectedTask([["подзвон", "зателефон"], ["лікар"]], {
          scheduledDate: "2026-07-19",
          scheduledTime: "17:00",
          status: "active",
          priority: null,
        }),
      ],
      clarification: "none",
    },
  },
  {
    name: "weekday and explicit time",
    input: "У понеділок о 09:30 перевірити пошту",
    today: "2026-07-19",
    expected: {
      tasks: [
        expectedTask([["перевір"], ["пошт"]], {
          scheduledDate: "2026-07-20",
          scheduledTime: "09:30",
          status: "active",
          priority: null,
        }),
      ],
      clarification: "none",
    },
  },
  {
    name: "undated task",
    input: "Купити лампочку",
    today: "2026-07-19",
    expected: {
      tasks: [
        expectedTask([["куп"], ["лампоч"]], {
          scheduledDate: null,
          scheduledTime: null,
          status: "active",
          priority: null,
        }),
      ],
      clarification: "none",
    },
  },
  {
    name: "explicit high priority",
    input: "Терміново продовжити домен, високий пріоритет",
    today: "2026-07-19",
    expected: {
      tasks: [
        expectedTask([["продовж", "понов"], ["домен"]], {
          scheduledDate: null,
          scheduledTime: null,
          status: "active",
          priority: "high",
        }),
      ],
      clarification: "none",
    },
  },
  {
    name: "ambiguous date clarification",
    input: "Заплануй зустріч якось потім",
    today: "2026-07-19",
    expected: { tasks: [], clarification: "required" },
  },
  {
    name: "inside seven-day window",
    input: "У суботу здати звіт",
    today: "2026-07-19",
    expected: {
      tasks: [
        expectedTask([["зда"], ["звіт"]], {
          scheduledDate: "2026-07-25",
          scheduledTime: null,
          status: "active",
          priority: null,
        }),
      ],
      clarification: "none",
    },
  },
  {
    name: "outside seven-day window",
    input: "Через вісім днів поновити страховку",
    today: "2026-07-19",
    expected: {
      tasks: [
        expectedTask([["понов"], ["страхов"]], {
          scheduledDate: "2026-07-27",
          scheduledTime: null,
          status: "active",
          priority: null,
        }),
      ],
      clarification: "none",
    },
  },
  {
    name: "completed without date",
    input: "Я вже забрав посилку",
    today: "2026-07-19",
    expected: {
      tasks: [
        expectedTask([["забр", "отрим"], ["посилк"]], {
          scheduledDate: null,
          scheduledTime: null,
          status: "completed",
          priority: null,
        }),
      ],
      clarification: "none",
    },
  },
  {
    name: "colloquial half-hour time",
    input: "Наступної середи о пів на десяту зателефонувати Олені",
    today: "2026-07-19",
    expected: {
      tasks: [
        expectedTask([["зателефон", "подзвон"], ["олен"]], {
          scheduledDate: "2026-07-22",
          scheduledTime: "09:30",
          status: "active",
          priority: null,
        }),
      ],
      clarification: "none",
    },
  },
  {
    name: "atomic prioritized template titles",
    input:
      "Схема: зробити три шаблони (перший — пріоритетний, другий — середній, третій — низька пріоритетність)",
    today: "2026-07-20",
    expected: {
      tasks: [
        expectedTask([["зроб"], ["перш"], ["шаблон"]], {
          scheduledDate: null,
          scheduledTime: null,
          status: "active",
          priority: "high",
          forbiddenTitleTerms: ["схема", "три шаблони", "пріоритет"],
        }),
        expectedTask([["зроб"], ["друг"], ["шаблон"]], {
          scheduledDate: null,
          scheduledTime: null,
          status: "active",
          priority: "medium",
          forbiddenTitleTerms: ["схема", "три шаблони", "пріоритет"],
        }),
        expectedTask([["зроб"], ["трет"], ["шаблон"]], {
          scheduledDate: null,
          scheduledTime: null,
          status: "active",
          priority: "low",
          forbiddenTitleTerms: ["схема", "три шаблони", "пріоритет"],
        }),
      ],
      clarification: "none",
    },
  },
];

function normalizeTitle(value) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("uk-UA")
    .replace(/[’'`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function printable(value) {
  return value === null ? "null" : String(value);
}

export function evaluateUkrainianModelCase(definition, actual) {
  const issues = [];
  const expected = definition.expected;

  if (!actual || !Array.isArray(actual.tasks)) {
    return ["model returned no parsed task result"];
  }

  if (actual.tasks.length !== expected.tasks.length) {
    issues.push(
      `task count: expected ${expected.tasks.length}, received ${actual.tasks.length}`,
    );
  }

  expected.tasks.forEach((expectedTaskDefinition, index) => {
    const actualTask = actual.tasks[index];
    if (!actualTask) return;
    const taskNumber = index + 1;
    const normalizedTitle = normalizeTitle(actualTask.title ?? "");

    expectedTaskDefinition.titleConcepts.forEach((alternatives) => {
      if (!alternatives.some((term) => normalizedTitle.includes(term))) {
        issues.push(
          `task ${taskNumber} title: expected one of [${alternatives.join(", ")}]`,
        );
      }
    });

    for (const forbiddenTerm of expectedTaskDefinition.forbiddenTitleTerms ?? []) {
      if (normalizedTitle.includes(forbiddenTerm)) {
        issues.push(`task ${taskNumber} title: contains repeated shared context`);
        break;
      }
    }

    for (const field of [
      "scheduledDate",
      "scheduledTime",
      "status",
      "priority",
    ]) {
      if (actualTask[field] !== expectedTaskDefinition[field]) {
        issues.push(
          `task ${taskNumber} ${field}: expected ${printable(expectedTaskDefinition[field])}, received ${printable(actualTask[field])}`,
        );
      }
    }
  });

  const clarification =
    typeof actual.clarification === "string" ? actual.clarification.trim() : "";
  if (expected.clarification === "none" && actual.clarification !== null) {
    issues.push("clarification: expected null");
  }
  if (
    expected.clarification === "required" &&
    (clarification.length < 5 || clarification.length > 300)
  ) {
    issues.push("clarification: expected a non-empty 5-300 character question");
  }

  return issues;
}

export async function runUkrainianModelEval({ client, model }) {
  const results = [];

  for (const definition of ukrainianModelEvalCases) {
    try {
      const response = await client.responses.parse(
        {
          model,
          input: [
            { role: "system", content: taskSystemPrompt },
            {
              role: "user",
              content: `Локальна дата: ${definition.today}\nЧасовий пояс: Europe/Warsaw\nНотатка: ${definition.input}`,
            },
          ],
          text: {
            format: zodTextFormat(wireResultSchema, "noteai_task_result"),
          },
        },
        { timeout: 15_000, maxRetries: 1 },
      );

      results.push({
        name: definition.name,
        issues: evaluateUkrainianModelCase(definition, response.output_parsed),
      });
    } catch (error) {
      results.push({
        name: definition.name,
        issues: [
          `request failed: ${error instanceof Error ? error.message : "unknown error"}`,
        ],
      });
    }
  }

  return results;
}

export function resolveUkrainianModel(env) {
  return env.OPENAI_MODEL || "gpt-5-nano";
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is required for the paid Ukrainian model evaluation.");
    process.exitCode = 2;
    return;
  }

  const model = resolveUkrainianModel(process.env);
  const results = await runUkrainianModelEval({
    client: new OpenAI({ apiKey }),
    model,
  });
  let failed = 0;

  for (const result of results) {
    if (result.issues.length === 0) {
      console.log(`PASS ${result.name}`);
    } else {
      failed += 1;
      console.error(`FAIL ${result.name}`);
      result.issues.forEach((issue) => console.error(`  ${issue}`));
    }
  }

  console.log(`${results.length - failed}/${results.length} Ukrainian model cases passed.`);
  if (failed > 0) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
