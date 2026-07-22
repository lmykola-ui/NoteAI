"use client";

import { Fragment, useEffect, useRef, useState, type PointerEvent } from "react";
import type { Task } from "@/features/tasks/domain/task";
import { TaskCard } from "./TaskCard";

const LONG_PRESS_MS = 350;
const SCROLL_MOVEMENT_THRESHOLD = 12;

type InboxScreenProps = {
  tasks: Task[];
  today: string;
  onComplete(id: string): void | Promise<void>;
  onRestore(id: string): void | Promise<void>;
  onEdit?(task: Task): void;
  onReorder?(ids: string[]): void | Promise<void>;
};

export function compareInboxTasks(left: Task, right: Task): number {
  if (left.inboxOrder != null && right.inboxOrder != null) {
    return left.inboxOrder - right.inboxOrder;
  }
  if (left.inboxOrder != null) return -1;
  if (right.inboxOrder != null) return 1;
  return left.createdAt.localeCompare(right.createdAt);
}

export function InboxScreen({ tasks, today, onReorder, ...actions }: InboxScreenProps) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingTaskIdRef = useRef<string | null>(null);
  const dragStartY = useRef(0);
  const pointerStart = useRef<{ id: number; y: number } | null>(null);
  const pointerTarget = useRef<HTMLDivElement | null>(null);
  const suppressNextClick = useRef(false);
  const taskElements = useRef(new Map<string, HTMLDivElement>());
  const activeTasks = tasks
    .filter((task) => task.status === "active")
    .sort(compareInboxTasks);

  useEffect(
    () => () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!draggingTaskId) return;

    const preventTouchScroll = (event: TouchEvent) => event.preventDefault();
    window.addEventListener("touchmove", preventTouchScroll, { passive: false });
    return () => window.removeEventListener("touchmove", preventTouchScroll);
  }, [draggingTaskId]);

  function clearLongPressTimer() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  function targetIndex(clientY: number, draggedId: string) {
    const remaining = activeTasks.filter((task) => task.id !== draggedId);
    const beforeTask = remaining.findIndex((task) => {
      const element = taskElements.current.get(task.id);
      if (!element) return false;
      const bounds = element.getBoundingClientRect();
      return clientY < bounds.top + bounds.height / 2;
    });

    return beforeTask === -1 ? remaining.length : beforeTask;
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>, task: Task) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as Element).closest(".task-completion")) return;

    pointerStart.current = { id: event.pointerId, y: event.clientY };
    pointerTarget.current = event.currentTarget;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    longPressTimer.current = setTimeout(() => {
      draggingTaskIdRef.current = task.id;
      dragStartY.current = event.clientY;
      suppressNextClick.current = true;
      setDraggingTaskId(task.id);
      setDragOffsetY(0);
      setInsertionIndex(targetIndex(event.clientY, task.id));
    }, LONG_PRESS_MS);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const draggedId = draggingTaskIdRef.current;
    if (!draggedId) {
      const start = pointerStart.current;
      if (start?.id === event.pointerId && Math.abs(event.clientY - start.y) > SCROLL_MOVEMENT_THRESHOLD) {
        clearLongPressTimer();
      }
      return;
    }
    setDragOffsetY(event.clientY - dragStartY.current);
    setInsertionIndex(targetIndex(event.clientY, draggedId));
  }

  function stopDragging(event?: PointerEvent<HTMLDivElement>) {
    clearLongPressTimer();
    const draggedId = draggingTaskIdRef.current;
    if (!draggedId) {
      pointerStart.current = null;
      return;
    }

    const nextIndex = event ? targetIndex(event.clientY, draggedId) : insertionIndex;
    const remaining = activeTasks.filter((task) => task.id !== draggedId);
    const draggedTask = activeTasks.find((task) => task.id === draggedId);
    if (!draggedTask) return;
    const order = [...remaining];
    order.splice(nextIndex ?? remaining.length, 0, draggedTask);
    const ids = order.map((task) => task.id);
    const changed = ids.some((id, index) => id !== activeTasks[index]?.id);

    draggingTaskIdRef.current = null;
    pointerStart.current = null;
    const capturedElement = pointerTarget.current;
    if (event && capturedElement?.hasPointerCapture?.(event.pointerId)) {
      capturedElement.releasePointerCapture?.(event.pointerId);
    }
    pointerTarget.current = null;
    setDraggingTaskId(null);
    setInsertionIndex(null);
    setDragOffsetY(0);
    if (changed) void onReorder?.(ids);
  }

  function cancelDragging() {
    clearLongPressTimer();
    draggingTaskIdRef.current = null;
    pointerStart.current = null;
    pointerTarget.current = null;
    setDraggingTaskId(null);
    setInsertionIndex(null);
    setDragOffsetY(0);
  }

  const remainingTasks = draggingTaskId
    ? activeTasks.filter((task) => task.id !== draggingTaskId)
    : [];

  return (
    <section className="task-screen" aria-label="Вхідні">
      <h1>Вхідні</h1>
      {activeTasks.length ? (
        <div
          className="task-list"
          onPointerMove={onPointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={cancelDragging}
        >
          {activeTasks.map((task) => (
            <Fragment key={task.id}>
              {draggingTaskId && remainingTasks[insertionIndex ?? remainingTasks.length]?.id === task.id ? (
                <div className="inbox-drop-marker" data-testid="inbox-drop-marker" aria-hidden="true" />
              ) : null}
              <div
                ref={(element) => {
                  if (element) taskElements.current.set(task.id, element);
                  else taskElements.current.delete(task.id);
                }}
                className={`inbox-task ${draggingTaskId === task.id ? "inbox-task--dragging" : ""}`}
                data-task-id={task.id}
                style={draggingTaskId === task.id ? { transform: `translateY(${dragOffsetY}px) scale(.985)` } : undefined}
                onClickCapture={(event) => {
                  if (!suppressNextClick.current) return;
                  event.preventDefault();
                  event.stopPropagation();
                  suppressNextClick.current = false;
                }}
                onPointerDown={(event) => onPointerDown(event, task)}
                onPointerMove={onPointerMove}
                onPointerUp={stopDragging}
                onPointerCancel={cancelDragging}
              >
                <TaskCard task={task} today={today} {...actions} onComplete={() => undefined} onCompletionAnimationEnd={actions.onComplete} />
              </div>
            </Fragment>
          ))}
          {draggingTaskId && insertionIndex === remainingTasks.length ? (
            <div className="inbox-drop-marker" data-testid="inbox-drop-marker" aria-hidden="true" />
          ) : null}
        </div>
      ) : (
        <p className="empty-state">У Вхідних немає активних задач.</p>
      )}
    </section>
  );
}
