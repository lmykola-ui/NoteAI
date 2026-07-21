"use client";

import { useRef, useState } from "react";
import {
  AppStatus,
  useOnlineStatus,
} from "@/components/app-shell/AppStatus";
import { CaptureScreen } from "@/components/capture/CaptureScreen";
import { InboxScreen } from "@/components/tasks/InboxScreen";
import { PlanScreen } from "@/components/tasks/PlanScreen";
import { UpcomingScreen } from "@/components/tasks/UpcomingScreen";
import { TaskComposer } from "@/components/tasks/TaskComposer";
import { HistoryScreen } from "@/components/tasks/HistoryScreen";
import { useTasks } from "@/features/tasks/application/TaskProvider";
import { useLocalToday } from "@/features/tasks/application/useLocalToday";
import { requestLocalPersistence } from "@/lib/storagePersistence";

type Destination = "inbox" | "plan" | "upcoming" | "capture";

const destinations: Array<{ id: Destination; label: string }> = [
  { id: "inbox", label: "Вхідні" },
  { id: "plan", label: "Сьогодні" },
  { id: "upcoming", label: "Заплановані" },
];

export function AppShell() {
  const [destination, setDestination] = useState<Destination>("inbox");
  const [composerOpen, setComposerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [utilityScreen, setUtilityScreen] = useState<"premium" | "settings" | "onboarding" | null>(null);
  const [undoTaskId, setUndoTaskId] = useState<string | null>(null);
  const isOnline = useOnlineStatus();
  const persistenceRequested = useRef(false);
  const {
    tasks,
    loading,
    error,
    addDrafts, updateTask,
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
  async function completeWithUndo(id: string) { await completeTask(id); setUndoTaskId(id); }

  return (
    <main className="mobile-shell">
      <AppStatus isOnline={isOnline} />
      {loading ? (
        <p role="status" aria-label="Локальні задачі" className="storage-help">
          Завантажуємо локальні задачі…
        </p>
      ) : null}
      {historyOpen ? <HistoryScreen tasks={tasks} today={today} onRestore={restoreTask} onDelete={deleteTask} onClose={() => setHistoryOpen(false)} /> : null}
      {utilityScreen ? <section className="task-screen utility-screen" aria-label={utilityScreen === "settings" ? "Налаштування" : utilityScreen === "premium" ? "Premium" : "Онбординг"}><div className="screen-heading"><h1>{utilityScreen === "settings" ? "Налаштування" : utilityScreen === "premium" ? "Premium" : "Онбординг"}</h1><button type="button" className="secondary-button" onClick={() => setUtilityScreen(null)}>Назад</button></div><p className="empty-state">{utilityScreen === "settings" ? "Налаштування застосунку з’являться тут." : utilityScreen === "premium" ? "Можливості Premium з’являться тут." : "Коротке знайомство з NoteAI з’явиться тут."}</p></section> : null}
      {!historyOpen && !utilityScreen && destination === "capture" ? (
        <CaptureScreen
          aiAvailable={isOnline}
          onConfirmedSave={() => {
            requestPersistenceAfterFirstSave();
            setDestination("inbox");
          }}
        />
      ) : null}
      {!historyOpen && !utilityScreen && destination === "upcoming" ? <UpcomingScreen tasks={tasks} today={today} onChange={updateTask} onComplete={completeWithUndo} onRestore={restoreTask} onDelete={deleteTask} /> : null}
      {!historyOpen && !utilityScreen && destination === "inbox" ? (
        <InboxScreen
          tasks={tasks}
          today={today}
          onChange={updateTask}
          onComplete={completeWithUndo}
          onRestore={restoreTask}
          onDelete={deleteTask}
        />
      ) : null}
      {!historyOpen && !utilityScreen && destination === "plan" ? (
        <PlanScreen
          tasks={tasks}
          today={today}
          onChange={updateTask}
          onComplete={completeWithUndo}
          onRestore={restoreTask}
          onDelete={deleteTask}
        />
      ) : null}
      {error ? <p role="alert" className="capture-error">{error}</p> : null}
      {!historyOpen && !utilityScreen ? <><button type="button" aria-label="Відкрити меню" className="history-button" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>⋯</button>{menuOpen ? <div className="overflow-menu" role="menu"><button role="menuitem" type="button" onClick={() => { setMenuOpen(false); setHistoryOpen(true); }}>Історія</button><button role="menuitem" type="button" onClick={() => { setMenuOpen(false); setUtilityScreen("premium"); }}>Premium</button><button role="menuitem" type="button" onClick={() => { setMenuOpen(false); setUtilityScreen("settings"); }}>Налаштування</button><button role="menuitem" type="button" onClick={() => { setMenuOpen(false); setUtilityScreen("onboarding"); }}>Онбординг</button></div> : null}</> : null}
      {undoTaskId ? <div className="undo-toast" role="status">Виконано <button type="button" onClick={async () => { await restoreTask(undoTaskId); setUndoTaskId(null); }}>Скасувати</button></div> : null}
      {destination !== "capture" ? <button type="button" aria-label="Додати задачу" className="add-task-button" onClick={() => setComposerOpen(true)}>+</button> : null}
      {composerOpen ? <TaskComposer today={today} onClose={() => setComposerOpen(false)} onStartVoice={() => { setComposerOpen(false); setDestination("capture"); }} onCreate={async (draft) => { await addDrafts([draft]); requestPersistenceAfterFirstSave(); setComposerOpen(false); setDestination("inbox"); }} /> : null}
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
