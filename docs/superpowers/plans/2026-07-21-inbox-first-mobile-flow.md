# NoteAI Inbox-First Mobile Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile prototype open on Вхідні and support mobile task browsing, composer-driven manual/voice capture, review, completion undo, and history.

**Architecture:** Keep task persistence in `TaskProvider` and IndexedDB. Add presentation-only helpers and focused components for navigation, composer, history, and task card rendering; `AppShell` owns the selected destination, composer state, undo state, and connects existing capture/preview flows.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library, existing Web Audio and OpenAI client flows.

## Global Constraints

- Keep all visible copy and accessible names Ukrainian.
- Use existing `TaskPriority` values: `high` = Висока, `medium` = Середня, `low` = Мінімальна, `null` = Без пріоритету.
- Do not change IndexedDB schema or move OpenAI calls to the client.
- Support 320–430 px widths, 44 px targets, fixed safe-area navigation, and reduced motion.
- Preserve existing offline, draft, parsing, transcription, and QuickPreview error handling.

---

### Task 1: Define task-display helpers and priority semantics

**Files:**
- Create: `src/features/tasks/domain/taskPresentation.ts`
- Create: `src/features/tasks/domain/taskPresentation.test.ts`
- Modify: `src/components/tasks/TaskCard.tsx`
- Modify: `src/components/preview/QuickPreview.tsx`
- Test: `src/components/tasks/TaskCard.test.tsx`

**Interfaces:**
- Produces `priorityPresentation(priority: TaskPriority | null): { label: string; tone: "high" | "medium" | "minimal" | "none"; direction: "up" | "flat" | "down" }`.
- Produces `formatTaskSchedule(task: Pick<Task, "scheduledDate" | "scheduledTime">, today: string): string`.
- Consumes `Task` from `task.ts` without changing stored values.

- [ ] **Step 1: Write the failing domain tests**

```ts
import { expect, it } from "vitest";
import { formatTaskSchedule, priorityPresentation } from "./taskPresentation";

it("maps stored priorities to approved Ukrainian priority presentation", () => {
  expect(priorityPresentation("high")).toMatchObject({ label: "Висока", tone: "high", direction: "up" });
  expect(priorityPresentation("medium")).toMatchObject({ label: "Середня", tone: "medium", direction: "flat" });
  expect(priorityPresentation("low")).toMatchObject({ label: "Мінімальна", tone: "minimal", direction: "down" });
  expect(priorityPresentation(null)).toMatchObject({ label: "Без пріоритету", tone: "none" });
});

it("formats relative Ukrainian date and optional time", () => {
  expect(formatTaskSchedule({ scheduledDate: "2026-07-21", scheduledTime: "11:00" }, "2026-07-21")).toBe("Сьогодні · 11:00");
  expect(formatTaskSchedule({ scheduledDate: "2026-07-22", scheduledTime: null }, "2026-07-21")).toBe("Завтра");
  expect(formatTaskSchedule({ scheduledDate: null, scheduledTime: null }, "2026-07-21")).toBe("Без терміну");
});
```

- [ ] **Step 2: Run the domain test to verify it fails**

Run: `pnpm vitest run src/features/tasks/domain/taskPresentation.test.ts`

Expected: FAIL because `taskPresentation` does not exist.

- [ ] **Step 3: Implement the minimal helpers**

```ts
import { addLocalDays } from "./dateWindow";
import type { Task, TaskPriority } from "./task";

export function priorityPresentation(priority: TaskPriority | null) {
  if (priority === "high") return { label: "Висока", tone: "high" as const, direction: "up" as const };
  if (priority === "medium") return { label: "Середня", tone: "medium" as const, direction: "flat" as const };
  if (priority === "low") return { label: "Мінімальна", tone: "minimal" as const, direction: "down" as const };
  return { label: "Без пріоритету", tone: "none" as const, direction: "up" as const };
}

export function formatTaskSchedule(task: Pick<Task, "scheduledDate" | "scheduledTime">, today: string) {
  if (!task.scheduledDate) return "Без терміну";
  const day = task.scheduledDate === today ? "Сьогодні" : task.scheduledDate === addLocalDays(today, 1) ? "Завтра" : new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long" }).format(new Date(`${task.scheduledDate}T12:00:00`));
  return task.scheduledTime ? `${day} · ${task.scheduledTime}` : day;
}
```

