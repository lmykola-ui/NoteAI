import "server-only";
import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type {
  InputMethod,
  ParseResult,
} from "@/features/tasks/domain/task";
import { createOpenAIClient, taskModel } from "./client";
import { taskSystemPrompt } from "./taskPrompt.mjs";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const localTimePattern = /^\d{2}:\d{2}$/;
const ianaTimeZonePattern = /^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9._+-]+)+)$/;

function isCalendarDate(value: string) {
  if (!isoDatePattern.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isLocalTime(value: string) {
  if (!localTimePattern.test(value)) {
    return false;
  }

  const [hours, minutes] = value.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function isIanaTimeZone(value: string) {
  if (!ianaTimeZonePattern.test(value)) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const calendarDateSchema = z.string().refine(isCalendarDate);
const localTimeSchema = z.string().refine(isLocalTime);

export const parseTaskRequestSchema = z.object({
  text: z.string().trim().min(1).max(10_000),
  today: calendarDateSchema,
  timeZone: z.string().trim().min(1).max(100).refine(isIanaTimeZone),
  inputMethod: z.enum(["text", "voice"]),
});

const aiWireResultSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(300),
        scheduledDate: z.string().regex(isoDatePattern).nullable(),
        scheduledTime: z.string().regex(localTimePattern).nullable(),
        status: z.enum(["active", "completed"]),
        priority: z.enum(["low", "medium", "high"]).nullable(),
      }),
    )
    .max(50),
  clarification: z.string().max(300).nullable(),
});

const aiResultSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(300),
        scheduledDate: calendarDateSchema.nullable(),
        scheduledTime: localTimeSchema.nullable(),
        status: z.enum(["active", "completed"]),
        priority: z.enum(["low", "medium", "high"]).nullable(),
      }),
    )
    .max(50),
  clarification: z.string().max(300).nullable(),
});

type ParseRequest = z.infer<typeof parseTaskRequestSchema>;
type ParserClient = Pick<OpenAI, "responses">;

export async function parseTasksWithClient(
  client: ParserClient,
  request: ParseRequest,
): Promise<ParseResult> {
  const response = await client.responses.parse(
    {
      model: taskModel,
      input: [
        { role: "system", content: taskSystemPrompt },
        {
          role: "user",
          content: `Локальна дата: ${request.today}\nЧасовий пояс: ${request.timeZone}\nНотатка: ${request.text}`,
        },
      ],
      text: { format: zodTextFormat(aiWireResultSchema, "noteai_task_result") },
    },
    { timeout: 15_000, maxRetries: 1 },
  );

  if (!response.output_parsed) {
    throw new Error("INVALID_AI_RESPONSE");
  }

  const parsed = aiResultSchema.safeParse(response.output_parsed);
  if (!parsed.success) {
    throw new Error("INVALID_AI_RESPONSE");
  }

  return {
    clarification: parsed.data.clarification,
    tasks: parsed.data.tasks.map((task) => ({
      ...task,
      inputMethod: request.inputMethod as InputMethod,
    })),
  };
}

export async function parseTasksWithOpenAI(
  request: ParseRequest,
): Promise<ParseResult> {
  return parseTasksWithClient(createOpenAIClient(), request);
}
