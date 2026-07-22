# Preserve Active Task Destination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Saving a manually created task closes its composer while retaining the currently open task destination.

**Architecture:** `AppShell` owns the active destination and the manual composer callback. The save callback will continue to persist the task and close the composer, but will no longer overwrite `destination`. UI regression tests will exercise saves from Today and Planned through the real composer.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library.

## Global Constraints

- Do not change task date parsing, filtering, or sorting.
- Do not change navigation labels, voice-capture behavior, or edit-save behavior.
- A task date affects list membership only; it must not redirect the current destination.

---

### Task 1: Preserve the current destination after a manual save

**Files:**
- Modify: `src/components/app-shell/AppShell.test.tsx`
- Modify: `src/components/app-shell/AppShell.tsx`

**Interfaces:**
- Consumes: `TaskComposer` calls `onCreate(draft)` after the person selects **Зберегти задачу**.
- Produces: `AppShell` preserves its existing `destination` state when `onCreate` resolves.

- [ ] **Step 1: Write the failing tests**

Add the following tests to `src/components/app-shell/AppShell.test.tsx`:

```tsx
it("keeps Today open after saving a task with a future date", async () => {
  const user = userEvent.setup();
  render(<TaskProvider repository={createMemoryTaskRepository()}><AppShell /></TaskProvider>);

  await user.click(screen.getByRole("button", { name: "Сьогодні" }));
  await user.click(screen.getByRole("button", { name: "Додати задачу" }));
  await user.type(screen.getByLabelText("Що потрібно зробити?"), "Запланувати дзвінок");
  await user.click(screen.getByRole("button", { name: "Сьогодні" }));
  await user.type(screen.getByLabelText("Вибрати дату"), "2026-07-23");
  await user.click(screen.getByRole("button", { name: "Зберегти задачу" }));

  expect(await screen.findByRole("heading", { name: "Сьогодні" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Сьогодні" })).toHaveAttribute("aria-current", "page");
});

it("keeps Planned open after saving a task", async () => {
  const user = userEvent.setup();
  render(<TaskProvider repository={createMemoryTaskRepository()}><AppShell /></TaskProvider>);

  await user.click(screen.getByRole("button", { name: "Заплановані" }));
  await user.click(screen.getByRole("button", { name: "Додати задачу" }));
  await user.type(screen.getByLabelText("Що потрібно зробити?"), "Забронювати зустріч");
  await user.click(screen.getByRole("button", { name: "Зберегти задачу" }));

  expect(await screen.findByRole("heading", { name: "Заплановані" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Заплановані" })).toHaveAttribute("aria-current", "page");
});
```

- [ ] **Step 2: Run the targeted test file to verify RED**

Run: `pnpm test src/components/app-shell/AppShell.test.tsx`

Expected: both new tests fail because the save callback sets `destination` to `"inbox"`.

- [ ] **Step 3: Implement the minimal change**

In `src/components/app-shell/AppShell.tsx`, replace the creation callback with:

```tsx
onCreate={async (draft) => {
  await addDrafts([draft]);
  requestPersistenceAfterFirstSave();
  setComposerOpen(false);
  setVoiceFirst(false);
}}
```

Do not change the `onUpdate` or `onStartVoice` callbacks.

- [ ] **Step 4: Run the targeted test file to verify GREEN**

Run: `pnpm test src/components/app-shell/AppShell.test.tsx`

Expected: exit code 0 and all tests in the file pass.

- [ ] **Step 5: Run regression checks**

Run: `pnpm test && pnpm lint && pnpm typecheck && pnpm build && pnpm scan:secrets && git diff --check`

Expected: every command exits 0.

- [ ] **Step 6: Commit the implementation**

```bash
git add src/components/app-shell/AppShell.tsx src/components/app-shell/AppShell.test.tsx docs/superpowers/plans/2026-07-22-preserve-active-destination.md
git commit -m "fix: preserve active task destination after save"
```
