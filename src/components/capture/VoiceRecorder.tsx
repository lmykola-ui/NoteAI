"use client";

import { useEffect, useRef, useState } from "react";
import { requestTranscription } from "@/features/capture/application/transcribeClient";

type RecorderState =
  | "idle"
  | "requesting"
  | "recording"
  | "transcribing"
  | "denied"
  | "error";

type VoiceRecorderProps = {
  onTranscript: (text: string) => void | Promise<void>;
};

const MAX_RECORDING_MS = 60_000;

type RecordingSession = {
  generation: number;
  recorder: MediaRecorder | null;
  stream: MediaStream | null;
  chunks: Blob[];
  stopTimer: ReturnType<typeof setTimeout> | null;
  discard: boolean;
  finished: boolean;
};

function isPermissionDenied(error: unknown) {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? error.name
      : null;
  return (
    name === "NotAllowedError" || name === "SecurityError"
  );
}

export function VoiceRecorder({ onTranscript }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const activeSessionRef = useRef<RecordingSession | null>(null);

  function clearStopTimer(session: RecordingSession) {
    if (session.stopTimer !== null) {
      clearTimeout(session.stopTimer);
      session.stopTimer = null;
    }
  }

  function stopTracks(session: RecordingSession) {
    const stream = session.stream;
    session.stream = null;
    stream?.getTracks().forEach((track) => track.stop());
  }

  async function finishRecording(session: RecordingSession) {
    if (session.finished) return;
    session.finished = true;
    clearStopTimer(session);
    stopTracks(session);
    if (activeSessionRef.current === session) activeSessionRef.current = null;

    const chunks = session.chunks;
    session.chunks = [];
    if (session.discard) return;

    let blob: Blob | null = new Blob(chunks, {
      type: session.recorder?.mimeType || chunks[0]?.type || "audio/webm",
    });
    session.recorder = null;
    const isCurrent = () =>
      mountedRef.current && generationRef.current === session.generation;
    if (isCurrent()) setState("transcribing");

    try {
      const text = await requestTranscription(blob);
      blob = null;
      if (!isCurrent()) return;
      await onTranscript(text);
      if (isCurrent()) setState("idle");
    } catch {
      if (isCurrent()) setState("error");
    } finally {
      blob = null;
    }
  }

  async function startRecording() {
    setState("requesting");
    const session: RecordingSession = {
      generation: generationRef.current + 1,
      recorder: null,
      stream: null,
      chunks: [],
      stopTimer: null,
      discard: false,
      finished: false,
    };
    generationRef.current = session.generation;
    activeSessionRef.current = session;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("RECORDING_UNAVAILABLE");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current || activeSessionRef.current !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      session.stream = stream;
      if (!globalThis.MediaRecorder) {
        throw new Error("RECORDING_UNAVAILABLE");
      }
      const recorder = new MediaRecorder(stream);
      session.recorder = recorder;

      recorder.ondataavailable = (event) => {
        if (!session.discard && !session.finished && event.data.size > 0) {
          session.chunks.push(event.data);
        }
      };
      recorder.onstop = () => {
        void finishRecording(session);
      };
      recorder.onerror = () => {
        session.discard = true;
        clearStopTimer(session);
        stopTracks(session);
        session.chunks = [];
        if (mountedRef.current && activeSessionRef.current === session) {
          setState("error");
        }
        if (recorder.state !== "inactive") recorder.stop();
      };

      recorder.start();
      if (
        !mountedRef.current ||
        activeSessionRef.current !== session ||
        session.discard
      ) {
        return;
      }
      setState("recording");
      session.stopTimer = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, MAX_RECORDING_MS);
    } catch (error) {
      session.discard = true;
      clearStopTimer(session);
      stopTracks(session);
      session.chunks = [];
      session.recorder = null;
      if (activeSessionRef.current === session) {
        activeSessionRef.current = null;
      }
      if (mountedRef.current && generationRef.current === session.generation) {
        setState(isPermissionDenied(error) ? "denied" : "error");
      }
    }
  }

  function stopRecording() {
    const recorder = activeSessionRef.current?.recorder;
    if (recorder?.state === "recording") recorder.stop();
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const session = activeSessionRef.current;
      activeSessionRef.current = null;
      if (!session) return;
      session.discard = true;
      clearStopTimer(session);
      const recorder = session.recorder;
      session.recorder = null;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onerror = null;
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      stopTracks(session);
      session.chunks = [];
    };
  }, []);

  if (state === "recording") {
    return (
      <button type="button" className="secondary-button" onClick={stopRecording}>
        Зупинити запис
      </button>
    );
  }

  if (state === "requesting" || state === "transcribing") {
    return (
      <button type="button" className="secondary-button" disabled>
        {state === "requesting" ? "Запитуємо доступ…" : "Розпізнаємо…"}
      </button>
    );
  }

  if (state === "denied" || state === "error") {
    return (
      <div className="voice-recorder">
        <p role="alert" className="capture-error">
          {state === "denied"
            ? "Немає доступу до мікрофона"
            : "Не вдалося розпізнати нотатку"}
        </p>
        <button
          type="button"
          className="secondary-button"
          onClick={startRecording}
        >
          Спробувати ще раз
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="secondary-button"
      onClick={startRecording}
    >
      Почати запис
    </button>
  );
}
