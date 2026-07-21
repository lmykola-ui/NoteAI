# NoteAI Inbox-First Mobile Flow

Date: 2026-07-21  
Status: Approved for implementation

## Goal

Make **Вхідні** the default NoteAI destination and provide a compact mobile task flow: browse active tasks, add one manually or by voice, review extracted tasks before saving, then complete, undo, or restore them.

## Visual system

- Mobile-first at 320–430 px; all core controls have a minimum 44 px target.
- Use the existing graphite system: `#0B0E0F` background, `#171B1F` cards, `#30363C` borders, `#F2F3EF` primary controls and text, `#92989E` muted text.
- No decorative gradients or reference-app styling. Use compact outlined icons and rounded graphite surfaces.
- The bottom navigation is a fixed, centered rounded panel with a card-like border. It stays above the safe area; list content has bottom padding so it never sits beneath the panel.
- The current tab is signalled by a subtly elevated graphite cell and brighter icon/text. Do not use an indicator dot.

## Navigation

The fixed bottom navigation has exactly three Ukrainian destinations:

1. **Вхідні** — default screen. One active-task list. Do not group it into date sections; show date/time in task metadata (`Сьогодні · 11:00`, `Завтра · 10:00`, `Без терміну`).
2. **Сьогодні** — only active tasks whose scheduled date equals the local current day, ordered by time then creation order.
3. **Заплановані** — active dated tasks grouped by upcoming calendar date, including today and future dates.

Each screen has an upper-right `⋯` control. It opens **Історію**, which lists all completed tasks and offers restoration.

## Task cards and priority

- A card has a completion button, title, date/time metadata, and a priority chevron on the right.
- No priority: neutral grey chevron and grey completion control.
- **Висока**: red upward chevron (`#EF6B65`).
- **Середня**: yellow chevron (`#E6A650`).
- **Мінімальна**: light-blue downward chevron (`#76A7FF`).
- The priority chooser uses these Ukrainian labels plus **Без пріоритету**. It uses the chevrons as the primary signal; color is supporting only.

Completing a task removes it from its active view and presents a transient **Виконано · Скасувати** action. Undo restores it immediately. The History screen is the durable path to restore any completed task.

## Add-task flow

The centered `+` is fixed directly above the navigation panel. It opens a bottom overlay sheet above the current screen, without navigating away.

Initial composer state:

- text field labelled **Що потрібно зробити?**;
- helper copy **Введіть задачу або продиктуйте її**;
- date chooser initially **Сьогодні**, with `Сьогодні`, `Завтра`, and `Вибрати дату` options;
- a separate time picker;
- the Ukrainian priority chooser described above;
- target context **Вхідні**;
- the existing NoteAI microphone icon.

Manual entry saves a single task using the selected fields. Tapping the microphone transitions the sheet to a recording state: bottom controls are Stop, responsive audio waveform, and Confirm. The waveform uses the existing real audio-level mechanism rather than a fake animation. Transcription/analysis uses the existing client and API flow.

After a successful AI analysis, display a full-screen **Перевірка** preview. Every extracted task is editable before confirmation. If language mentions a relative day or a time, the preview preselects the corresponding date and time. Confirm saves all accepted drafts and returns to **Вхідні**.

## Persistence and errors

- Reuse existing IndexedDB task storage and TaskProvider mutations. No schema migration is required: date, time, priority, status, and completion timestamp already exist.
- Preserve an unsaved composer draft in the existing draft storage when the sheet is dismissed or analysis fails.
- If microphone permission, transcription, parsing, or storage fails, keep editable text and selected metadata; show a concise Ukrainian recovery message.
- Existing offline rules remain: local task browsing and editing work offline; voice transcription and AI parsing require a connection.

## Accessibility and verification

- Icon controls get Ukrainian accessible names and visible keyboard focus.
- Bottom sheet uses dialog semantics and Escape/backdrop dismissal without losing a draft.
- Respect reduced motion; waveform bars are hidden from the accessibility tree.
- Add unit and component coverage for default destination, filters, priority labels/mapping, completion undo/history, composer controls, and preview-to-save flow.
- Run the existing Vitest suite, lint, TypeScript/build checks, and relevant Playwright mobile tests.
