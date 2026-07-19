import type { ParseResult, TaskDraft } from "@/features/tasks/domain/task";

type ModelTask = Omit<TaskDraft, "inputMethod">;

export type UkrainianAcceptanceCase = {
  name: string;
  input: string;
  today: string;
  modelOutput: {
    tasks: ModelTask[];
    clarification: string | null;
  };
  expected: ParseResult;
};

function acceptanceCase(
  definition: Omit<UkrainianAcceptanceCase, "expected">,
): UkrainianAcceptanceCase {
  return {
    ...definition,
    expected: {
      clarification: definition.modelOutput.clarification,
      tasks: definition.modelOutput.tasks.map((task) => ({
        ...task,
        inputMethod: "text",
      })),
    },
  };
}

export const ukrainianAcceptanceCases = [
  acceptanceCase({
    name: "splits today, tomorrow, and completed language",
    input:
      "Молоко купити сьогодні, пошту глянути завтра, а рахунок я вже оплатив",
    today: "2026-07-19",
    modelOutput: {
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
  }),
  acceptanceCase({
    name: "resolves a Ukrainian time phrase without inventing priority",
    input: "Подзвони лікарю сьогодні до п’ятої",
    today: "2026-07-19",
    modelOutput: {
      tasks: [
        {
          title: "Подзвонити лікарю",
          scheduledDate: "2026-07-19",
          scheduledTime: "17:00",
          status: "active",
          priority: null,
        },
      ],
      clarification: null,
    },
  }),
  acceptanceCase({
    name: "resolves an explicit weekday and clock time",
    input: "У понеділок о 09:30 перевірити пошту",
    today: "2026-07-19",
    modelOutput: {
      tasks: [
        {
          title: "Перевірити пошту",
          scheduledDate: "2026-07-20",
          scheduledTime: "09:30",
          status: "active",
          priority: null,
        },
      ],
      clarification: null,
    },
  }),
  acceptanceCase({
    name: "keeps an undated task undated",
    input: "Купити лампочку",
    today: "2026-07-19",
    modelOutput: {
      tasks: [
        {
          title: "Купити лампочку",
          scheduledDate: null,
          scheduledTime: null,
          status: "active",
          priority: null,
        },
      ],
      clarification: null,
    },
  }),
  acceptanceCase({
    name: "preserves an explicit high priority",
    input: "Терміново продовжити домен, високий пріоритет",
    today: "2026-07-19",
    modelOutput: {
      tasks: [
        {
          title: "Продовжити домен",
          scheduledDate: null,
          scheduledTime: null,
          status: "active",
          priority: "high",
        },
      ],
      clarification: null,
    },
  }),
  acceptanceCase({
    name: "asks once instead of inventing an ambiguous date",
    input: "Заплануй зустріч якось потім",
    today: "2026-07-19",
    modelOutput: {
      tasks: [],
      clarification: "Коли саме запланувати зустріч?",
    },
  }),
  acceptanceCase({
    name: "keeps a date inside the seven-day plan window",
    input: "У суботу здати звіт",
    today: "2026-07-19",
    modelOutput: {
      tasks: [
        {
          title: "Здати звіт",
          scheduledDate: "2026-07-25",
          scheduledTime: null,
          status: "active",
          priority: null,
        },
      ],
      clarification: null,
    },
  }),
  acceptanceCase({
    name: "keeps a date outside the seven-day plan window",
    input: "Через вісім днів поновити страховку",
    today: "2026-07-19",
    modelOutput: {
      tasks: [
        {
          title: "Поновити страховку",
          scheduledDate: "2026-07-27",
          scheduledTime: null,
          status: "active",
          priority: null,
        },
      ],
      clarification: null,
    },
  }),
  acceptanceCase({
    name: "recognizes completed language without inventing a date",
    input: "Я вже забрав посилку",
    today: "2026-07-19",
    modelOutput: {
      tasks: [
        {
          title: "Забрати посилку",
          scheduledDate: null,
          scheduledTime: null,
          status: "completed",
          priority: null,
        },
      ],
      clarification: null,
    },
  }),
  acceptanceCase({
    name: "resolves a colloquial half-hour time phrase",
    input: "Наступної середи о пів на десяту зателефонувати Олені",
    today: "2026-07-19",
    modelOutput: {
      tasks: [
        {
          title: "Зателефонувати Олені",
          scheduledDate: "2026-07-22",
          scheduledTime: "09:30",
          status: "active",
          priority: null,
        },
      ],
      clarification: null,
    },
  }),
] satisfies UkrainianAcceptanceCase[];
