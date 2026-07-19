"use client";

import { useEffect, useRef, useState } from "react";
import { QuickPreview } from "@/components/preview/QuickPreview";
import { VoiceRecorder } from "@/components/capture/VoiceRecorder";
import { parseText } from "@/features/capture/application/parseClient";
import { trackSafeEvent } from "@/lib/analytics";
import {
  assertOnline,
  isOfflineError,
  isOnlineNow,
} from "@/lib/connectivity";
import {
  clearCaptureDraft,
  loadCaptureDraft,
  saveCaptureDraft,
} from "@/features/capture/infrastructure/draftStore";
import { useTasks } from "@/features/tasks/application/TaskProvider";
import { toLocalDateKey } from "@/features/tasks/domain/dateWindow";
import type {
  InputMethod,
  ParseResult,
} from "@/features/tasks/domain/task";

type CaptureState =
  | { kind: "editing" }
  | { kind: "parsing" }
  | { kind: "preview"; result: ParseResult; saveError: string | null }
  | { kind: "cleanup-error"; message: string }
  | { kind: "error"; message: string };

const parseErrorMessage =
  "Не вдалося проаналізувати нотатку. Спробувати ще раз";
const cleanupErrorMessage =
  "Задачі додано, але нотатку не вдалося очистити. Спробувати ще раз";
const draftLoadErrorMessage =
  "Не вдалося відкрити локальну чернетку. Можна продовжити без неї";
const draftSaveErrorMessage =
  "Не вдалося зберегти чернетку в цьому браузері. Не закривайте сторінку";
const taskSaveErrorMessage =
  "Не вдалося зберегти задачі. Спробуйте ще раз";

type CaptureScreenProps = {
  aiAvailable?: boolean;
  onConfirmedSave?(): void;
};

export function CaptureScreen({
  aiAvailable = true,
  onConfirmedSave,
}: CaptureScreenProps) {
  const { addDrafts } = useTasks();
  const [text, setText] = useState("");
  const [inputMethod, setInputMethod] = useState<InputMethod>("text");
  const [captureState, setCaptureState] = useState<CaptureState>({
    kind: "editing",
  });
  const [draftStorageError, setDraftStorageError] = useState<string | null>(null);
  const textRef = useRef(text);
  const pendingDraftWrite = useRef(Promise.resolve());

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    let mounted = true;

    void loadCaptureDraft()
      .then((draft) => {
        if (mounted && !textRef.current) setText(draft);
      })
      .catch(() => {
        if (mounted) setDraftStorageError(draftLoadErrorMessage);
      });

    return () => {
      mounted = false;
    };
  }, []);

  function changeText(value: string, transcriptMethod?: InputMethod) {
    if (transcriptMethod) {
      setInputMethod(transcriptMethod);
    } else if (!text || !value) {
      setInputMethod("text");
    }
    setText(value);
    pendingDraftWrite.current = pendingDraftWrite.current
      .catch(() => undefined)
      .then(() => saveCaptureDraft(value))
      .then(() => setDraftStorageError(null))
      .catch(() => setDraftStorageError(draftSaveErrorMessage));
  }

  async function parseCapture(
    captureInputMethod: InputMethod = inputMethod,
    captureText = text,
  ) {
    if (!aiAvailable || !isOnlineNow() || !captureText.trim()) return;

    setCaptureState({ kind: "parsing" });
    try {
      assertOnline();
      const result = await parseText({
        text: captureText,
        today: toLocalDateKey(new Date()),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        inputMethod: captureInputMethod,
      });
      assertOnline();
      setCaptureState({ kind: "preview", result, saveError: null });
    } catch (error) {
      if (isOfflineError(error) || !isOnlineNow()) {
        setCaptureState({ kind: "editing" });
        return;
      }
      trackSafeEvent("parse_failed");
      setCaptureState({ kind: "error", message: parseErrorMessage });
    }
  }

  async function handleTranscript(transcript: string) {
    if (!isOnlineNow()) return;
    changeText(transcript, "voice");
  }

  async function confirmTasks(tasks: ParseResult["tasks"]) {
    try {
      await pendingDraftWrite.current;
      await addDrafts(tasks);
      window.dispatchEvent(new Event("noteai:local-data-ready"));
      trackSafeEvent("capture_confirmed");
      onConfirmedSave?.();
    } catch {
      setCaptureState((current) =>
        current.kind === "preview"
          ? { ...current, saveError: taskSaveErrorMessage }
          : current,
      );
      return;
    }

    await clearConfirmedDraft();
  }

  async function clearConfirmedDraft() {
    try {
      await clearCaptureDraft();
      setText("");
      setInputMethod("text");
      setDraftStorageError(null);
      setCaptureState({ kind: "editing" });
    } catch {
      setCaptureState({ kind: "cleanup-error", message: cleanupErrorMessage });
    }
  }

  if (captureState.kind === "preview") {
    return (
      <QuickPreview
        initialTasks={captureState.result.tasks}
        clarification={captureState.result.clarification}
        confirmationError={captureState.saveError}
        storageError={draftStorageError}
        onCancel={() => setCaptureState({ kind: "editing" })}
        onConfirm={confirmTasks}
      />
    );
  }

  if (captureState.kind === "cleanup-error") {
    return (
      <section aria-label="Створення нотатки" className="capture-screen">
        <h1>Що в голові?</h1>
        <p role="alert" className="capture-error">
          {captureState.message}
        </p>
        <button
          type="button"
          className="primary-button"
          onClick={clearConfirmedDraft}
        >
          Спробувати ще раз
        </button>
      </section>
    );
  }

  const isParsing = captureState.kind === "parsing";

  return (
    <section aria-label="Створення нотатки" className="capture-screen">
      <h1>Що в голові?</h1>
      <p>Напишіть або скажіть усе підряд, а ми перетворимо це на задачі.</p>
      <label className="capture-input">
        Ваша нотатка
        <textarea
          value={text}
          onChange={(event) => changeText(event.target.value)}
          placeholder="Наприклад, купити молоко сьогодні"
          rows={6}
          disabled={isParsing}
        />
      </label>
      {isParsing ? null : (
        <VoiceRecorder onTranscript={handleTranscript} disabled={!aiAvailable} />
      )}
      <p className="storage-help">Зберігається лише в цьому браузері</p>
      {captureState.kind === "error" ? (
        <p role="alert" className="capture-error">
          {captureState.message}
        </p>
      ) : null}
      {draftStorageError ? (
        <p role="alert" className="capture-error">
          {draftStorageError}
        </p>
      ) : null}
      <button
        type="button"
        className="primary-button"
        onClick={() => parseCapture()}
        disabled={isParsing || !text.trim() || !aiAvailable}
      >
        {isParsing ? "Аналізуємо…" : "Розібрати"}
      </button>
    </section>
  );
}