- [ ] **Step 4: Update card and preview labels**

Replace every displayed `Низький` and `Не вказано` priority option with `Мінімальна` and `Без пріоритету`; render the helper’s label rather than a raw priority string.

- [ ] **Step 5: Run focused tests**

Run: `pnpm vitest run src/features/tasks/domain/taskPresentation.test.ts src/components/tasks/TaskCard.test.tsx src/components/preview/QuickPreview.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/tasks/domain/taskPresentation.ts src/features/tasks/domain/taskPresentation.test.ts src/components/tasks/TaskCard.tsx src/components/tasks/TaskCard.test.tsx src/components/preview/QuickPreview.tsx
git commit -m "feat: localize task priority presentation"
```

### Task 2: Build Inbox, Today, and Planned data views

**Files:**
- Create: `src/components/tasks/UpcomingScreen.tsx`
- Create: `src/components/tasks/UpcomingScreen.test.tsx`
- Modify: `src/components/tasks/InboxScreen.tsx`
- Modify: `src/components/tasks/InboxScreen.test.tsx`
- Modify: `src/components/tasks/PlanScreen.tsx`
- Modify: `src/components/tasks/PlanScreen.test.tsx`

**Interfaces:**
- `InboxScreen` accepts only active tasks and displays an ungrouped list.
- `PlanScreen` becomes the Today screen and accepts `tasks`, `today`, and task action callbacks.
- `UpcomingScreen` accepts the same props and groups future active tasks by scheduled date.

- [ ] **Step 1: Write the failing view tests**

```tsx
it("shows inbox active tasks in one list with relative date metadata", () => {
  render(<InboxScreen tasks={[makeTask({ scheduledDate: "2026-07-21" }), makeTask({ id: "no-date", scheduledDate: null })]} today="2026-07-21" {...actions} />);
  expect(screen.getByRole("heading", { name: "Вхідні" })).toBeVisible();
  expect(screen.queryByText("Сьогодні", { selector: "h2" })).not.toBeInTheDocument();
  expect(screen.getByText("Сьогодні · 12:00")).toBeVisible();
});

it("shows only today's active tasks", () => {
  render(<PlanScreen tasks={[makeTask({ scheduledDate: "2026-07-21" }), makeTask({ id: "tomorrow", scheduledDate: "2026-07-22" })]} today="2026-07-21" {...actions} />);
  expect(screen.getByRole("heading", { name: "Сьогодні" })).toBeVisible();
  expect(screen.queryByLabelText("tomorrow")).not.toBeInTheDocument();
});

it("groups scheduled tasks in Ukrainian upcoming date sections", () => {
  render(<UpcomingScreen tasks={[makeTask({ scheduledDate: "2026-07-22" })]} today="2026-07-21" {...actions} />);
  expect(screen.getByRole("heading", { name: "Заплановані" })).toBeVisible();
  expect(screen.getByText(/Завтра/)).toBeVisible();
});
```

- [ ] **Step 2: Run failing tests**

Run: `pnpm vitest run src/components/tasks/InboxScreen.test.tsx src/components/tasks/PlanScreen.test.tsx src/components/tasks/UpcomingScreen.test.tsx`

Expected: FAIL because Ukrainian destinations and `UpcomingScreen` are absent.

- [ ] **Step 3: Implement filters and headings**

Use `task.status === "active"`; Inbox retains all active tasks and sorts by `createdAt`; Today filters `scheduledDate === today`; Upcoming filters non-null `scheduledDate >= today`, groups by date, and sorts each group with `comparePlanTasks`.

- [ ] **Step 4: Run focused tests**

Run: `pnpm vitest run src/components/tasks/InboxScreen.test.tsx src/components/tasks/PlanScreen.test.tsx src/components/tasks/UpcomingScreen.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/InboxScreen.tsx src/components/tasks/InboxScreen.test.tsx src/components/tasks/PlanScreen.tsx src/components/tasks/PlanScreen.test.tsx src/components/tasks/UpcomingScreen.tsx src/components/tasks/UpcomingScreen.test.tsx
git commit -m "feat: add inbox-first task destinations"
```

