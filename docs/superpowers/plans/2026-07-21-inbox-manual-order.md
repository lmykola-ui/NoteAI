# Inbox Manual Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable long-press drag reordering of active Inbox tasks without changing short-tap editing or date-based task views.

**Architecture:** Persist a nullable `inboxOrder` scalar on the existing local Task entity. `TaskProvider` exposes a batched reorder mutation. `InboxScreen` owns the touch/pointer interaction and transient insertion target; `TaskCard` remains the short-tap edit control and gets no competing drag listener.

**Tech Stack:** Next.js, React 19, TypeScript, IndexedDB, Vitest, Testing Library.

## Global Constraints

- A card short tap opens its existing editor.
- A 350 ms press starts dragging only in the active Inbox list.
- The target marker is decorative, visible between cards, and follows a reduced-motion fallback.
- Inbox ordering ignores due date and priority; Today and Planned views keep existing ordering.
- Existing persisted tasks without `inboxOrder` sort by `createdAt`.

---

### Task 1: Persist a dedicated Inbox position

**Files:**
- Modify: `src/features/tasks/domain/task.ts`
- Modify: `src/features/tasks/application/TaskProvider.tsx`
- Modify: `src/features/tasks/application/TaskProvider.test.tsx`

**Interfaces:**
- Produces `Task.inboxOrder: number | null` and `useTasks().reorderInboxTasks(ids: string[]): Promise<void>`.
- Consumes the existing `TaskRepository.saveMany(tasks)` atomic local write.

- [ ] **Step 1: Write failing provider coverage**

```tsx
it("persists an Inbox-only order without changing task fields", async () => {
  const tasks = [makeTask({ id: "one", inboxOrder: 0 }), makeTask({ id: "two", inboxOrder: 1 })];
  const repository = createMemoryTaskRepository(tasks);
  const { result } = renderHook(() => useTasks(), { wrapper: provider(repository) });
  await waitFor(() => expect(result.current.loading).toBe(false));

  await act(() => result.current.reorderInboxTasks(["two", "one"]));

  expect(repository.saveMany).toHaveBeenLastCalledWith(expect.arrayContaining([
    expect.objectContaining({ id: "two", inboxOrder: 0 }),
    expect.objectContaining({ id: "one", inboxOrder: 1 }),
  ]));
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test -- src/features/tasks/application/TaskProvider.test.tsx`  
Expected: FAIL because `reorderInboxTasks` and `inboxOrder` do not exist.

- [ ] **Step 3: Implement the minimal domain and provider mutation**

```ts
type Task = {
  // existing fields
  inboxOrder: number | null;
};

async function reorderInboxTasks(ids: string[]) {
  const idSet = new Set(ids);
  const reordered = tasks
    .filter((task) => idSet.has(task.id))
    .map((task) => ({ ...task, inboxOrder: ids.indexOf(task.id), updatedAt: new Date().toISOString() }));
  await repository.saveMany(reordered);
  setTasks((current) => current.map((task) => reordered.find((item) => item.id === task.id) ?? task));
}
```

- [ ] **Step 4: Verify GREEN and commit**

Run: `pnpm test -- src/features/tasks/application/TaskProvider.test.tsx`  
Expected: PASS.

Commit: `git add src/features/tasks/domain/task.ts src/features/tasks/application/TaskProvider.tsx src/features/tasks/application/TaskProvider.test.tsx && git commit -m "feat: persist Inbox task order"`

### Task 2: Add long-press drag and an insertion marker

**Files:**
- Modify: `src/components/tasks/InboxScreen.tsx`
- Modify: `src/components/tasks/InboxScreen.test.tsx`
- Modify: `src/components/app-shell/AppShell.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes `onReorder(ids: string[]): Promise<void>` from `AppShell`.
- Produces a visual `.inbox-drop-marker` and pointer-only drag behavior in Inbox.

- [ ] **Step 1: Write failing Inbox behavior tests**

```tsx
it("keeps a short card tap for editing", async () => {
  const onEdit = vi.fn();
  render(<InboxScreen tasks={[first]} today="2026-07-21" {...actions} onEdit={onEdit} onReorder={vi.fn()} />);
  await userEvent.setup().click(screen.getByRole("button", { name: `Редагувати «${first.title}»` }));
  expect(onEdit).toHaveBeenCalledWith(first);
});

it("shows an insertion marker after a long press and reorders on drop", () => {
  const onReorder = vi.fn();
  render(<InboxScreen tasks={[first, second]} today="2026-07-21" {...actions} onReorder={onReorder} />);
  const firstCard = screen.getByLabelText(first.title);
  fireEvent.pointerDown(firstCard, { pointerId: 1, clientY: 40 });
  vi.advanceTimersByTime(350);
  fireEvent.pointerMove(firstCard, { pointerId: 1, clientY: 180 });
  expect(screen.getByTestId("inbox-drop-marker")).toBeVisible();
  fireEvent.pointerUp(firstCard, { pointerId: 1, clientY: 180 });
  expect(onReorder).toHaveBeenCalledWith([second.id, first.id]);
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test -- src/components/tasks/InboxScreen.test.tsx`  
Expected: FAIL because the `onReorder` prop, drag state, and marker do not exist.

- [ ] **Step 3: Implement the focused interaction**

```tsx
const LONG_PRESS_MS = 350;
// On pointer down, begin a timer. After it fires, set draggingTaskId.
// On pointer move while dragging, compare clientY to card midpoints and set insertionIndex.
// On pointer up, move that id to insertionIndex and call onReorder(ids).
// Clear the timer on pointer up/cancel/leave before dragging begins.
```

Render `<div className="inbox-drop-marker" data-testid="inbox-drop-marker" aria-hidden="true" />` immediately before the active insertion index. Pass `reorderInboxTasks` from `AppShell` to `InboxScreen`.

- [ ] **Step 4: Add visual behavior**

```css
.inbox-drop-marker { height: 3px; margin: -5px 14px; border-radius: 999px; background: #eef0ec; animation: inbox-marker-in 180ms cubic-bezier(.22, 1, .36, 1); }
.task-card--dragging { opacity: .7; transform: scale(.985); box-shadow: 0 16px 28px #0008; }
@keyframes inbox-marker-in { from { transform: scaleX(.55); opacity: .3; } to { transform: scaleX(1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .inbox-drop-marker, .task-card--dragging { animation: none; transition: none; } }
```

- [ ] **Step 5: Verify GREEN and commit**

Run: `pnpm test -- src/components/tasks/InboxScreen.test.tsx src/features/tasks/application/TaskProvider.test.tsx`  
Expected: PASS.

Commit: `git add src/components/tasks/InboxScreen.tsx src/components/tasks/InboxScreen.test.tsx src/components/app-shell/AppShell.tsx src/app/globals.css && git commit -m "feat: reorder Inbox tasks by long press"`

### Task 3: Run focused regression verification

**Files:** No production changes expected.

- [ ] **Step 1: Verify Inbox and date-based screens**

Run: `pnpm test -- src/components/tasks/InboxScreen.test.tsx src/components/tasks/PlanScreen.test.tsx src/components/tasks/UpcomingScreen.test.tsx src/components/tasks/TaskCard.test.tsx`

Expected: PASS; date-based views are not changed by Inbox ordering.

- [ ] **Step 2: Verify quality checks**

Run: `pnpm lint && pnpm typecheck && pnpm build`

Expected: PASS.
