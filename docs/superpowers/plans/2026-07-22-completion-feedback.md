# Completion Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Animate completion in Inbox and Upcoming, hide Today’s completed tasks by default, and center the mobile completion control.

**Architecture:** `TaskCard` owns the short completion phase. Inbox and Upcoming defer their existing completion callback until that phase ends. Today owns its completed-task visibility state and renders the list only after its reveal action.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library, CSS.

## Global Constraints

- Keep Today copy and cat artwork unchanged.
- Completion feedback lasts 360 ms.
- Leave persistence and the undo window in `AppShell.completeWithUndo`.
- Disable motion for `prefers-reduced-motion`; still complete and remove the task.
- Do not change Inbox dragging or task data.

---

### Task 1: Add the TaskCard completion lifecycle

**Files:**
- Modify: `src/components/tasks/TaskCard.tsx`
- Modify: `src/components/tasks/TaskCard.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces optional `onCompletionAnimationEnd(id)`.
- Calls it after 360 ms when an active task completes in a transient list.

- [ ] **Step 1: Write the failing test**

```tsx
it("shows completion feedback before notifying a transient list", async () => {
  vi.useFakeTimers();
  const onCompletionAnimationEnd = vi.fn();
  render(<TaskCard task={makeTask()} today="2026-07-22" onComplete={vi.fn()} onRestore={vi.fn()} onCompletionAnimationEnd={onCompletionAnimationEnd} />);
  await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole("button", { name: /Позначити.*виконаною/ }));
  expect(screen.getByRole("article")).toHaveClass("task-card--completing");
  act(() => vi.advanceTimersByTime(360));
  expect(onCompletionAnimationEnd).toHaveBeenCalledWith("task-1");
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/tasks/TaskCard.test.tsx`

Expected: FAIL because no transient completion lifecycle exists.

- [ ] **Step 3: Write minimal implementation**

```tsx
const [isCompleting, setIsCompleting] = useState(false);
if (task.status === "active" && onCompletionAnimationEnd) {
  setIsCompleting(true);
  window.setTimeout(() => onCompletionAnimationEnd(task.id), 360);
  return;
}
```

Add `task-card--completing` CSS for check, dim, strikethrough, and exit. Use a 24 px centered completion control in a fixed first column.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/components/tasks/TaskCard.test.tsx`

Expected: PASS with no failures.

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/TaskCard.tsx src/components/tasks/TaskCard.test.tsx src/app/globals.css
git commit -m "feat: animate task completion feedback"
```

### Task 2: Defer Inbox and Upcoming persistence until feedback ends

**Files:**
- Modify: `src/components/tasks/InboxScreen.tsx`
- Modify: `src/components/tasks/InboxScreen.test.tsx`
- Modify: `src/components/tasks/UpcomingScreen.tsx`
- Modify: `src/components/tasks/UpcomingScreen.test.tsx`

**Interfaces:**
- Consumes `TaskCard.onCompletionAnimationEnd(id)`.
- Calls each screen’s existing `onComplete(id)` once, after the 360 ms feedback phase.

- [ ] **Step 1: Write failing tests**

```tsx
expect(screen.getByRole("article", { name: task.title })).toHaveClass("task-card--completing");
expect(onComplete).not.toHaveBeenCalled();
act(() => vi.advanceTimersByTime(360));
expect(onComplete).toHaveBeenCalledWith(task.id);
```

Place this interaction once in Inbox tests and once in Upcoming tests with a task on the selected date.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/components/tasks/InboxScreen.test.tsx src/components/tasks/UpcomingScreen.test.tsx`

Expected: FAIL because each screen passes `onComplete` directly today.

- [ ] **Step 3: Write minimal implementation**

```tsx
<TaskCard task={task} today={today} {...actions} onComplete={() => undefined} onCompletionAnimationEnd={actions.onComplete} />
```

Keep normal restore behavior unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/components/tasks/InboxScreen.test.tsx src/components/tasks/UpcomingScreen.test.tsx`

Expected: PASS with no failures.

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/InboxScreen.tsx src/components/tasks/InboxScreen.test.tsx src/components/tasks/UpcomingScreen.tsx src/components/tasks/UpcomingScreen.test.tsx
git commit -m "feat: animate Inbox and Upcoming completions"
```

### Task 3: Make Today’s hidden state semantic and verify the mobile flow

**Files:**
- Modify: `src/components/tasks/PlanScreen.tsx`
- Modify: `src/components/tasks/PlanScreen.test.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/e2e/noteai-core.spec.ts` only if its current fixture path can cover the interaction.

**Interfaces:**
- Consumes `allComplete` and `showCompleted` in `PlanScreen`.
- Produces an initially absent completed list, rendered only after `Показати виконані` is pressed.

- [ ] **Step 1: Write the failing test**

```tsx
expect(screen.getByRole("button", { name: "Показати виконані (2)" })).toBeVisible();
expect(screen.queryByRole("list", { name: "Виконані задачі сьогодні" })).not.toBeInTheDocument();
await user.click(screen.getByRole("button", { name: "Показати виконані (2)" }));
expect(screen.getByRole("list", { name: "Виконані задачі сьогодні" })).toBeVisible();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/tasks/PlanScreen.test.tsx`

Expected: FAIL because CSS-only collapsing leaves the cards rendered.

- [ ] **Step 3: Write minimal implementation**

Render Today’s completed task list only when `showCompleted` is true after `allComplete`; add `role="list"` and the shown label. Preserve the existing reveal transition on the list container.

- [ ] **Step 4: Run verification**

Run: `pnpm test src/components/tasks/PlanScreen.test.tsx && pnpm test && pnpm typecheck && pnpm build`

Expected: every command exits 0.

- [ ] **Step 5: Verify phones and commit**

Run: `pnpm test:e2e`

Expected: both mobile projects pass. Inspect a mobile viewport for centered circles, Today’s initial hidden state, and the Inbox/Upcoming 360 ms exit.

```bash
git add src/components/tasks/PlanScreen.tsx src/components/tasks/PlanScreen.test.tsx src/app/globals.css tests/e2e/noteai-core.spec.ts
git commit -m "fix: hide completed tasks until requested"
```
