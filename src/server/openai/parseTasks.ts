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
        title: z.string(),
        scheduledDate: z.string().nullable(),
        scheduledTime: z.string().nullable(),
        status: z.enum(["active", "completed"]),
        priority: z.enum(["low", "medium", "high"]).nullable(),
      }),
    ),
  clarification: z.string().nullable(),
});

type ParseRequest = z.infer<typeof parseTaskRequestSchema>;
type ParserClient = Pick<OpenAI, "responses">;

class InvalidAIResponseError extends Error {
  constructor(options?: ErrorOptions) {
    super("INVALID_AI_RESPONSE", options);
    this.name = "InvalidAIResponseError";
  }
}

function normalizeAIResult(
  output: z.infer<typeof aiWireResultSchema>,
  inputMethod: InputMethod,
): ParseResult {
  const tasks = output.tasks
    .flatMap((task) => {
      const title = task.title.trim().slice(0, 300);
      if (!title) {
        return [];
      }

      return [
        {
          title,
          scheduledDate:
            task.scheduledDate && isCalendarDate(task.scheduledDate)
              ? task.scheduledDate
              : null,
          scheduledTime:
            task.scheduledTime && isLocalTime(task.scheduledTime)
              ? task.scheduledTime
              : null,
          status: task.status,
          priority: task.priority,
          inputMethod,
        },
      ];
    })
    .slice(0, 50);

  if (tasks.length > 0) {
    return { tasks, clarification: null };
  }

  const clarification = output.clarification?.trim().slice(0, 300) || null;
  if (clarification) {
    return { tasks: [], clarification };
  }

  throw new InvalidAIResponseError();
}

function isRetryableStructuredOutputError(error: unknown) {
  let constructorName: string | null = null;
  if (typeof error === "object" && error !== null) {
    try {
      const constructor = Reflect.get(error, "constructor");
      constructorName =
        typeof constructor === "function" &&
        typeof constructor.name === "string"
          ? constructor.name
          : null;
    } catch {
      constructorName = null;
    }
  }

  return (
    error instanceof InvalidAIResponseError ||
    error instanceof z.ZodError ||
    error instanceof SyntaxError ||
    constructorName === "ZodError" ||
    constructorName === "SyntaxError" ||
    constructorName === "OpenAIError" ||
    constructorName === "LengthFinishReasonError" ||
    constructorName === "ContentFilterFinishReasonError"
  );
}

export async function parseTasksWithClient(
  client: ParserClient,
  request: ParseRequest,
): Promise<ParseResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.responses.parse(
        {
          model: taskModel,
          input: [
            { role: "system", content: taskSystemPrompt },
            {
              role: "user",
              content:
                `Локальна дата: ${request.today}\n` +
                `Часовий пояс: ${request.timeZone}\n` +
                `Нотатка: ${request.text}`,
            },
          ],
          text: {
            format: zodTextFormat(aiWireResultSchema, "noteai_task_result"),
          },
        },
        { timeout: 15_000, maxRetries: 1 },
      );

      if (!response.output_parsed) {
        throw new InvalidAIResponseError();
      }

      return normalizeAIResult(response.output_parsed, request.inputMethod);
    } catch (error) {
      if (!isRetryableStructuredOutputError(error)) {
        throw error;
      }

      if (attempt === 1) {
        throw error instanceof InvalidAIResponseError
          ? error
          : new InvalidAIResponseError({ cause: error });
      }
    }
  }

  throw new InvalidAIResponseError();
}

export async function parseTasksWithOpenAI(
  request: ParseRequest,
): Promise<ParseResult> {
  return parseTasksWithClient(createOpenAIClient(), request);
}
