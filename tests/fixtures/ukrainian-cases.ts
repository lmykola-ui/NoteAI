import type { ParseResult, TaskDraft } from "@/features/tasks/domain/task";

type ModelTask = Omit<TaskDraft, "inputMethod">;

export type UkrainianParserContractCase = {
  name: string;
  input: string;
  today: string;
  modelOutput: {
    tasks: ModelTask[];
    clarification: string | null;
  };
  expected: ParseResult;
};

function parserContractCase(
  definition: Omit<UkrainianParserContractCase, "expected">,
): UkrainianParserContractCase {
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

export const ukrainianParserContractCases = [
  parserContractCase({
    name: "keeps grouped shopping details in one task description",
    input: "Треба сходити в магазин і купити каву, молоко та хліб",
    today: "2026-07-22",
    modelOutput: {
      tasks: [
        {
          title: "Сходити в магазин",
          description: "• Кава\n• Молоко\n• Хліб",
          scheduledDate: null,
          scheduledTime: null,
          status: "active",
          priority: null,
        },
      ],
      clarification: null,
    },
  }),
  parserContractCase({
    name: "keeps grouped self-care steps in one task description",
    input: "Зробити догляд за обличчям: вмитися, нанести сироватку і крем",
    today: "2026-07-22",
    modelOutput: {
      tasks: [
        {
          title: "Зробити догляд за обличчям",
          description: "• Вмитися\n• Нанести сироватку\n• Нанести крем",
          scheduledDate: null,
          scheduledTime: null,
          status: "active",
          priority: null,
        },
      ],
      clarification: null,
    },
  }),
  parserContractCase({
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
  parserContractCase({
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
  parserContractCase({
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
  parserContractCase({
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
  parserContractCase({
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
  parserContractCase({
    name: "asks once instead of inventing an ambiguous date",
    input: "Заплануй зустріч якось потім",
    today: "2026-07-19",
    modelOutput: {
      tasks: [],
      clarification: "Коли саме запланувати зустріч?",
    },
  }),
  parserContractCase({
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
  parserContractCase({
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
  parserContractCase({
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
  parserContractCase({
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
  parserContractCase({
    name: "splits a shared template action into atomic prioritized titles",
    input:
      "Схема: зробити три шаблони (перший — пріоритетний, другий — середній, третій — низька пріоритетність)",
    today: "2026-07-20",
    modelOutput: {
      tasks: [
        {
          title: "Зробити перший шаблон",
          scheduledDate: null,
          scheduledTime: null,
          status: "active",
          priority: "high",
        },
        {
          title: "Зробити другий шаблон",
          scheduledDate: null,
          scheduledTime: null,
          status: "active",
          priority: "medium",
        },
        {
          title: "Зробити третій шаблон",
          scheduledDate: null,
          scheduledTime: null,
          status: "active",
          priority: "low",
        },
      ],
      clarification: null,
    },
  }),
] satisfies UkrainianParserContractCase[];
