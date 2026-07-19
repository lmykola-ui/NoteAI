import type { InputMethod, ParseResult } from "@/features/tasks/domain/task";

export async function parseText(input: {
  text: string;
  today: string;
  timeZone: string;
  inputMethod: InputMethod;
}): Promise<ParseResult> {
  const response = await fetch("/api/parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) throw new Error("AI_UNAVAILABLE");

  return response.json() as Promise<ParseResult>;
}
