"use client";

import { useRef, useState } from "react";
import {
  AppStatus,
  useOnlineStatus,
} from "@/components/app-shell/AppStatus";
import { CaptureScreen } from "@/components/capture/CaptureScreen";
import { InboxScreen } from "@/components/tasks/InboxScreen";
import { PlanScreen } from "@/components/tasks/PlanScreen";
import { useTasks } from "@/features/tasks/application/TaskProvider";
import { toLocalDateKey } from "@/features/tasks/domain/dateWindow";
import { requestLocalPersistence } from "@/lib/storagePersistence";

type Destination = "capture" | "inbox" | "plan";

const destinations: Array<{ id: Destination; label: string }> = [
  { id: "capture", label: "Capture" },
  { id: "inbox", label: "Inbox" },
  { id: "plan", label: "План" },
];

export function AppShell() {
  const [destination, setDestination] = useState<Destination>("capture");
  const isOnline = useOnlineStatus();
  const persistenceRequested = useRef(false);
  const { tasks, error, updateTask, completeTask, restoreTask, deleteTask } =
    useTasks();
  const today = toLocalDateKey(new Date());

  function requestPersistenceAfterFirstSave() {
    if (persistenceRequested.current) return;

    persistenceRequested.current = true;
    void requestLocalPersistence().catch(() => undefined);
  }

  return (
    <main className="mobile-shell">
      <AppStatus isOnline={isOnline} />
      {destination === "capture" ? (
        <CaptureScreen
          aiAvailable={isOnline}
          onConfirmedSave={requestPersistenceAfterFirstSave}
        />
      ) : null}
      {destination === "inbox" ? (
        <InboxScreen
          tasks={tasks}
          today={today}
          onChange={updateTask}
          onComplete={completeTask}
          onRestore={restoreTask}
          onDelete={deleteTask}
        />
      ) : null}
      {destination === "plan" ? (
        <PlanScreen
          tasks={tasks}
          today={today}
          onChange={updateTask}
          onComplete={completeTask}
          onRestore={restoreTask}
          onDelete={deleteTask}
        />
      ) : null}
      {error ? <p role="alert" className="capture-error">{error}</p> : null}
      <nav aria-label="Основна навігація" className="bottom-nav">
        {destinations.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-current={destination === id ? "page" : undefined}
            onClick={() => setDestination(id)}
          >
            {label}
          </button>
        ))}
      </nav>
    </main>
  );
}
