# Direct voice task creation

## Goal

Remove the extra AI-preview confirmation step from voice capture. After the user stops recording and the transcript is parsed, NoteAI creates the returned tasks immediately.

## Experience

- The microphone flow remains on the capture screen after the user taps the recorder checkmark.
- While transcription, parsing, and saving are in progress, the existing processing state remains visible and duplicate submissions are prevented.
- Once saving succeeds, the capture screen replaces the recorder with a short-lived, staggered list of the created task cards. The cards communicate the parsed title, priority, and placement labels (Inbox, Today, or Upcoming) without offering inline editing.
- The same persisted task records update Inbox, Today, and Upcoming immediately according to their existing date rules. Editing continues to happen from those task lists.
- After the result animation, capture returns to its ready-to-record state. The user does not navigate away automatically.

## Data and error handling

- Use the existing parse response and `TaskProvider.addDrafts`; do not add a second parsing or saving path.
- Only clear the locally retained transcript after task persistence succeeds.
- If parsing or saving fails, create no tasks, retain the transcript/draft, and present the existing retryable error state.
- An unresolved parser clarification follows the current safe behavior: no task is silently created from an ambiguous interpretation.

## Scope

- This change applies to voice-first capture only. Typed capture retains its editable preview and explicit confirmation.
- `QuickPreview` stays available for typed capture but is not rendered in the voice-first flow.

## Verification

- Component tests prove voice capture persists parsed tasks without rendering `QuickPreview`, shows the creation result, and retains the existing failure behavior.
- Task-list tests prove the saved task objects are available through the normal provider update, so date-based lists receive them without special synchronization.
- Run the relevant Vitest files, then the full test suite, lint, type check, and production build.
