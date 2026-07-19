import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type {
  InputMethod,
  ParseResult,
} from "@/features/tasks/domain/task";
import { openai, taskModel } from "./client";

export const parseTaskRequestSchema = z.object({
  text: z.string().trim().min(1).max(10_000),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeZone: z.string().min(1).max(100),
  inputMethod: z.enum(["text", "voice"]),
});

const aiResultSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(300),
        scheduledDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable(),
        scheduledTime: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .nullable(),
        status: z.enum(["active", "completed"]),
        priority: z.enum(["low", "medium", "high"]).nullable(),
      }),
    )
    .max(50),
  clarification: z.string().max(300).nullable(),
});

type ParseRequest = z.infer<typeof parseTaskRequestSchema>;
type ParserClient = Pick<typeof openai, "responses">;

const systemPrompt = `Ти аналізуєш українські нотатки та повертаєш лише структуровані задачі.
Використовуй передану локальну дату як основу для “сьогодні” і “завтра”.
Не вигадуй дату, час, статус або пріоритет. Якщо дія справді неоднозначна, поверни одне коротке уточнення.
Розділяй кілька справ на окремі задачі. Фраза про вже зроблену справу має status=completed.`;

export async function parseTasksWithClient(
  client: ParserClient,
  request: ParseRequest,
): Promise<ParseResult> {
  const response = await client.responses.parse(
    {
      model: taskModel,
      input: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Локальна дата: ${request.today}\nЧасовий пояс: ${request.timeZone}\nНотатка: ${request.text}`,
        },
      ],
      text: { format: zodTextFormat(aiResultSchema, "noteai_task_result") },
    },
    { timeout: 15_000, maxRetries: 1 },
  );

  if (!response.output_parsed) {
    throw new Error("INVALID_AI_RESPONSE");
  }

  return {
    clarification: response.output_parsed.clarification,
    tasks: response.output_parsed.tasks.map((task) => ({
      ...task,
      inputMethod: request.inputMethod as InputMethod,
    })),
  };
}

export async function parseTasksWithOpenAI(
  request: ParseRequest,
): Promise<ParseResult> {
  return parseTasksWithClient(openai, request);
}
