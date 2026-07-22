# Today Completed History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the all-complete Today celebration with a compact completed-task row and move cleared completed tasks into History without deleting them.

**Architecture:** `PlanScreen` remains a presentational, Today-specific component: it decides when to show progress, the empty state, or the completed-task controls. `AppShell` converts clearing into existing `updateTask` calls, which persist completed tasks after removing their Today date and time; `HistoryScreen` already renders and restores completed tasks.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library.

## Global Constraints

- Keep the current active-task progress and emotion UI unchanged.
- When every scheduled Today task is completed, show no celebration, progress panel, or progress cat.
- The compact action row has `Показати виконані (N)` on the left and `Очистити` on the right.
- Clearing removes only `scheduledDate` and `scheduledTime` from completed tasks scheduled for the local Today date; it never deletes them or changes `status` and `completedAt`.
- The exact empty Today copy is `Запиши справи на сьогодні`.
- Inbox retains `Запиши зараз, сплануй потім` and its empty-state cat.

---

### Task 1: Specify the Today screen’s completed and empty states

**Files:**
- Modify: `src/components/tasks/PlanScreen.test.tsx`
- Modify: `src/components/tasks/PlanScreen.tsx`

**Interfaces:**
- Consumes: `Task[]`, local `today: string`, and the existing `TaskCard` handlers.
- Produces: optional `onClearCompleted(tasks: Task[]): void | Promise<void>` callback and the static `Показати виконані (N)` / `Очистити` controls.

- [ ] **Step 1: Write the failing completed-state tests**

Replace the celebration test with this test, retaining the existing `makeTask` factory:

```tsx
it("shows compact completed controls and clears only today's completed tasks", async () => {
  const user = userEvent.setup();
  const onClearCompleted = vi.fn();
  const tasks = [
    makeTask({ id: "one", scheduledDate: "2026-07-19", status: "completed" }),
    makeTask({ id: "two", scheduledDate: "2026-07-19", status: "completed" }),
  ];

  render(<PlanScreen tasks={tasks} today="2026-07-19" {...actions} onClearCompleted={onClearCompleted} />);

  expect(screen.queryByRole("heading", { name: "Вітаємо!" })).not.toBeInTheDocument();
  expect(screen.queryByText("100%")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Показати виконані (2)" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Очистити" })).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Показати виконані (2)" }));
  expect(screen.getByRole("list", { name: "Виконані задачі сьогодні" })).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Очистити" }));
  expect(onClearCompleted).toHaveBeenCalledWith(tasks);
});
```

Update the empty-state test assertion to:

```tsx
expect(screen.getByText("Запиши справи на сьогодні")).toBeVisible();
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `pnpm vitest run src/components/tasks/PlanScreen.test.tsx`

Expected: FAIL because the celebration is still rendered and `Очистити` does not exist.

- [ ] **Step 3: Implement the minimal Today state change**

In `PlanScreen.tsx`, add the optional callback to the props:

```ts
onClearCompleted?(tasks: Task[]): void | Promise<void>;
```

Remove the `Image` import, `progress === 100` cat selection, and the `today-celebration` branch. For an all-complete day, render the labelled task list only when `showCompleted` is true, followed by:

```tsx
<div className="today-completed-actions">
  <button type="button" className="today-completed-toggle" onClick={() => setRevealedDate((value) => value === today ? null : today)}>
    {showCompleted ? `Сховати виконані (${completedCount})` : `Показати виконані (${completedCount})`}
  </button>
  <button type="button" className="today-completed-toggle" onClick={() => void actions.onClearCompleted?.(selectedTasks)}>
    Очистити
  </button>