### Task 3: Add the accessible composer and manual task creation

**Files:**
- Create: `src/components/tasks/TaskComposer.tsx`
- Create: `src/components/tasks/TaskComposer.test.tsx`
- Modify: `src/components/app-shell/AppShell.tsx`
- Modify: `src/components/app-shell/AppShell.test.tsx`

**Interfaces:**
- `TaskComposer({ today, onClose, onCreate, onStartVoice })` calls `onCreate(draft: TaskDraft)` for a manual task.
- Date choices are `today`, `tomorrow`, and custom HTML date input; time is a native time input.
- `onStartVoice()` transitions to the existing Capture flow while preserving composer metadata.

- [ ] **Step 1: Write failing composer tests**

```tsx
it("creates a manually entered task with selected tomorrow date, time, and priority", async () => {
  const onCreate = vi.fn();
  render(<TaskComposer today="2026-07-21" onClose={vi.fn()} onCreate={onCreate} onStartVoice={vi.fn()} />);
  await user.type(screen.getByLabelText("Що потрібно зробити?"), "Надіслати бриф");
  await user.selectOptions(screen.getByLabelText("Дата"), "tomorrow");
  await user.type(screen.getByLabelText("Час"), "11:00");
  await user.selectOptions(screen.getByLabelText("Пріоритет"), "high");
  await user.click(screen.getByRole("button", { name: "Зберегти задачу" }));
  expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ title: "Надіслати бриф", scheduledDate: "2026-07-22", scheduledTime: "11:00", priority: "high", inputMethod: "text" }));
});
```

- [ ] **Step 2: Run failing composer test**

Run: `pnpm vitest run src/components/tasks/TaskComposer.test.tsx`

Expected: FAIL because `TaskComposer` does not exist.

- [ ] **Step 3: Implement the bottom-sheet dialog**

Use `role="dialog"`, `aria-modal="true"`, one title input, labelled date/time/priority controls, a microphone icon-only button with `aria-label="Записати голосом"`, and Cancel/Save buttons. Map day choice through `addLocalDays(today, 1)` and create a `TaskDraft` with `status: "active"` and `inputMethod: "text"`.

- [ ] **Step 4: Wire manual save in AppShell**

Add `composerOpen` state; render a fixed `+` labeled `Додати задачу`; call `addDrafts([draft])`, request persistence, close the composer, and select `inbox` after success. Preserve an error in the composer if save rejects.

- [ ] **Step 5: Run focused tests**

Run: `pnpm vitest run src/components/tasks/TaskComposer.test.tsx src/components/app-shell/AppShell.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/tasks/TaskComposer.tsx src/components/tasks/TaskComposer.test.tsx src/components/app-shell/AppShell.tsx src/components/app-shell/AppShell.test.tsx
git commit -m "feat: add mobile task composer"
```

### Task 4: Integrate voice capture, AI review, completion undo, and history

**Files:**
- Create: `src/components/tasks/HistoryScreen.tsx`
- Create: `src/components/tasks/HistoryScreen.test.tsx`
- Modify: `src/components/app-shell/AppShell.tsx`
- Modify: `src/components/capture/CaptureScreen.tsx`
- Modify: `src/components/tasks/TaskCard.tsx`
- Modify: `src/components/tasks/TaskCard.test.tsx`

**Interfaces:**
- `HistoryScreen({ tasks, today, onRestore, onDelete })` lists only completed tasks.
- `AppShell` exposes a transient undo action after `completeTask(id)` and calls `restoreTask(id)` on Undo.
- Capture accepts optional initial metadata for composer voice flow and sends resulting drafts through existing `QuickPreview` confirmation.

- [ ] **Step 1: Write failing tests**

