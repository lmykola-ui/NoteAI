# NoteAI Card-System Redesign

Date: 2026-07-20
Status: Approved design

## 1. Goal

Redesign the existing working NoteAI mobile web application without changing its core promise:

> Сказав або написав думку -> перевірив текст -> AI розібрав -> отримав список задач.

The redesign borrows the clear card hierarchy and compact period control from the Wellness reference, but uses a restrained graphite theme inspired by ChatGPT and Codex rather than the reference's purple and yellow palette.

The product remains simple. The redesign does not add projects, tags, calendars, reminders, month planning, accounts, or other planner functionality.

## 2. Product Decisions

- The application still opens on **Capture**, not on the task list.
- Voice recording is the primary action; manual text input remains available.
- The waveform is visible only while audio is actively recording.
- After recording, the transcript replaces the recording surface and remains editable before analysis.
- The task screen replaces the current horizontal seven-date strip with a compact period control in the top-right corner.
- The supported periods are **Сьогодні** and **Тиждень**. **Місяць** is deferred and must not appear as an enabled production option.
- Bottom navigation remains Capture, Tasks, and Inbox, but uses icons without visible text.
- Priority is communicated visually on task cards without a visible `Пріоритет` label.
- The three-step capture concept is reserved for optional onboarding. It is not the everyday capture flow.

## 3. Visual System

### Palette

Use near-neutral graphite surfaces with color reserved for state and priority:

| Token | Value | Purpose |
| --- | --- | --- |
| `--bg` | `#0B0E0F` | application background |
| `--surface` | `#171B1F` | cards and inputs |
| `--surface-elevated` | `#1D2125` | bottom navigation and menus |
| `--border` | `#30363C` | subtle component boundaries |
| `--text` | `#F2F3EF` | primary text |
| `--muted` | `#92989E` | secondary text |
| `--action` | `#EEF0EC` | primary neutral action |
| `--danger` | `#EF6B65` | high priority and destructive state |
| `--warning` | `#E6A650` | medium priority |
| `--info` | `#6F98F0` | default priority and focus accent |

The interface must not use gradients as decoration. Shadows stay subtle and are used only to separate elevated menus or the fixed navigation from content.

### Typography

Use a license-free, dependency-free system stack:

```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Primary headings use strong weight and tight spacing. Supporting text is smaller and quieter but must retain WCAG AA contrast. Avoid uppercase labels except for very short contextual metadata.

### Shape and spacing

- Screen side padding: 18-20 px.
- Card radius: 20-28 px depending on card size.
- Control radius: 14-18 px.
- Bottom navigation radius: 22 px.
- Minimum interactive target: 44 x 44 px.
- Use an 8 px spacing rhythm.

### Motion

Use one restrained motion system throughout the application. Animation supports orientation and state recognition; it is never decorative.

- Standard duration: 160-200 ms.
- Small controls and menus: 120-160 ms.
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` for entrances and `ease-in` for exits.
- Screen changes: 8 px vertical movement plus opacity.
- Recorder state changes: soft opacity/scale transition between idle, recording, transcribing, and transcript surfaces.
- Period menu: anchored fade and scale from the top-right trigger.
- Today/Week change: heading crossfade followed by a light card entrance; no large horizontal slide.
- Task cards: subtle entrance and completion feedback without bouncing or long stagger sequences.
- Buttons: 80-120 ms press response using a maximum scale of `0.98`.
- The waveform is the only continuous animation and reflects actual audio amplitude.

Under `prefers-reduced-motion: reduce`, remove movement and scaling, shorten fades to near-instant transitions, and keep all state changes understandable without animation.

## 4. Capture Flow

### Idle state

The idle screen deliberately avoids a large title or framed introduction.

Visible elements, top to bottom:

1. Minimal status/header area.
2. Quiet centered helper copy: `Скажіть усе як є. Решту впорядкуємо.`
3. Large neutral microphone button.
4. Short instruction: `Натисніть, щоб почати запис`.
5. Compact manual-text entry trigger above bottom navigation.
6. Solid icon-only bottom navigation.

No waveform is shown before recording begins.

### Requesting microphone access

- Keep the microphone action in place.
- Replace its icon with a restrained progress indicator.
- Show `Відкриваємо мікрофон…` as status text.
- Do not shift the rest of the layout.

### Recording state

The idle content is replaced by one large recording card containing:

- red live indicator and `Запис`;
- elapsed timer;
- responsive audio waveform;
- large neutral `Зупинити` action.

The waveform is driven by real microphone amplitude through the Web Audio API. Silence produces low dots/short bars; louder speech produces taller bars. Motion must be smoothed to avoid jitter and respect `prefers-reduced-motion` by using slower, lower-amplitude transitions.

The existing 59-second automatic stop remains unchanged.

### Transcript state

After recording and transcription:

- the recording card becomes an editable transcript card;
- the transcript text is focused only when the user explicitly taps it;
- a primary `Проаналізувати` action with a forward icon appears below the text;
- a secondary re-record action is available without deleting text unexpectedly;
- the draft continues to persist locally under the existing rules.

### Analysis and preview

- `Проаналізувати` changes to a non-blocking loading state.
- Parsing errors preserve the transcript and present a retry action.
- Successful parsing opens the existing editable Quick Preview, visually restyled with the same card system.
- No task is saved before the existing confirmation step.

