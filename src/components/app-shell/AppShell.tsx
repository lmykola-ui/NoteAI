"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarRange, CheckCircle2, Inbox, MoreHorizontal, Plus, Sun, Undo2 } from "lucide-react";
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
import type { Task } from "@/features/tasks/domain/task";

type Destination = "inbox" | "plan" | "upcoming" | "capture";

const destinations: Array<{ id: Destination; label: string; Icon: typeof Inbox }> = [
  { id: "inbox", label: "Вхідні", Icon: Inbox },
  { id: "plan", label: "Сьогодні", Icon: Sun },
  { id: "upcoming", label: "Заплановані", Icon: CalendarRange },
];

export function AppShell() {
  const [destination, setDestination] = useState<Destination>("inbox");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [voiceFirst, setVoiceFirst] = useState(false);
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
    addDrafts,
    updateTask,
    completeTask,
    restoreTask,
    clearCompletedTasks,
    reorderInboxTasks,
  } = useTasks();
  const today = useLocalToday();

  useEffect(() => {
    if (!undoTaskId) return;
    const timeout = window.setTimeout(() => setUndoTaskId(null), 3_000);
    return () => window.clearTimeout(timeout);
  }, [undoTaskId]);

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
      {historyOpen ? <HistoryScreen tasks={tasks} today={today} onRestore={restoreTask} onClose={() => setHistoryOpen(false)} onClear={clearCompletedTasks} /> : null}
      {utilityScreen ? <section className="task-screen utility-screen" aria-label={utilityScreen === "settings" ? "Налаштування" : utilityScreen === "premium" ? "Premium" : "Онбординг"}><div className="screen-heading"><h1>{utilityScreen === "settings" ? "Налаштування" : utilityScreen === "premium" ? "Premium" : "Онбординг"}</h1><button type="button" className="secondary-button" onClick={() => setUtilityScreen(null)}>Назад</button></div><p className="empty-state">{utilityScreen === "settings" ? "Налаштування застосунку з’являться тут." : utilityScreen === "premium" ? "Можливості Premium з’являться тут." : "Коротке знайомство з NoteAI з’явиться тут."}</p></section> : null}
      {!historyOpen && !utilityScreen && destination === "capture" ? (
        <CaptureScreen
          aiAvailable={isOnline}
          onConfirmedSave={requestPersistenceAfterFirstSave}
          onTypedConfirmedSave={() => {
            setVoiceFirst(false);
            setDestination("inbox");
          }}
          onVoiceTasksCreated={(created) => {
            const hasToday = created.some((task) => task.scheduledDate === today);
            const hasScheduled = created.some((task) =>
              Boolean(task.scheduledDate && task.scheduledDate > today),
            );
            setVoiceFirst(false);
            setDestination(hasToday ? "plan" : hasScheduled ? "upcoming" : "inbox");
          }}
          voiceFirst={voiceFirst}
        />
      ) : null}
      {!historyOpen && !utilityScreen && destination === "upcoming" ? <UpcomingScreen tasks={tasks} today={today} onComplete={completeWithUndo} onRestore={restoreTask} onEdit={setEditingTask} /> : null}
      {!historyOpen && !utilityScreen && destination === "inbox" ? (
        <InboxScreen
          tasks={tasks}
          today={today}
          onComplete={completeWithUndo}
          onRestore={restoreTask}
          onEdit={setEditingTask}
          onReorder={reorderInboxTasks}
        />
      ) : null}
      {!historyOpen && !utilityScreen && destination === "plan" ? (
        <PlanScreen
          tasks={tasks}
          today={today}
          onComplete={completeWithUndo}
          onRestore={restoreTask}
          onEdit={setEditingTask}
          onClearCompleted={async (completedTasks) => {
            await Promise.all(
              completedTasks.map((task) => updateTask({
                ...task,
                scheduledDate: null,
                scheduledTime: null,
              })),
            );
          }}
        />
      ) : null}
      {error ? <p role="alert" className="capture-error">{error}</p> : null}
      {!historyOpen && !utilityScreen ? <><button type="button" aria-label="Відкрити меню" className="history-button" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><MoreHorizontal size={22} strokeWidth={2.2} /></button>{menuOpen ? <div className="overflow-menu" role="menu"><button role="menuitem" type="button" onClick={() => { setMenuOpen(false); setHistoryOpen(true); }}>Історія</button><button role="menuitem" type="button" onClick={() => { setMenuOpen(false); setUtilityScreen("premium"); }}>Premium</button><button role="menuitem" type="button" onClick={() => { setMenuOpen(false); setUtilityScreen("settings"); }}>Налаштування</button><button role="menuitem" type="button" onClick={() => { setMenuOpen(false); setUtilityScreen("onboarding"); }}>Онбординг</button></div> : null}</> : null}
      {undoTaskId ? <div className="undo-toast" role="status" aria-label="Задача виконана"><span><CheckCircle2 size={19} strokeWidth={2.3} aria-hidden="true" />Виконано</span><button type="button" onClick={async () => { await restoreTask(undoTaskId); setUndoTaskId(null); }}><Undo2 size={17} strokeWidth={2.3} aria-hidden="true" />Скасувати</button></div> : null}
      {destination !== "capture" ? <button type="button" aria-label="Додати задачу" className="add-task-button" onClick={() => setComposerOpen(true)}><Plus size={28} strokeWidth={2.4} /></button> : null}
      {composerOpen || editingTask ? <TaskComposer today={today} task={editingTask ?? undefined} onClose={() => { setComposerOpen(false); setEditingTask(null); }} onStartVoice={() => { setComposerOpen(false); setEditingTask(null); setVoiceFirst(true); setDestination("capture"); }} onCreate={async (draft) => { await addDrafts([draft]); requestPersistenceAfterFirstSave(); setComposerOpen(false); setVoiceFirst(false); setDestination("inbox"); }} onUpdate={async (task) => { await updateTask(task); requestPersistenceAfterFirstSave(); setEditingTask(null); }} /> : null}
      <nav aria-label="Основна навігація" className="bottom-nav">
        {destinations.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={destination === id ? "page" : undefined}
            onClick={() => setDestination(id)}
          >
            <span data-testid="nav-icon" className="nav-icon" aria-hidden="true"><Icon size={20} strokeWidth={2} /></span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}