```tsx
it("shows an undo action after completing a task and restores it", async () => {
  renderShellWithTask(makeTask());
  await user.click(screen.getByRole("button", { name: "Позначити виконаною" }));
  expect(await screen.findByRole("button", { name: "Скасувати" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Скасувати" }));
  expect(screen.getByRole("button", { name: "Позначити виконаною" })).toBeVisible();
});

it("lists completed tasks in history and restores a selected task", async () => {
  render(<HistoryScreen tasks={[makeTask({ status: "completed" })]} today="2026-07-21" onRestore={onRestore} onDelete={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "Відновити задачу" }));
  expect(onRestore).toHaveBeenCalledWith("task-1");
});
```

- [ ] **Step 2: Run failing tests**

Run: `pnpm vitest run src/components/app-shell/AppShell.test.tsx src/components/tasks/HistoryScreen.test.tsx`

Expected: FAIL because undo/history UI does not exist.

- [ ] **Step 3: Implement history and undo**

Add a `⋯` button to each task destination that opens `HistoryScreen`; keep it keyboard accessible. Wrap `completeTask` so it stores the completed id, shows `Виконано` plus `Скасувати`, and clears the toast after five seconds. Undo calls `restoreTask` and clears the toast. History uses the existing `restoreTask` provider action.

- [ ] **Step 4: Preserve composer intent for voice analysis**

When `onStartVoice` is pressed, close only the sheet surface and render the existing `CaptureScreen` with voice active. Pass selected date/time/priority as defaults for every parsed active draft only where the parser did not provide that field. Keep parser-provided values authoritative.

- [ ] **Step 5: Run focused tests**

Run: `pnpm vitest run src/components/app-shell/AppShell.test.tsx src/components/tasks/HistoryScreen.test.tsx src/components/capture/CaptureScreen.test.tsx src/components/preview/QuickPreview.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/app-shell/AppShell.tsx src/components/app-shell/AppShell.test.tsx src/components/tasks/HistoryScreen.tsx src/components/tasks/HistoryScreen.test.tsx src/components/tasks/TaskCard.tsx src/components/tasks/TaskCard.test.tsx src/components/capture/CaptureScreen.tsx
git commit -m "feat: add task history and completion undo"
```

### Task 5: Apply responsive graphite styling and verify the full flow

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tests/e2e/noteai-core.spec.ts`
- Modify: `src/app/page.test.tsx`

**Interfaces:**
- The visual layer consumes existing semantic component class names plus new composer/history/navigation classes.
- E2E starts on Вхідні and can create, complete, undo, and restore a task on a mobile viewport.

- [ ] **Step 1: Write the failing mobile E2E assertion**

```ts
test("mobile task flow starts in inbox and preserves task actions", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Вхідні" })).toBeVisible();
  await page.getByRole("button", { name: "Додати задачу" }).click();
  await page.getByLabel("Що потрібно зробити?").fill("Купити молоко");
  await page.getByRole("button", { name: "Зберегти задачу" }).click();
  await page.getByRole("button", { name: "Позначити виконаною" }).click();
  await page.getByRole("button", { name: "Скасувати" }).click();
  await expect(page.getByText("Купити молоко")).toBeVisible();
});
```

- [ ] **Step 2: Run the E2E test to verify it fails**

Run: `pnpm playwright test tests/e2e/noteai-core.spec.ts --project=mobile-chrome`

Expected: FAIL because the app currently starts on Capture and has no composer.

- [ ] **Step 3: Style only the approved components**

Replace the legacy purple palette with the approved graphite tokens. Make `.mobile-shell` a constrained mobile column; add bottom padding for fixed navigation; style task cards, priority chevrons, composer dialog, history, undo snackbar, and navigation panel. Implement `@media (prefers-reduced-motion: reduce)` to remove waveform transitions. Do not add desktop-only layout branches.

- [ ] **Step 4: Run all static and unit checks**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: exit 0, no lint errors, no TypeScript errors, all Vitest tests passing.

- [ ] **Step 5: Run mobile E2E and build**

Run: `pnpm test:e2e && pnpm build`

Expected: exit 0, both mobile projects pass, and Next.js production build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css tests/e2e/noteai-core.spec.ts src/app/page.test.tsx
git commit -m "feat: ship inbox-first mobile task flow"
```
