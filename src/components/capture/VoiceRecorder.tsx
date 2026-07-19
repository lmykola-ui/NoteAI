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
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discardRecordingRef = useRef(false);

  function clearStopTimer() {
    if (stopTimerRef.current !== null) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }

  function stopTracks() {
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
  }

  async function finishRecording(recorder: MediaRecorder) {
    clearStopTimer();
    stopTracks();
    if (recorderRef.current === recorder) recorderRef.current = null;

    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (discardRecordingRef.current) {
      discardRecordingRef.current = false;
      return;
    }

    let blob: Blob | null = new Blob(chunks, {
      type: recorder.mimeType || chunks[0]?.type || "audio/webm",
    });
    if (mountedRef.current) setState("transcribing");

    try {
      const text = await requestTranscription(blob);
      blob = null;
      if (!mountedRef.current) return;
      await onTranscript(text);
      if (mountedRef.current) setState("idle");
    } catch {
      if (mountedRef.current) setState("error");
    } finally {
      blob = null;
    }
  }

  async function startRecording() {
    setState("requesting");
    discardRecordingRef.current = false;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("RECORDING_UNAVAILABLE");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (!globalThis.MediaRecorder) {
        throw new Error("RECORDING_UNAVAILABLE");
      }
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        void finishRecording(recorder);
      };
      recorder.onerror = () => {
        discardRecordingRef.current = true;
        clearStopTimer();
        stopTracks();
        chunksRef.current = [];
        if (mountedRef.current) setState("error");
        if (recorder.state !== "inactive") recorder.stop();
      };

      recorder.start();
      setState("recording");
      stopTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, MAX_RECORDING_MS);
    } catch (error) {
      clearStopTimer();
      stopTracks();
      chunksRef.current = [];
      recorderRef.current = null;
      if (mountedRef.current) {
        setState(isPermissionDenied(error) ? "denied" : "error");
      }
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      discardRecordingRef.current = true;
      clearStopTimer();
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onerror = null;
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      stopTracks();
      chunksRef.current = [];
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
