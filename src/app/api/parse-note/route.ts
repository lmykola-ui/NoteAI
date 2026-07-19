import {
  parseTaskRequestSchema,
  parseTasksWithOpenAI,
} from "@/server/openai/parseTasks";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseTaskRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
  }

  try {
    return Response.json(await parseTasksWithOpenAI(parsed.data));
  } catch {
    return Response.json({ code: "AI_UNAVAILABLE" }, { status: 502 });
  }
}
