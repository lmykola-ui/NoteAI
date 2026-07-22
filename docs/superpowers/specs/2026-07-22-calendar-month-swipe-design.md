# Calendar month swipe design

## Goal

Replace the expanded calendar's month-arrow controls with direct horizontal swipes on the calendar grid.

## Interaction

- The month header no longer renders previous/next arrow buttons.
- In the expanded calendar only, a leftward horizontal swipe on the day grid opens the next month; a rightward horizontal swipe opens the previous month. This matches the standard paged-calendar direction.
- A swipe is recognised only when the horizontal distance is at least 48 px and greater than the vertical distance. This keeps taps on days intact and ignores vertical movement in the grid.
- The collapsed weekly calendar, the expand handle, the return-to-today control, date selection, agenda, and task actions remain unchanged.

## Implementation

`UpcomingScreen` records pointer coordinates on the expanded day-grid wrapper and calls the existing month-shift state transition after a qualifying pointer release. `touch-action: pan-y` permits normal page-level vertical panning while retaining horizontal pointer data for month navigation. No gesture library or new dependency is added.

## Verification

Component tests dispatch pointer start/end events to prove left and right swipes change the month, short and vertical movements do not, and the arrow buttons are absent. The full test suite and production build provide regression coverage.
