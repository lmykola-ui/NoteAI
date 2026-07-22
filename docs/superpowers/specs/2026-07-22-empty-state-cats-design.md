# Empty-state illustration for Inbox and Today

## Goal

Give empty Inbox and Today screens a calm, centered visual prompt using the supplied transparent cat PNG.

## Scope

- Keep the supplied `123235.png` unchanged and place a copy in the application public assets.
- Add one reusable `EmptyTaskState` component used only when a screen has no tasks to show.
- Inbox copy: `Запиши зараз, сплануй потім`.
- Today copy: `Що сьогодні тобі треба зробити?`
- Center the illustration and copy horizontally. Size it for a phone viewport while reserving space for the heading, add button, and bottom navigation.
- Keep the existing task lists and completed-today celebration unchanged.

## Accessibility

The decorative illustration has an empty alt attribute. The Ukrainian copy remains real text, readable by screen readers.

## Tests

- Inbox with no active tasks renders the illustration and Inbox copy.
- Today with no tasks scheduled for the selected date renders the illustration and Today copy.
- Each populated screen keeps its existing task content and does not render the empty-state copy.

## Out of scope

- No changes to task data, navigation, capture flow, or the Planned screen.
- No animation or edits to the PNG's transparency.
