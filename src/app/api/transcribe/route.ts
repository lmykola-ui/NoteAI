import { parseBuffer } from "music-metadata";
import { transcribeAudio } from "@/server/openai/transcribeAudio";

const MAX_AUDIO_BYTES = 10_000_000;
const MAX_AUDIO_DURATION_SECONDS = 60;
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

  let duration: number | undefined;
  try {
    const bytes = new Uint8Array(await audio.arrayBuffer());
    const metadata = await parseBuffer(
      bytes,
      { mimeType: normalizedAudioType(audio), size: audio.size },
      { duration: true, skipCovers: true },
    );
    duration = metadata.format.duration;
  } catch {
    return Response.json({ code: "INVALID_AUDIO" }, { status: 400 });
  }

  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
    return Response.json({ code: "INVALID_AUDIO" }, { status: 400 });
  }

  if (duration > MAX_AUDIO_DURATION_SECONDS) {
    return Response.json({ code: "AUDIO_TOO_LONG" }, { status: 413 });
  }

  try {
    return Response.json({ text: await transcribeAudio(audio, duration) });
  } catch {
    return Response.json(
      { code: "TRANSCRIPTION_UNAVAILABLE" },
      { status: 502 },
    );
  }
}
