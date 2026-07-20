import "server-only";
import { createOpenAIClient, transcribeModel } from "./client";

const ukrainianTranscriptionPrompt =
  "Українська особиста нотатка про справи, дати й час. " +
  "Можлива технічна лексика: вайбкодити, завайбкодити, вайбкодинг, " +
  "застосунок, вебзастосунок, OpenAI, ChatGPT, Codex, Claude, Figma, " +
  "Vercel, GitHub, API, UI, UX.";

export async function transcribeAudio(file: File): Promise<string> {
  const result = await createOpenAIClient().audio.transcriptions.create(
    {
      file,
      model: transcribeModel,
      response_format: "text",
      language: "uk",
      prompt: ukrainianTranscriptionPrompt,
    },
    { timeout: 30_000, maxRetries: 1 },
  );

  return typeof result === "string"
    ? result
    : (result as { text: string }).text;
}
