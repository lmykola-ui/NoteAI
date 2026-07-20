import "server-only";
import { createOpenAIClient, transcribeModel } from "./client";
import {
  emitOpenAIUsage,
  toOpenAIUsageDiagnostic,
} from "./usageDiagnostics";

const ukrainianTranscriptionPrompt =
  "Українська особиста нотатка про справи, дати й час. " +
  "Можлива технічна лексика: вайбкодити, завайбкодити, вайбкодинг, " +
  "застосунок, вебзастосунок, OpenAI, ChatGPT, Codex, Claude, Figma, " +
  "Vercel, GitHub, API, UI, UX.";

export async function transcribeAudio(
  file: File,
  audioDurationSeconds: number,
): Promise<string> {
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
  const normalizedResult = result as
    | string
    | { text: string; usage?: unknown; _request_id?: unknown };

  emitOpenAIUsage(
    toOpenAIUsageDiagnostic({
      operation: "transcribe",
      model: transcribeModel,
      requestId:
        typeof normalizedResult === "string"
          ? undefined
          : normalizedResult._request_id,
      usage:
        typeof normalizedResult === "string"
          ? undefined
          : normalizedResult.usage,
      audioDurationSeconds,
    }),
  );

  return typeof normalizedResult === "string"
    ? normalizedResult
    : normalizedResult.text;
}
