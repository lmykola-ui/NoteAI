import "server-only";
import OpenAI from "openai";

export function createOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export const taskModel = process.env.OPENAI_MODEL || "gpt-5-nano";
export const transcribeModel =
  process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe";
