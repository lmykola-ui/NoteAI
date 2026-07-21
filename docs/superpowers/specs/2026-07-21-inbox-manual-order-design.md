# Inbox Manual Ordering

Date: 2026-07-21  
Status: Approved design

## Goal

Let a person arrange active tasks manually in **Вхідні**, even when their dates
and priorities differ. Manual ordering is personal Inbox organization; it does
not affect the chronological order in **Сьогодні** or **Заплановані**.

## Interaction

- A short tap on a task card keeps its existing edit behavior.
- A press held for 350 ms starts drag mode. The card lifts slightly and follows
  the pointer or finger vertically.
- While dragging, an animated insertion line appears between cards. It eases
  into its position and briefly contracts when the target position changes, so
  the destination is clear without visual noise.
- Releasing the card applies the new Inbox order. Cancelling the interaction
  leaves the prior order intact.
- Drag mode is pointer/touch based. Interactive controls inside a card (for
  example completion and priority) retain their existing direct actions.

## Data and persistence

- Add an optional numeric `inboxOrder` to `Task`.
- Existing tasks without this value fall back to creation order.
- Reordering updates only the affected active Inbox tasks and persists the new
  values through the existing repository.
- Completing or restoring a task does not reset its manual position.

## Scope boundaries

- The manual sort is used only by `InboxScreen`.
- `PlanScreen` continues to sort by the existing date/time rules.
- No priorities, due dates, task content, or server-side AI behavior change.

## Accessibility and motion

- The dragged card exposes an accessible dragging state; the insertion marker
  is decorative and hidden from assistive technology.
- Keyboard and screen-reader editing behavior is unchanged by this touch-first
  feature.
- Under reduced motion, card movement and marker transitions become immediate
  while the insertion destination stays visible.

## Verification

- Unit tests cover ordering active Inbox tasks by `inboxOrder` with the legacy
  creation-order fallback.
- Component tests cover short-tap editing, long-press drag start, visible
  insertion marker, dropping, and persisted reordering.
- Existing Inbox and Plan ordering tests remain green.
