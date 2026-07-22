# Completion feedback outside Today — design

## Goal

Make completion feel consistent in **Вхідні** and **Заплановані**, while keeping the existing **Сьогодні** completion flow and making its collapsed completed-list state reliable on phones.

## Chosen behavior

- **Сьогодні:** keep the current celebration card, cat, and completed-task toggle. When every task for today is complete, the list starts hidden; `Показати виконані (N)` reveals it and changes to `Сховати виконані (N)`.
- **Вхідні:** completing an active task first shows the existing checked, dimmed, struck-through task card, then removes it from the active Inbox list.
- **Заплановані:** completing an active task first shows the same checked, dimmed, struck-through card, then removes it from the selected day agenda.
- The transient completed presentation lasts 360 ms. It must respect `prefers-reduced-motion`: no movement animation, but the task still completes and disappears without a delayed motion sequence.
- The completion control keeps its existing accessible name and restore behavior for completed cards that are deliberately revealed in Today or History.

## Component boundaries

- `TaskCard` owns the local, short-lived visual completion phase and notifies a parent after it finishes.
- `InboxScreen` and `UpcomingScreen` keep their current active-task filtering; the parent state update after the visual phase removes the task naturally from each list.
- `PlanScreen` owns only Today’s explicit show/hide state and must render completed cards only when that state is enabled.
- CSS owns timing, checkmark reveal, struck-through/dimmed presentation, exit transition, and the fixed completion-control layout.

## Mobile visual rules

- The completion button has a fixed 24 by 24 px tap target in a fixed-width first grid column.
- Its circle and check icon are centered with `place-items: center`; it aligns to the first text line without an arbitrary side offset.
- The card’s content and priority column do not shift during the completion phase.

## Verification

- Component tests prove Inbox and Upcoming invoke completion only after their visual phase and that Today starts with completed tasks hidden until its button is pressed.
- Component tests assert the completion-control sizing/alignment class contract and reduced-motion-safe class behavior where feasible.
- A mobile viewport browser check verifies: Today’s initial collapsed state, Inbox disappearance, Upcoming disappearance, and centered check controls.

## Scope limits

- No task data schema changes.
- No changes to Today’s copy, cat artwork, navigation, undo window, History, or drag-and-drop behavior.
