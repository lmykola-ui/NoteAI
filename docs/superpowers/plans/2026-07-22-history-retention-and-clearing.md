# History Retention and Clearing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove completed tasks older than 30 days automatically and let the user safely clear retained History tasks.

**Architecture:** A pure domain helper determines expiration from an injected clock. `TaskProvider` persists automatic and manual removal. `HistoryScreen` owns the quiet trash icon and confirmation dialog; `AppShell` supplies the provider action.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library, IndexedDB, lucide-react.

## Global Constraints

- Remove automatically only completed tasks with a non-null `completedAt` strictly older than 30 days.
- Preserve active and timestamp-less completed tasks.
- Use Ukrainian copy; use destructive red only for final confirmation.
- Follow test-first RED → GREEN for every production change.

---

### Task 1: Add a deterministic retention rule

**Files:**
- Create: `src/features/tasks/domain/historyRetention.ts`
- Create: `src/features/tasks/domain/historyRetention.test.ts`

**Interface:** `expiredCompletedTaskIds(tasks: Task[], now: Date): string[]`.

- [ ] **Step 1: Write the failing test**

Create a test using `now = 2026-07-22T12:00:00.000Z`; it expects only a completed task timestamped `2026-06-22T11:59:59.999Z` to be returned, while the exact 30-day boundary, an active task, and a completed task with `completedAt: null` are retained.

- [ ] **Step 2: Verify RED**

Run: `pnpm test src/features/tasks/domain/historyRetention.test.ts`

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement the minimal helper**

Export a `RETENTION_MS`-based function that filters `Task[]` by `status === "completed"`, a truthy `completedAt`, and `new Date(completedAt).getTime() < now.getTime() - RETENTION_MS`.

- [ ] **Step 4: Verify GREEN and commit**

Run: `pnpm test src/features/tasks/domain/historyRetention.test.ts`

Expected: PASS.

Commit: `git add src/features/tasks/domain/historyRetention.ts src/features/tasks/domain/historyRetention.test.ts && git commit -m "feat: expire old completed tasks"`.

### Task 2: Add provider cleanup actions

**Files:**
- Modify: `src/features/tasks/application/TaskProvider.tsx`
- Modify: `src/features/tasks/application/TaskProvider.test.tsx`

**Interfaces:**
- Consumes: `expiredCompletedTaskIds` and `TaskRepository.remove(id)`.
- Produces: `clearCompletedTasks(): Promise<void>` on `TaskContextValue`.

- [ ] **Step 1: Write the failing provider tests**

Add hydration coverage with one expired, one exact-boundary completed, and one active task; expect only the expired task to disappear from both provider state and the test repository. Add `clearCompletedTasks` coverage with one completed and one active task; expect only the completed task to disappear from state and repository.

- [ ] **Step 2: Verify RED**

Run: `pnpm test src/features/tasks/application/TaskProvider.test.tsx`

Expected: FAIL because expired history remains and `clearCompletedTasks` is absent.

- [ ] **Step 3: Implement persistence-safe removal**

After `repository.list()` resolves, calculate expired IDs and await `repository.remove(id)` for each. Exclude an item from the hydrated list only after its own removal succeeds; preserve it if deletion rejects. Record any successful delete as a pending mutation before hydration completes so a delayed load cannot re-add it. Implement `clearCompletedTasks` with the same successful-delete-only rule, deleting all current completed IDs without touching active tasks.

- [ ] **Step 4: Verify GREEN and commit**

Run: `pnpm test src/features/tasks/application/TaskProvider.test.tsx`

Expected: PASS.

Commit: `git add src/features/tasks/application/TaskProvider.tsx src/features/tasks/application/TaskProvider.test.tsx && git commit -m "feat: clear and retain task history"`.

### Task 3: Add the confirmation flow in History

**Files:**
- Modify: `src/components/tasks/HistoryScreen.tsx`
- Create: `src/components/tasks/HistoryScreen.test.tsx`
- Modify: `src/components/app-shell/AppShell.tsx`
- Modify: `src/components/app-shell/AppShell.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `onClear(): Promise<void>`.
- Produces: an `Очистити історію` icon button and identically labelled confirmation dialog.

- [ ] **Step 1: Write failing component tests**

Render History with a completed task. Test that clicking the accessible trash button opens a `role="dialog"` named `Очистити історію`; pressing `Скасувати` does not call `onClear`; pressing `Очистити` calls it; and the trash button is disabled if `tasks` contains no completed tasks.

- [ ] **Step 2: Verify RED**

Run: `pnpm test src/components/tasks/HistoryScreen.test.tsx`

Expected: FAIL because the callback, button, and dialog are absent.

- [ ] **Step 3: Implement UI and wiring**

Use `Trash2` from `lucide-react`. Replace the History header with three balanced columns: left `Назад`, centered `Історія`, and right muted icon-only trash control. Add a modal `role="dialog"`, `aria-modal="true"`, `aria-label="Очистити історію"`, exact warning copy, `Скасувати`, and final destructive `Очистити`. Await `onClear`, close only after it succeeds, and display a local `role="alert"` if it rejects. Pass `clearCompletedTasks` through `AppShell`.

- [ ] **Step 4: Add wiring coverage and verify GREEN**

Add an AppShell test that opens History, opens confirmation, confirms removal, and verifies the memory repository retains only the active task.

Run: `pnpm test src/components/tasks/HistoryScreen.test.tsx src/components/app-shell/AppShell.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the UI**

Commit: `git add src/components/tasks/HistoryScreen.tsx src/components/tasks/HistoryScreen.test.tsx src/components/app-shell/AppShell.tsx src/components/app-shell/AppShell.test.tsx src/app/globals.css && git commit -m "feat: add history clear confirmation"`.

### Task 4: Verify the feature end to end

**Files:**
- Verify: all files from Tasks 1–3.

- [ ] **Step 1: Run focused tests**

Run: `pnpm test src/features/tasks/domain/historyRetention.test.ts src/features/tasks/application/TaskProvider.test.tsx src/components/tasks/HistoryScreen.test.tsx src/components/app-shell/AppShell.test.tsx`

Expected: PASS with zero failures.

- [ ] **Step 2: Run static checks sequentially**

Run: `pnpm typecheck && pnpm lint && pnpm build`

Expected: all commands exit 0.

- [ ] **Step 3: Inspect final changes**

Run: `git diff --check HEAD~3..HEAD && git status --short`

Expected: no whitespace errors and no unrelated changes.
