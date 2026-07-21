# Today completion celebration

## Goal

Bring the approved Today prototype into the live mobile UI: a task-derived percentage and cat state, clear completed-card styling, a completion celebration, and a compact way to reveal completed cards after the celebration.

## Behaviour

- Use every task scheduled for the currently selected local day, including completed tasks, as the denominator.
- Percentage is `completed / total * 100`; no scheduled tasks keep the existing empty state.
- Cat states follow the approved ranges: 0–25, 26–50, 51–99, and 100.
- At 100%, show the congratulation panel with one supporting sentence, collapse task cards, and offer a "Показати виконані (N)" control.
- The view is derived from `today` and task data, so a new local day naturally starts from that day’s scheduled tasks; no manual reset is stored.

## Implementation plan

1. Extend PlanScreen tests for percentage, completion state, collapse/reveal behavior, and date-scoped task selection; run the focused tests and observe failure.
2. Add the four supplied cat assets to the application public directory.
3. Build the Today status and completion panel in PlanScreen, calculating all state from scheduled task records and resetting the reveal control when the day changes.
4. Update TaskCard markup and styles for a visible checkmark, dimmed completed card, and struck-through title.
5. Add responsive, reduced-motion-safe CSS for the fill, cat micro-animation, celebration, and collapse transition.
6. Run focused tests, then the full quality and production-build checks before handing the change off for deployment.
