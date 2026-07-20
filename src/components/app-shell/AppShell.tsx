"use client";

import { useRef, useState } from "react";
import {
  AppStatus,
  useOnlineStatus,
} from "@/components/app-shell/AppStatus";
import { CaptureScreen } from "@/components/capture/CaptureScreen";
import { InboxScreen } from "@/components/tasks/InboxScreen";
import { PlanScreen } from "@/components/tasks/PlanScreen";
import {
  AppIcon,
  type AppIconName,
} from "@/components/icons/AppIcon";
import { useTasks } from "@/features/tasks/application/TaskProvider";
import { useLocalToday } from "@/features/tasks/application/useLocalToday";
import { requestLocalPersistence } from "@/lib/storagePersistence";

type Destination = "capture" | "inbox" | "plan";

const destinations: Array<{
  id: Destination;
  label: string;
  icon: AppIconName;
}> = [
  { id: "capture", label: "Запис", icon: "audio" },
  { id: "plan", label: "Задачі", icon: "tasks" },
  { id: "inbox", label: "Inbox", icon: "inbox" },
];

export function AppShell() {
  const [destination, setDestination] = useState<Destination>("capture");
  const isOnline = useOnlineStatus();
  const persistenceRequested = useRef(false);
  const {
    tasks,
    loading,
    error,
    updateTask,
    completeTask,
    restoreTask,
    deleteTask,
  } = useTasks();
  const today = useLocalToday();

  function requestPersistenceAfterFirstSave() {
    if (persistenceRequested.current) return;

    persistenceRequested.current = true;
    void requestLocalPersistence().catch(() => undefined);
  }

  return (
    <main className="mobile-shell">
      <AppStatus isOnline={isOnline} />
      {loading ? (
        <p role="status" aria-label="Локальні задачі" className="storage-help">
          Завантажуємо локальні задачі…
        </p>
      ) : null}
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
        {destinations.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-current={destination === id ? "page" : undefined}
            onClick={() => setDestination(id)}
          >
            <AppIcon name={icon} size={22} decorative />
            {destination === id ? (
              <span className="active-nav-indicator" aria-hidden="true" />
            ) : null}
          </button>
        ))}
      </nav>
    </main>
  );
}
