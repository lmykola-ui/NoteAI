"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Pause, Play } from "lucide-react";
import { requestTranscription } from "@/features/capture/application/transcribeClient";
import { trackSafeEvent } from "@/lib/analytics";
import {
  isOfflineError,
  isOnlineNow,
  subscribeToOnlineStatus,
} from "@/lib/connectivity";

type RecorderState =
  | "idle"
  | "requesting"
  | "recording"
  | "paused"
  | "transcribing"
  | "denied"
  | "error";

type VoiceRecorderProps = {
  onTranscript: (text: string) => void | Promise<void>;
  disabled?: boolean;
  autoStart?: boolean;
};

const SERVER_AUDIO_DURATION_CAP_MS = 60_000;
const AUTO_STOP_RECORDING_MS = SERVER_AUDIO_DURATION_CAP_MS - 1_000;
const VOICE_LEVELS = [28, 40, 52, 68, 82, 100, 82, 68, 52, 40, 28];
// Keep one second of headroom because browser timers can run late while the
// server verifies the recorded duration against its strict 60-second cap.

type RecordingSession = {
  generation: number;
  recorder: MediaRecorder | null;
  stream: MediaStream | null;
  chunks: Blob[];
  stopTimer: ReturnType<typeof setTimeout> | null;
  discard: boolean;
  finished: boolean;
  failed: boolean;
};

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

function isPermissionDenied(error: unknown) {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? error.name
      : null;
  return (
    name === "NotAllowedError" || name === "SecurityError"
  );
}

export function VoiceRecorder({
  onTranscript,
  disabled = false,
  autoStart = false,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const activeSessionRef = useRef<RecordingSession | null>(null);
  const disabledRef = useRef(disabled);
  const autoStartAttemptedRef = useRef(false);
  const startRecordingRef = useRef<() => Promise<void>>(async () => undefined);

  const discardSession = useCallback((session: RecordingSession) => {
    session.discard = true;
    clearStopTimer(session);
    session.chunks = [];
    stopTracks(session);
    if (activeSessionRef.current === session) activeSessionRef.current = null;
    const recorder = session.recorder;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    if (mountedRef.current && generationRef.current === session.generation) {
      setState("idle");
    }
  }, []);

  useLayoutEffect(() => {
    disabledRef.current = disabled;
    if (!disabled) return;

    const session = activeSessionRef.current;
    if (!session) return;
    discardSession(session);
  }, [disabled, discardSession]);

  const finishRecording = useCallback(async (session: RecordingSession) => {
    if (session.finished) return;
    session.finished = true;
    clearStopTimer(session);
    stopTracks(session);
    if (activeSessionRef.current === session) activeSessionRef.current = null;

    const chunks = session.chunks;
    session.chunks = [];
    if (session.discard || disabledRef.current || !isOnlineNow()) {
      if (
        !session.failed &&
        mountedRef.current &&
        generationRef.current === session.generation
      ) {
        setState("idle");
      }
      return;
    }

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
      if (disabledRef.current || !isOnlineNow()) {
        setState("idle");
        return;
      }
      await onTranscript(text);
      if (!isCurrent()) return;
      if (disabledRef.current || !isOnlineNow()) {
        setState("idle");
        return;
      }
      setState("idle");
    } catch (error) {
      if (isOfflineError(error) || !isOnlineNow()) {
        if (isCurrent()) setState("idle");
        return;
      }
      trackSafeEvent("transcription_failed");
      if (isCurrent()) setState("error");
    } finally {
      blob = null;
    }
  }, [onTranscript]);

  const startRecording = useCallback(async () => {
    if (disabled || !isOnlineNow()) return;
    setState("requesting");
    const session: RecordingSession = {
      generation: generationRef.current + 1,
      recorder: null,
      stream: null,
      chunks: [],
      stopTimer: null,
      discard: false,
      finished: false,
      failed: false,
    };
    generationRef.current = session.generation;
    activeSessionRef.current = session;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("RECORDING_UNAVAILABLE");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (
        !mountedRef.current ||
        activeSessionRef.current !== session ||
        session.discard ||
        disabledRef.current ||
        !isOnlineNow()
      ) {
        stream.getTracks().forEach((track) => track.stop());
        session.discard = true;
        if (activeSessionRef.current === session) {
          activeSessionRef.current = null;
        }
        if (
          mountedRef.current &&
          generationRef.current === session.generation
        ) {
          setState("idle");
        }
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
        session.failed = true;
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
      }, AUTO_STOP_RECORDING_MS);
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
  }, [disabled, finishRecording]);

  function stopRecording() {
    const recorder = activeSessionRef.current?.recorder;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  function togglePause() {
    const recorder = activeSessionRef.current?.recorder;
    if (!recorder) return;
    if (state === "recording" && recorder.state === "recording") {
      recorder.pause();
      setState("paused");
      return;
    }
    if (state === "paused" && recorder.state === "paused") {
      recorder.resume();
      setState("recording");
    }
  }

  useLayoutEffect(() => {
    return subscribeToOnlineStatus(() => {
      if (isOnlineNow()) return;
      const session = activeSessionRef.current;
      if (!session) return;
      discardSession(session);
    });
  }, [discardSession]);

  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  useEffect(() => {
    if (
      !autoStart ||
      disabled ||
      state !== "idle" ||
      autoStartAttemptedRef.current
    ) {
      return;
    }

    autoStartAttemptedRef.current = true;
    void startRecordingRef.current();
  }, [autoStart, disabled, state]);

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

  if (state === "recording" || state === "paused") {
    return (
      <section className="voice-listening" aria-label={state === "recording" ? "Триває запис" : "Запис на паузі"}>
        <div className="voice-listening-status">
          <span className="voice-wave" role="img" aria-label="Рівень звуку">
            {VOICE_LEVELS.map((height, index) => (
              <span
                key={index}
                className="voice-level-bar"
                data-testid="voice-level-bar"
                style={{ "--voice-level-height": `${height}%`, "--voice-level-delay": `${index * 70}ms` } as React.CSSProperties}
              />
            ))}
          </span>
          <p className="voice-listening-title">{state === "recording" ? "Слухаю…" : "На паузі"}</p>
        </div>
        <p className="voice-listening-hint">{state === "recording" ? "Скажіть усе, що потрібно зробити" : "Продовжте, коли будете готові"}</p>
        <div className="voice-listening-controls">
          <button type="button" className="voice-pause-button" aria-label={state === "recording" ? "Пауза запису" : "Продовжити запис"} onClick={togglePause}>{state === "recording" ? <Pause size={21} fill="currentColor" aria-hidden="true" /> : <Play size={21} fill="currentColor" aria-hidden="true" />}</button>
          <button type="button" className="voice-stop-button" aria-label="Зупинити запис" onClick={stopRecording}><Check size={24} strokeWidth={2.8} aria-hidden="true" /></button>
        </div>
      </section>
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
            ? "Немає доступу до мікрофона. Увімкніть доступ у налаштуваннях браузера"
            : "Не вдалося розпізнати нотатку"}
        </p>
        <button
          type="button"
          className="secondary-button"
          onClick={startRecording}
          disabled={disabled}
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
      disabled={disabled}
    >
      Почати запис
    </button>
  );
}
