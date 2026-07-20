import {
  assertOnline,
  beginOnlineRequest,
  isOnlineNow,
  OfflineError,
} from "@/lib/connectivity";

function recordingFilename(type: string) {
  switch (type.split(";", 1)[0].trim().toLowerCase()) {
    case "audio/mp4":
      return "note.mp4";
    case "audio/mpeg":
      return "note.mp3";
    case "audio/wav":
      return "note.wav";
    case "audio/x-m4a":
      return "note.m4a";
    default:
      return "note.webm";
  }
}

export async function requestTranscription(blob: Blob): Promise<string> {
  const form = new FormData();
  form.set(
    "audio",
    new File([blob], recordingFilename(blob.type), {
      type: blob.type || "audio/webm",
    }),
  );

  const onlineRequest = beginOnlineRequest();
  try {
    assertOnline();
    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: form,
      signal: onlineRequest.signal,
    });
    assertOnline();

    if (!response.ok) {
      throw new Error("TRANSCRIPTION_UNAVAILABLE");
    }

    const result = (await response.json().catch(() => null)) as {
      text?: unknown;
    } | null;
    assertOnline();
    if (typeof result?.text !== "string" || !result.text.trim()) {
      throw new Error("TRANSCRIPTION_UNAVAILABLE");
    }

    return result.text;
  } catch (error) {
    if (onlineRequest.signal.aborted || !isOnlineNow()) {
      throw new OfflineError();
    }
    throw error;
  } finally {
    onlineRequest.finish();
  }
}
