"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { requestTranscription } from "@/features/capture/application/transcribeClient";
import { trackSafeEvent } from "@/lib/analytics";
import {
  isOfflineError,
  isOnlineNow,
  subscribeToOnlineStatus,
} from "@/lib/connectivity";
import { AudioWaveform } from "./AudioWaveform";
import { AppIcon } from "@/components/icons/AppIcon";

type RecorderState =
  | "idle"
  | "requesting"
  | "recording"
  | "transcribing"
  | "denied"
  | "error";

type VoiceRecorderProps = {
  onTranscript: (text: string) => void | Promise<void>;
  disabled?: boolean;
};

const SERVER_AUDIO_DURATION_CAP_MS = 60_000;
const AUTO_STOP_RECORDING_MS = SERVER_AUDIO_DURATION_CAP_MS - 1_000;
const WAVEFORM_BAR_COUNT = 13;
const QUIET_LEVELS = Array.from({ length: WAVEFORM_BAR_COUNT }, () => 0.08);
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
  audioContext: AudioContext | null;
  audioSource: MediaStreamAudioSourceNode | null;
  analyser: AnalyserNode | null;
  animationFrame: number | null;
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

function stopAudioAnalysis(session: RecordingSession) {
  if (session.animationFrame !== null) {
    cancelAnimationFrame(session.animationFrame);
    session.animationFrame = null;
  }
  session.audioSource?.disconnect();
  session.analyser?.disconnect();
  session.audioSource = null;
  session.analyser = null;
  const audioContext = session.audioContext;
  session.audioContext = null;
  if (audioContext && audioContext.state !== "closed") {
    void audioContext.close().catch(() => undefined);
  }
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
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [levels, setLevels] = useState(QUIET_LEVELS);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const activeSessionRef = useRef<RecordingSession | null>(null);
  const disabledRef = useRef(disabled);

  const discardSession = useCallback((session: RecordingSession) => {
    session.discard = true;
    clearStopTimer(session);
    session.chunks = [];
    stopAudioAnalysis(session);
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

  async function finishRecording(session: RecordingSession) {
    if (session.finished) return;
    session.finished = true;
    clearStopTimer(session);
    stopAudioAnalysis(session);
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
  }

  function startAudioAnalysis(
    session: RecordingSession,
    stream: MediaStream,
    recorder: MediaRecorder,
  ) {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) {
      setLevels(QUIET_LEVELS);
      return;
    }

    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.72;
    source.connect(analyser);
    session.audioContext = audioContext;
    session.audioSource = source;
    session.analyser = analyser;

    const samples = new Uint8Array(analyser.fftSize);
    const sampleLevels = () => {
      if (
        !mountedRef.current ||
        activeSessionRef.current !== session ||
        session.discard ||
        recorder.state !== "recording"
      ) {
        return;
      }

      analyser.getByteTimeDomainData(samples);
      const sum = samples.reduce((total, sample) => {
        const centered = (sample - 128) / 128;
        return total + centered * centered;
      }, 0);
      const amplitude = Math.min(1, Math.sqrt(sum / samples.length) * 4.5);
      setLevels((current) =>
        current.map((previous, index) => {
          const centerWeight = 1 - Math.abs(index - 6) / 9;
          const target = Math.max(0.06, amplitude * centerWeight);
          return previous * 0.68 + target * 0.32;
        }),
      );
      session.animationFrame = requestAnimationFrame(sampleLevels);
    };
    session.animationFrame = requestAnimationFrame(sampleLevels);
  }

  async function startRecording() {
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
      audioContext: null,
      audioSource: null,
      analyser: null,
      animationFrame: null,
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
      startAudioAnalysis(session, stream, recorder);

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
        stopAudioAnalysis(session);
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
      stopAudioAnalysis(session);
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

  useLayoutEffect(() => {
    return subscribeToOnlineStatus(() => {
      if (isOnlineNow()) return;
      const session = activeSessionRef.current;
      if (!session) return;
      discardSession(session);
    });
  }, [discardSession]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const session = activeSessionRef.current;
      activeSessionRef.current = null;
      if (!session) return;
      session.discard = true;
      clearStopTimer(session);
      stopAudioAnalysis(session);
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
      <div className="recording-card capture-state-enter" role="status">
        <div className="recording-heading">
          <span>
            <i aria-hidden="true" />
            Запис
          </span>
        </div>
        <AudioWaveform levels={levels} />
        <button
          type="button"
          className="record-stop-button"
          aria-label="Зупинити запис"
          onClick={stopRecording}
        >
          Зупинити
        </button>
      </div>
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
    <div className="voice-start capture-state-enter">
      <button
        type="button"
        className="mic-button"
        aria-label="Почати запис"
        onClick={startRecording}
        disabled={disabled}
      >
        <AppIcon name="mic" size={36} decorative />
      </button>
      <span>Натисніть, щоб почати запис</span>
    </div>
  );
}
