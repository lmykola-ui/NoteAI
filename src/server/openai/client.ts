import "server-only";
import OpenAI from "openai";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export const taskModel = process.env.OPENAI_TASK_MODEL ?? "gpt-5.6-terra";
export const transcribeModel =
  process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe";
