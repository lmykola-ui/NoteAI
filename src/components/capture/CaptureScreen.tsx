"use client";

import { useEffect, useRef, useState } from "react";
import { QuickPreview } from "@/components/preview/QuickPreview";
import { parseText } from "@/features/capture/application/parseClient";
import {
  clearCaptureDraft,
  loadCaptureDraft,
  saveCaptureDraft,
} from "@/features/capture/infrastructure/draftStore";
import { useTasks } from "@/features/tasks/application/TaskProvider";
import { toLocalDateKey } from "@/features/tasks/domain/dateWindow";
import type { ParseResult } from "@/features/tasks/domain/task";

type CaptureState =
  | { kind: "editing" }
  | { kind: "parsing" }
  | { kind: "preview"; result: ParseResult }
  | { kind: "cleanup-error"; message: string }
  | { kind: "error"; message: string };

const parseErrorMessage =
  "Не вдалося проаналізувати нотатку. Спробувати ще раз";
const cleanupErrorMessage =
  "Задачі додано, але нотатку не вдалося очистити. Спробувати ще раз";

export function CaptureScreen() {
  const { addDrafts } = useTasks();
  const [text, setText] = useState("");
  const [captureState, setCaptureState] = useState<CaptureState>({
    kind: "editing",
  });
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
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  function changeText(value: string) {
    setText(value);
    pendingDraftWrite.current = pendingDraftWrite.current
      .catch(() => undefined)
      .then(() => saveCaptureDraft(value))
      .catch(() => undefined);
  }

  async function parseCapture() {
    if (!text.trim()) return;

    setCaptureState({ kind: "parsing" });
    try {
      const result = await parseText({
        text,
        today: toLocalDateKey(new Date()),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        inputMethod: "text",
      });
      setCaptureState({ kind: "preview", result });
    } catch {
      setCaptureState({ kind: "error", message: parseErrorMessage });
    }
  }

  async function confirmTasks(tasks: ParseResult["tasks"]) {
    try {
      await pendingDraftWrite.current;
      await addDrafts(tasks);
    } catch {
      setCaptureState({ kind: "error", message: parseErrorMessage });
      return;
    }

    await clearConfirmedDraft();
  }

  async function clearConfirmedDraft() {
    try {
      await clearCaptureDraft();
      setText("");
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
      <p>Напишіть усе підряд, а ми перетворимо це на задачі.</p>
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
      {captureState.kind === "error" ? (
        <p role="alert" className="capture-error">
          {captureState.message}
        </p>
      ) : null}
      <button
        type="button"
        className="primary-button"
        onClick={parseCapture}
        disabled={isParsing || !text.trim()}
      >
        {isParsing ? "Аналізуємо…" : "Розібрати"}
      </button>
    </section>
  );
}
