# Today completed tasks and empty states

## Goal

Keep the Today screen calm after every scheduled task has been completed. Completed tasks remain available in History and can be restored; clearing them must never delete them.

## Behaviour

- If Today contains active tasks, retain the existing progress and emotion UI.
- If every Today task is completed, hide the celebration and progress UI. Render a compact two-action row instead:
  - left: `Показати виконані (N)` / `Сховати виконані (N)`;
  - right: `Очистити`.
- `Очистити` removes only the date and time from completed tasks that are scheduled for the current local day. It preserves their completed status and completion timestamp. Therefore they disappear from Today, appear in History, and History's existing restore action can make them active again.
- When no tasks remain scheduled for Today, render the shared cat empty state with exactly `Запиши справи на сьогодні`.
- Inbox continues to render the shared cat empty state with `Запиши зараз, сплануй потім`.

## Component boundaries

- `PlanScreen` owns the Today-specific action row and invokes an injected clear callback with the completed tasks for the selected day.
- `AppShell` maps that callback to `updateTask`, preserving the existing persistence, optimistic state, and History flow.
- `EmptyTaskState` remains presentation-only and accepts the screen-specific copy.

## Accessibility and interaction

- Both row actions are native buttons with explicit Ukrainian labels.
- The revealed completed tasks retain their labelled list.
- Clearing is immediate, as requested; it has no confirmation dialog and does not delete data.

## Tests

- Update Today tests to assert the compact row, reveal/hide behaviour, and absence of celebration/progress after completion.
- Add a test that clearing passes each completed Today task with its date and time removed.
- Update the empty Today copy assertion and retain the Inbox empty-state coverage.