</div>
```

Keep the progress section only for `!allComplete`, and change the empty-state message to `Запиши справи на сьогодні`.

- [ ] **Step 4: Add the compact-row style**

In `src/app/globals.css`, add:

```css
.today-completed-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.today-completed-actions .today-completed-toggle { justify-self: auto; }
```

Remove the unused `.today-celebration`, `.today-celebration-cat`, and their keyframes. Remove those selectors from the reduced-motion rule.

- [ ] **Step 5: Run the targeted test to verify it passes**

Run: `pnpm vitest run src/components/tasks/PlanScreen.test.tsx`

Expected: PASS with the all-complete controls, reveal behaviour, and exact empty copy covered.

- [ ] **Step 6: Commit the tested screen change**

```bash
git add src/components/tasks/PlanScreen.tsx src/components/tasks/PlanScreen.test.tsx src/app/globals.css
git commit -m "fix: simplify completed Today state"
```

### Task 2: Clear Today tasks into History via the existing update path

**Files:**
- Modify: `src/components/app-shell/AppShell.tsx`
- Modify: `src/components/app-shell/AppShell.test.tsx`

**Interfaces:**
- Consumes: `PlanScreen`’s `onClearCompleted(tasks: Task[])` callback and `updateTask(task: Task)` from `useTasks`.
- Produces: completed records with `scheduledDate: null` and `scheduledTime: null`, which existing `HistoryScreen` can display and restore.

- [ ] **Step 1: Write the failing app-shell interaction test**

In `AppShell.test.tsx`, use the existing test provider/repository helper to add two completed tasks scheduled for the local Today date. Navigate to `Сьогодні`, then assert:

```tsx
await user.click(screen.getByRole("button", { name: "Очистити" }));

expect(screen.getByText("Запиши справи на сьогодні")).toBeVisible();
await user.click(screen.getByRole("button", { name: "Відкрити меню" }));
await user.click(screen.getByRole("menuitem", { name: "Історія" }));
expect(screen.getByText("Перша виконана")).toBeVisible();
expect(screen.getByText("Друга виконана")).toBeVisible();
```

- [ ] **Step 2: Run the app-shell test to verify it fails**

Run: `pnpm vitest run src/components/app-shell/AppShell.test.tsx`

Expected: FAIL because `PlanScreen` receives no clear callback and completed Today tasks stay scheduled.

- [ ] **Step 3: Implement the history-preserving clear callback**

In `AppShell.tsx`, pass this callback to `PlanScreen`:

```tsx
onClearCompleted={async (completedTasks) => {
  await Promise.all(
    completedTasks.map((task) => updateTask({
      ...task,
      scheduledDate: null,
      scheduledTime: null,
    })),
  );
}}
```

Do not call `deleteTask`, `restoreTask`, or `completeTask`; `updateTask` preserves the completed state and its timestamp while the existing History screen filters those records.

- [ ] **Step 4: Run the app-shell and Today component tests to verify they pass**

Run: `pnpm vitest run src/components/app-shell/AppShell.test.tsx src/components/tasks/PlanScreen.test.tsx`

Expected: PASS; clearing shows the Today empty cat and the two tasks remain visible in History.

- [ ] **Step 5: Commit the persistence wiring**

```bash
git add src/components/app-shell/AppShell.tsx src/components/app-shell/AppShell.test.tsx
git commit -m "fix: move cleared Today tasks to history"
```

### Task 3: Verify the complete interaction without regressions

**Files:**
- Verify: `src/components/tasks/InboxScreen.test.tsx`
- Verify: `src/components/tasks/PlanScreen.test.tsx`
- Verify: `src/components/app-shell/AppShell.test.tsx`
- Verify: `src/app/globals.css`

**Interfaces:**
- Consumes: the completed implementation from Tasks 1–2.
- Produces: evidence that Inbox keeps its cat, Today uses exact copy, and completed tasks remain restorable through History.

- [ ] **Step 1: Run the focused regression suite**

Run: `pnpm vitest run src/components/tasks/InboxScreen.test.tsx src/components/tasks/PlanScreen.test.tsx src/components/app-shell/AppShell.test.tsx`

Expected: PASS with no test failures.

- [ ] **Step 2: Run static validation**

Run: `pnpm lint && pnpm typecheck && git diff --check`

Expected: each command exits `0` and `git diff --check` prints no whitespace errors.

- [ ] **Step 3: Commit any verification-only corrections**

If a correction was required by the validation commands, commit only the correction:

```bash
git add <corrected-files>
git commit -m "fix: validate Today completed history flow"
```

