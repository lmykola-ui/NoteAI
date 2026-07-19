import { transcribeAudio } from "@/server/openai/transcribeAudio";

const MAX_AUDIO_BYTES = 10_000_000;
const allowedTypes = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-m4a",
]);

function normalizedAudioType(file: File) {
  return file.type.split(";", 1)[0].trim().toLowerCase();
}

function isAudioFile(
  value: FormDataEntryValue | null | undefined,
): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.name === "string" &&
    typeof value.type === "string" &&
    typeof value.size === "number"
  );
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");

  if (
    !isAudioFile(audio) ||
    audio.size === 0 ||
    !allowedTypes.has(normalizedAudioType(audio))
  ) {
    return Response.json({ code: "INVALID_AUDIO" }, { status: 400 });
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ code: "AUDIO_TOO_LARGE" }, { status: 413 });
  }

  try {
    return Response.json({ text: await transcribeAudio(audio) });
  } catch {
    return Response.json(
      { code: "TRANSCRIPTION_UNAVAILABLE" },
      { status: 502 },
    );
  }
}
