# Empty Task States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the supplied transparent cat illustration and context-specific Ukrainian copy whenever Inbox or Today has no tasks.

**Architecture:** Add a small presentational `EmptyTaskState` component that owns the decorative image and copy. Inbox and Today select their copy and render this component only in their existing empty branches; shared CSS centers it in the remaining phone viewport without affecting populated task lists.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library, CSS.

## Global Constraints

- Copy the supplied `123235.png` without changing it; it already has transparency.
- Inbox copy must be exactly `Запиши зараз, сплануй потім`.
- Today copy must be exactly `Що сьогодні тобі треба зробити?`.
- Center the illustration and text horizontally; reserve space for the heading, floating add button, and bottom navigation.
- The illustration is decorative (`alt=""`); the visible copy remains accessible text.
- Do not change task data, navigation, capture flow, Planned, or the completed-Today celebration.

---

### Task 1: Add the reusable empty-state component and its regression test

**Files:**
- Create: `src/components/tasks/EmptyTaskState.tsx`
- Create: `src/components/tasks/EmptyTaskState.test.tsx`
- Create: `public/empty-task-state-cat.png`

**Interfaces:**
- Consumes: a required `message: string` prop.
- Produces: `EmptyTaskState({ message }: { message: string })`, rendering `/empty-task-state-cat.png`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { EmptyTaskState } from "./EmptyTaskState";

it("renders the decorative illustration and its message", () => {
  render(<EmptyTaskState message="Запиши зараз, сплануй потім" />);
  expect(screen.getByRole("img", { hidden: true })).toHaveAttribute("src", expect.stringContaining("/empty-task-state-cat.png"));
  expect(screen.getByText("Запиши зараз, сплануй потім")).toBeVisible();
});
```

- [ ] **Step 2: Verify RED**

Run: `PATH=/Users/nick/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/vitest run src/components/tasks/EmptyTaskState.test.tsx`

Expected: FAIL because `./EmptyTaskState` does not exist.

- [ ] **Step 3: Write the minimal component and copy the asset**

```tsx
import Image from "next/image";

export function EmptyTaskState({ message }: { message: string }) {
  return <div className="empty-task-state"><Image src="/empty-task-state-cat.png" alt="" width={1254} height={1254} priority /><p>{message}</p></div>;
}
```

Copy `/Users/nick/Downloads/123235.png` to `public/empty-task-state-cat.png` without resizing or conversion.

- [ ] **Step 4: Verify GREEN**

Run: `PATH=/Users/nick/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/vitest run src/components/tasks/EmptyTaskState.test.tsx`

Expected: PASS with one test.

- [ ] **Step 5: Commit**

```bash
git add public/empty-task-state-cat.png src/components/tasks/EmptyTaskState.tsx src/components/tasks/EmptyTaskState.test.tsx
git commit -m "feat: add empty task state illustration"
```

### Task 2: Use the state in Inbox and Today

**Files:**
- Modify: `src/components/tasks/InboxScreen.tsx`
- Modify: `src/components/tasks/InboxScreen.test.tsx`
- Modify: `src/components/tasks/PlanScreen.tsx`
- Modify: `src/components/tasks/PlanScreen.test.tsx`

**Interfaces:**
- Consumes: `EmptyTaskState` from `./EmptyTaskState`.
- Produces: empty Inbox and Today UIs with required copy, while populated views remain unchanged.

- [ ] **Step 1: Write the failing tests**

```tsx
it("shows the empty Inbox prompt", () => {
  render(<InboxScreen tasks={[]} today="2026-07-19" {...actions} />);
  expect(screen.getByText("Запиши зараз, сплануй потім")).toBeVisible();
});
```

```tsx
it("shows the empty Today prompt", () => {
  render(<PlanScreen tasks={[]} today="2026-07-19" {...actions} />);
  expect(screen.getByText("Що сьогодні тобі треба зробити?")).toBeVisible();
});
```

- [ ] **Step 2: Verify RED**

Run: `PATH=/Users/nick/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/vitest run src/components/tasks/InboxScreen.test.tsx src/components/tasks/PlanScreen.test.tsx`

Expected: FAIL because neither required copy string exists.

- [ ] **Step 3: Replace only each existing empty paragraph**

```tsx
// InboxScreen.tsx
import { EmptyTaskState } from "./EmptyTaskState";
// ...
<EmptyTaskState message="Запиши зараз, сплануй потім" />
```

```tsx
// PlanScreen.tsx
import { EmptyTaskState } from "./EmptyTaskState";
// ...
<EmptyTaskState message="Що сьогодні тобі треба зробити?" />
```

- [ ] **Step 4: Verify GREEN**

Run: `PATH=/Users/nick/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/vitest run src/components/tasks/InboxScreen.test.tsx src/components/tasks/PlanScreen.test.tsx`

Expected: PASS with all tests in both files.

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/InboxScreen.tsx src/components/tasks/InboxScreen.test.tsx src/components/tasks/PlanScreen.tsx src/components/tasks/PlanScreen.test.tsx
git commit -m "feat: show cat empty states for task screens"
```

### Task 3: Add the centered mobile layout and verify it

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: the `.empty-task-state` wrapper from Task 1.
- Produces: a centered responsive layout that does not change `.task-list` or navigation styles.

- [ ] **Step 1: Add the minimal CSS**

```css
.empty-task-state { display: grid; min-height: calc(100dvh - 270px); align-content: center; justify-items: center; gap: 8px; text-align: center; }
.empty-task-state img { width: min(78vw, 310px); height: auto; }
.empty-task-state p { max-width: 250px; margin: 0; color: var(--color-muted); font-size: 1rem; font-weight: 600; line-height: 1.4; }
```

- [ ] **Step 2: Run focused tests**

Run: `PATH=/Users/nick/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/vitest run src/components/tasks/EmptyTaskState.test.tsx src/components/tasks/InboxScreen.test.tsx src/components/tasks/PlanScreen.test.tsx`

Expected: PASS with all tests in the three files.

- [ ] **Step 3: Run static verification**

Run: `PATH=/Users/nick/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/tsc --noEmit && PATH=/Users/nick/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/eslint src/components/tasks/EmptyTaskState.tsx src/components/tasks/InboxScreen.tsx src/components/tasks/PlanScreen.tsx src/app/globals.css && git diff --check`

Expected: all commands exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "style: center empty task states"
```
