# Calendar Month Swipe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users swipe horizontally across an expanded calendar to change months, replacing month-arrow controls.

**Architecture:** Keep selection state in `UpcomingScreen`. Attach pointer handling only to the expanded calendar day grid, compare release displacement with a 48 px horizontal threshold, and reuse `shiftMonth` for state updates. Use CSS `touch-action: pan-y` so the gesture does not capture vertical page panning.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, CSS.

## Global Constraints

- Do not add dependencies.
- Swipe navigation is available only when the calendar is expanded.
- A qualified swipe must have horizontal displacement of at least 48 px and larger than its vertical displacement.
- A leftward swipe opens the next month; a rightward swipe opens the previous month.
- Remove previous/next month arrow controls.
- Preserve day taps, return-to-today, expand/collapse, agenda, and task behavior.

---

### Task 1: Cover and implement month swipe navigation

**Files:**
- Modify: `src/components/tasks/UpcomingScreen.test.tsx`
- Modify: `src/components/tasks/UpcomingScreen.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `shiftMonth(delta: number): void` in `UpcomingScreen`.
- Produces: expanded calendar day grid with pointer-event handlers that select the appropriate adjacent month.

- [ ] **Step 1: Write the failing tests**

Add a helper that dispatches `pointerdown` and `pointerup` to the expanded calendar day grid. Assert a leftward swipe changes `Липень 2026` to `Серпень 2026`, a rightward swipe changes it to `Червень 2026`, and no controls named `Попередній місяць` or `Наступний місяць` are rendered. Add a short-movement assertion that keeps `Липень 2026` visible.

- [ ] **Step 2: Run the component test to verify it fails**

Run: `pnpm vitest run src/components/tasks/UpcomingScreen.test.tsx`

Expected: FAIL because the calendar grid has no pointer gesture behavior and the arrow controls remain.

- [ ] **Step 3: Write the minimal implementation**

In `UpcomingScreen.tsx`, store pointer-down coordinates in a ref. On pointer release, compute `horizontal = clientX - startX` and `vertical = clientY - startY`; when `Math.abs(horizontal) >= 48` and `Math.abs(horizontal) > Math.abs(vertical)`, call `shiftMonth(horizontal < 0 ? 1 : -1)`. Reset the ref after release or cancellation. Render arrow buttons nowhere. Add `calendar-days--swipeable` to the expanded day grid and set its CSS `touch-action: pan-y`.

- [ ] **Step 4: Run the component test to verify it passes**

Run: `pnpm vitest run src/components/tasks/UpcomingScreen.test.tsx`

Expected: PASS with all `UpcomingScreen` tests green.

- [ ] **Step 5: Run regression checks**

Run: `pnpm test && pnpm build`

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/components/tasks/UpcomingScreen.tsx src/components/tasks/UpcomingScreen.test.tsx src/app/globals.css docs/superpowers/specs/2026-07-22-calendar-month-swipe-design.md docs/superpowers/plans/2026-07-22-calendar-month-swipe.md
git commit -m "feat: swipe between calendar months"
```
