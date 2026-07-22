# History retention and clearing

## Goal

Keep completed-task history useful without letting it grow indefinitely. Completed tasks expire after 30 days, while the user can deliberately clear the full history whenever needed.

## Behaviour

- A task is eligible for automatic removal only when it has `status: "completed"`, a non-null `completedAt`, and that timestamp is more than 30 calendar days old.
- Retention runs when the local task store is loaded. Eligible tasks are removed from persistent storage and from the in-memory list.
- Active tasks and completed tasks without a reliable completion timestamp are never automatically removed.
- History continues to show all retained completed tasks and lets the user restore an individual task.
- Manual clearing removes every completed task from History, regardless of completion date. It does not affect active tasks.

## History UI

- The heading is a three-part bar: a left `Назад` navigation control, centered `Історія` title, and a right trash icon button.
- The trash icon uses the existing quiet secondary-control styling rather than a permanent destructive red treatment. It is disabled when History is empty and has the accessible name `Очистити історію`.
- Pressing the icon opens a native accessible confirmation dialog: `Видалити всі завершені задачі з історії? Цю дію не можна скасувати.`
- The dialog provides `Скасувати` and a destructive `Очистити` action. Only `Очистити` performs deletion; closing or cancelling preserves history.

## Component boundaries

- A pure retention helper identifies expired completed task IDs from a supplied timestamp, keeping the 30-day rule deterministic and independently testable.
- `TaskProvider` runs the helper after repository hydration, removes expired tasks through the repository, and exposes a `clearCompletedTasks` action for the manual flow.
- `AppShell` wires the manual action into History without making persistence decisions.
- `HistoryScreen` owns the header layout and confirmation-dialog state; it receives an injected clear callback.

## Error handling

- If automatic retention cannot delete an eligible task, keep it visible and leave the rest of the loaded task list intact; do not hide data that was not persistently removed.
- If manual deletion fails, keep the dialog open and show a concise local error rather than claiming the history was cleared.

## Tests

- Unit-test the retention boundary: 30 days old is retained; older completed tasks are selected; active and timestamp-less completed tasks are retained.
- Add provider coverage that automatic cleanup removes only eligible persisted tasks after hydration and that manual clearing removes only completed tasks.
- Add History UI coverage for the disabled empty-state trash control, dialog cancellation, and confirmed clearing callback.