## 5. Bottom Navigation

The bottom navigation is a solid elevated surface, never translucent.

Destinations:

1. audio-lines icon: Capture;
2. check-list icon: Tasks;
3. inbox icon: Inbox.

Rules:

- No visible text labels.
- Every button has a Ukrainian accessible name.
- The active destination uses brighter icon color plus a small neutral indicator dot, so selection is not communicated by color alone.
- Navigation respects the bottom safe-area inset.
- Content receives enough bottom padding that the navigation never overlaps cards, transcript actions, or error messages.

## 6. Tasks: Today and Week

### Header

The task screen header contains:

- small context label `Задачі`;
- dynamic heading `Сьогодні` or `Тиждень`;
- one calendar-period icon button at the top right.

Pressing the icon opens an anchored menu with:

- `Сьогодні`;
- `Тиждень`.

The selected option has a check icon. The menu closes after selection, outside tap, or Escape. Month mode is excluded from this release.

### Today mode

- Default task-list mode.
- Shows only active tasks scheduled for the local current day.
- Orders timed tasks by time, then untimed tasks by existing creation order.
- Empty state: `На сьогодні задач немає.`

### Week mode

- Shows today plus the next six local dates.
- Uses vertically stacked day sections rather than the existing horizontal date-strip tabs.
- Each section has weekday/date and its task cards.
- Days without tasks remain compact; they do not create large empty cards.
- The current day is visually identified but remains readable without relying only on color.

## 7. Task Cards

Each task is a rounded graphite card containing:

- task title;
- time or `Без часу`;
- completion control;
- overflow/edit action;
- a narrow priority rail on the left.

Visible priority labels are removed. The visual mapping is:

- high: red rail;
- medium: amber rail;
- normal, including unspecified priority: blue rail.

For accessibility, task controls expose priority in the accessible name, and the rail also varies subtly in length so the three levels are not distinguished by hue alone. The unspecified priority uses the normal/default presentation.

Tapping a card or its edit action opens the existing edit controls for title, date, time, and priority. Moving the date to another day immediately moves the card to the correct Day/Week section after saving.

## 8. Inbox and Quick Preview

Inbox behavior does not change. It receives the same visual system:

- rounded graphite cards;
- simplified metadata;
- icon-led actions;
- the same priority rail;
- completed tasks remain restorable.

Quick Preview keeps all current editing and confirmation behavior. Visible form labels remain where required for comprehension; this screen prioritizes correctness over decorative minimalism.

## 9. Component Boundaries

The redesign should preserve the current domain, persistence, and server boundaries. UI work is split into focused units:

- `AppShell`: default Capture destination and icon navigation;
- `CaptureScreen`: capture state composition and transcript-to-analysis flow;
- `VoiceRecorder`: recorder lifecycle plus audio-level samples;
- `AudioWaveform`: presentation-only amplitude visualization;
- `PeriodMenu`: Today/Week selection;
- `PlanScreen`: Today and Week rendering;
- `TaskCard`: priority styling and task actions;
- `QuickPreview` and `InboxScreen`: visual-system adoption only.

No UI component accesses IndexedDB or OpenAI directly.

## 10. Error and Edge States

- Microphone denied: keep manual entry available and show a concise settings instruction.
- Offline: local Tasks and Inbox remain usable; capture clearly explains that transcription and analysis need a connection.
- Transcription failure: preserve the current capture state where possible and allow retry or manual text entry.
- Parsing failure: preserve edited transcript and allow retry.
- Storage failure: do not claim that changes were saved.
- Empty week: show one calm empty state rather than seven repeated messages.
- Navigation and period menu remain keyboard accessible.

## 11. Accessibility Acceptance

- Text contrast meets WCAG AA: 4.5:1 for normal text and 3:1 for large text and component boundaries.
- Focus indicators are visible on every interactive element.
- Icon-only buttons have explicit Ukrainian `aria-label` values.
- Recording state is announced through a polite live region without announcing every waveform update.
- Waveform bars are hidden from the accessibility tree.
- Period menu supports keyboard navigation, Escape, and focus return.
- Motion respects `prefers-reduced-motion` and never blocks input during a transition.
- Controls remain usable at 200% text zoom and on a 320 px-wide viewport.
- Tap targets are at least 44 x 44 px.

## 12. Verification

Automated coverage must verify:

- Capture remains the initial destination.
- The waveform is absent while idle and visible while recording.
- Transcript remains editable before analysis.
- Bottom navigation uses accessible icon-only controls.
- Today is the default task period.
- Period menu switches between Today and Week.
- Week mode covers exactly today plus six days.
- Unspecified priority uses normal/default styling.
- Task editing can move a task to another date.
- Existing persistence, parsing, transcription, offline, and error tests remain green.

Visual QA must check idle Capture, active recording, transcript, Today, Week, open period menu, Quick Preview, and Inbox at 320 px, 390 px, and 480 px widths.

## 13. Out of Scope

- Month view;
- onboarding implementation;
- reminders or calendar integration;
- projects, tags, and advanced filters;
- changes to AI parsing rules;
- changes to persistence or server APIs;
- desktop-first layouts.
