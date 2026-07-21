# NoteAI Card-System Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing scaffold-like NoteAI UI with the approved graphite card system while preserving the working capture, AI, persistence, Inbox, and task-editing behavior.

**Architecture:** Keep the current React/domain/server boundaries. Add a presentation-only waveform fed by audio-level samples from `VoiceRecorder`, a focused period-menu component for Today/Week, and reusable icon/button styling through Lucide React. No IndexedDB, OpenAI route, task schema, or parser behavior changes.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS design tokens, Lucide React, MediaRecorder, Web Audio API, Vitest, Testing Library, Playwright.

## Global Constraints

- Execute from an isolated branch based on `feat/noteai-mobile-mvp`, not from placeholder `main`.
- The app opens on Capture.
- The waveform exists only during active recording and is hidden from the accessibility tree.
- Bottom navigation is solid, icon-only, and has exactly Capture, Tasks, and Inbox destinations.
- Every icon-only control has a Ukrainian accessible name and a minimum 44 x 44 px target.
- Today is the default task period; Week covers today plus six days.
- Month mode is not included or shown as enabled.
- Use one 120-200 ms CSS motion system for screens, recorder states, menus, and cards; respect `prefers-reduced-motion`.
- High priority is red, medium is amber, and normal or unspecified priority is blue.
- Preserve all existing task, draft, persistence, offline, transcription, parsing, and Quick Preview behavior.
- Do not add projects, tags, calendars, reminders, accounts, or desktop-first layouts.
- Run unit tests, lint, typecheck, secret scan, and build before completion.

## Planned File Map

```text
package.json                                      add lucide-react
pnpm-lock.yaml                                   dependency lock update
src/app/globals.css                              graphite tokens and responsive component styles
src/components/icons/AppIcon.tsx                 typed Lucide icon wrapper
src/components/icons/AppIcon.test.tsx            accessible-icon contract
src/components/app-shell/AppShell.tsx            icon-only solid navigation and Tasks naming
src/components/app-shell/AppShell.test.tsx       initial destination and nav accessibility
src/components/capture/AudioWaveform.tsx         presentation-only normalized audio bars
src/components/capture/AudioWaveform.test.tsx    idle/active/reduced-motion rendering
src/components/capture/VoiceRecorder.tsx         Web Audio analyser lifecycle and level sampling
src/components/capture/VoiceRecorder.test.tsx    analyser cleanup and recording-state waveform
src/components/capture/CaptureScreen.tsx         quiet idle and editable transcript composition
src/components/capture/CaptureScreen.test.tsx    idle/manual input/analysis UI behavior
src/components/capture/CaptureScreen.voice.test.tsx transcript flow regression coverage
src/components/tasks/PeriodMenu.tsx               accessible Today/Week anchored menu
src/components/tasks/PeriodMenu.test.tsx          selection, Escape, and focus return
src/components/tasks/PlanScreen.tsx               Today and seven-day vertical Week modes
src/components/tasks/PlanScreen.test.tsx          period behavior and task ordering
src/components/tasks/TaskCard.tsx                 priority rail and icon-led card actions
src/components/tasks/TaskCard.test.tsx            priority and editing behavior
src/components/tasks/InboxScreen.tsx              visual heading/card composition
src/components/preview/QuickPreview.tsx           card-system classes and icon actions
tests/e2e/noteai-core.spec.ts                     mobile capture/navigation/period smoke test
```

---

### Task 1: Visual Foundation and Icon Navigation

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/components/icons/AppIcon.tsx`
- Create: `src/components/icons/AppIcon.test.tsx`
- Modify: `src/components/app-shell/AppShell.tsx`
- Modify: `src/components/app-shell/AppShell.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: existing `Destination` state and three-screen composition in `AppShell`.
- Produces: `AppIcon({ name, size?, decorative? })` and stable navigation labels `Запис`, `Задачі`, `Inbox`.

- [ ] **Step 1: Add the icon dependency**

Run:

```bash
pnpm add lucide-react
```

Expected: `lucide-react` appears in dependencies and `pnpm-lock.yaml` changes.

- [ ] **Step 2: Write failing icon and navigation tests**

Create `src/components/icons/AppIcon.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { AppIcon } from "./AppIcon";

it("hides decorative icons from assistive technology", () => {
  const { container } = render(<AppIcon name="mic" decorative />);
  expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
});

it("requires an accessible name for semantic icons", () => {
  render(<AppIcon name="calendar" />);
  expect(screen.getByRole("img", { name: "Календар" })).toBeVisible();
});
```

Replace the first test in `AppShell.test.tsx` with:

```tsx
it("opens Capture and exposes exactly three icon-only destinations", async () => {
  const user = userEvent.setup();
  render(
    <TaskProvider repository={createMemoryTaskRepository()}>
      <AppShell />
    </TaskProvider>,
  );

  const navigation = screen.getByRole("navigation", { name: "Основна навігація" });
  expect(within(navigation).getAllByRole("button")).toHaveLength(3);
  expect(screen.getByRole("button", { name: "Запис" })).toHaveAttribute("aria-current", "page");

  await user.click(screen.getByRole("button", { name: "Задачі" }));
  expect(screen.getByRole("heading", { name: "Сьогодні" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Задачі" })).toHaveAttribute("aria-current", "page");
});
```

Add `within` to the Testing Library import.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
pnpm test -- src/components/icons/AppIcon.test.tsx src/components/app-shell/AppShell.test.tsx
```

Expected: FAIL because `AppIcon` does not exist and current navigation labels are `Capture`, `Inbox`, and `План`.

- [ ] **Step 4: Implement the typed icon wrapper and navigation**

Create `AppIcon.tsx`:

```tsx
import { AudioLines, CalendarDays, Check, CheckCheck, Inbox, Keyboard, Mic, MoreHorizontal, RotateCcw, Send, Square, Trash2, X } from "lucide-react";

const icons = {
  audio: AudioLines,
  calendar: CalendarDays,
  check: Check,
  tasks: CheckCheck,
  inbox: Inbox,
  keyboard: Keyboard,
  mic: Mic,
  more: MoreHorizontal,
  retry: RotateCcw,
  send: Send,
  stop: Square,
  trash: Trash2,
  close: X,
} as const;

const labels: Record<keyof typeof icons, string> = {
  audio: "Аудіозапис", calendar: "Календар", check: "Вибрано",
  tasks: "Задачі", inbox: "Inbox", keyboard: "Клавіатура",
  mic: "Мікрофон", more: "Інші дії", retry: "Повторити",
  send: "Продовжити", stop: "Зупинити", trash: "Видалити", close: "Закрити",
};

type AppIconProps = {
  name: keyof typeof icons;
  size?: number;
  decorative?: boolean;
};

export function AppIcon({ name, size = 20, decorative = false }: AppIconProps) {
  const Icon = icons[name];
  return decorative ? (
    <Icon size={size} strokeWidth={1.8} aria-hidden="true" />
  ) : (
    <Icon size={size} strokeWidth={1.8} role="img" aria-label={labels[name]} />
  );
}
```

In `AppShell.tsx`, define destinations as:

```tsx
const destinations = [
  { id: "capture", label: "Запис", icon: "audio" },
  { id: "plan", label: "Задачі", icon: "tasks" },
  { id: "inbox", label: "Inbox", icon: "inbox" },
] as const;
```

Render each button with `aria-label={label}`, `<AppIcon name={icon} decorative />`, and `<span className="active-nav-indicator" aria-hidden="true" />` only when selected.

Replace the root token block and navigation rules in `globals.css` with the exact approved palette and solid navigation:

```css
:root {
  --bg: #0b0e0f;
  --surface: #171b1f;
  --surface-elevated: #1d2125;
  --border: #30363c;
  --text: #f2f3ef;
  --muted: #92989e;
  --action: #eef0ec;
  --danger: #ef6b65;
  --warning: #e6a650;
  --info: #6f98f0;
  --radius-card: 24px;
  --motion-fast: 120ms;
  --motion-standard: 180ms;
  --motion-ease: cubic-bezier(0.22, 1, 0.36, 1);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--text);
  background: var(--bg);
}

.bottom-nav {
  position: fixed;
  left: 50%;
  bottom: max(14px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  width: min(calc(100% - 28px), 452px);
  height: 64px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 7px;
  border: 1px solid var(--border);
  border-radius: 22px;
  background: var(--surface-elevated);
  box-shadow: 0 -10px 32px rgb(0 0 0 / 22%);
  z-index: 20;
}

.bottom-nav button {
  position: relative;
  min-width: 44px;
  min-height: 44px;
  border: 0;
  color: #737a81;
  background: transparent;
}

.bottom-nav button[aria-current="page"] { color: var(--text); }
.active-nav-indicator { position: absolute; left: 50%; bottom: 3px; width: 4px; height: 4px; border-radius: 50%; background: currentColor; }
.screen-enter { animation: screen-enter var(--motion-standard) var(--motion-ease) both; }
button:active { transform: scale(.98); transition: transform var(--motion-fast) ease-out; }
@keyframes screen-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
}
```

- [ ] **Step 5: Verify GREEN and commit**

Run:

```bash
pnpm test -- src/components/icons/AppIcon.test.tsx src/components/app-shell/AppShell.test.tsx
pnpm typecheck
```

Expected: PASS.

Commit:

```bash
git add package.json pnpm-lock.yaml src/components/icons src/components/app-shell/AppShell.tsx src/components/app-shell/AppShell.test.tsx src/app/globals.css
git commit -m "feat: add graphite shell and icon navigation"
```

---

### Task 2: Live Audio-Level Waveform

**Files:**
- Create: `src/components/capture/AudioWaveform.tsx`
- Create: `src/components/capture/AudioWaveform.test.tsx`
- Modify: `src/components/capture/VoiceRecorder.tsx`
- Modify: `src/components/capture/VoiceRecorder.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: active `MediaStream` owned by `VoiceRecorder`.
- Produces: `AudioWaveform({ levels }: { levels: number[] })` and smoothed values in the inclusive range `0...1`.

- [ ] **Step 1: Write failing waveform tests**

Create `AudioWaveform.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { AudioWaveform } from "./AudioWaveform";

it("renders normalized bars hidden from assistive technology", () => {
  render(<AudioWaveform levels={[0, 0.25, 1, 2]} />);
  const waveform = screen.getByTestId("audio-waveform");
  expect(waveform).toHaveAttribute("aria-hidden", "true");
  expect(waveform.querySelectorAll("i")).toHaveLength(4);
  expect(waveform.querySelectorAll("i")[3]).toHaveStyle({ "--level": "1" });
});
```

Add to `VoiceRecorder.test.tsx`:

```tsx
it("shows the waveform only while recording", async () => {
  mockSuccessfulMediaStream();
  render(<VoiceRecorder onTranscript={vi.fn()} />);
  expect(screen.queryByTestId("audio-waveform")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Почати запис" }));
  expect(screen.getByTestId("audio-waveform")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Зупинити" }));
  expect(screen.queryByTestId("audio-waveform")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm test -- src/components/capture/AudioWaveform.test.tsx src/components/capture/VoiceRecorder.test.tsx
```

Expected: FAIL because `AudioWaveform` and the recording visualization do not exist.

- [ ] **Step 3: Implement waveform rendering**

Create `AudioWaveform.tsx`:

```tsx
type AudioWaveformProps = { levels: number[] };

export function AudioWaveform({ levels }: AudioWaveformProps) {
  return (
    <div className="audio-waveform" data-testid="audio-waveform" aria-hidden="true">
      {levels.map((level, index) => (
        <i key={index} style={{ "--level": String(Math.max(0, Math.min(1, level))) } as React.CSSProperties} />
      ))}
    </div>
  );
}
```

Add CSS:

```css
.audio-waveform { height: 104px; display: flex; align-items: center; justify-content: center; gap: 5px; }
.audio-waveform i { width: 4px; height: max(6px, calc(var(--level) * 82px)); border-radius: 999px; background: #dde0dc; transition: height 90ms linear; }
@media (prefers-reduced-motion: reduce) { .audio-waveform i { transition-duration: 240ms; } }
```

- [ ] **Step 4: Feed levels from the Web Audio API and clean up**

In `VoiceRecorder.tsx`, extend `RecordingSession`:

```ts
audioContext: AudioContext | null;
analyser: AnalyserNode | null;
animationFrame: number | null;
```

Initialize the analyser after `getUserMedia` succeeds:

```ts
const AudioContextClass = window.AudioContext;
const audioContext = new AudioContextClass();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 64;
audioContext.createMediaStreamSource(stream).connect(analyser);
session.audioContext = audioContext;
session.analyser = analyser;
```

Sample thirteen bars per frame, smooth with `next = previous * 0.68 + sample * 0.32`, and update state only while the current session is recording. Extend the existing session cleanup to cancel the animation frame, disconnect the analyser, and close the audio context. Render `<AudioWaveform levels={levels} />` only in the `recording` branch and use the visible button label `Зупинити`.

- [ ] **Step 5: Verify GREEN, lifecycle cleanup, and commit**

Run:

```bash
pnpm test -- src/components/capture/AudioWaveform.test.tsx src/components/capture/VoiceRecorder.test.tsx src/components/capture/CaptureScreen.voice.test.tsx
pnpm typecheck
```

Expected: PASS with no unhandled animation or audio-context errors.

Commit:

```bash
git add src/components/capture/AudioWaveform.tsx src/components/capture/AudioWaveform.test.tsx src/components/capture/VoiceRecorder.tsx src/components/capture/VoiceRecorder.test.tsx src/app/globals.css
git commit -m "feat: visualize live recording levels"
```

---

### Task 3: Quiet Capture and Editable Transcript Surface

**Files:**
- Modify: `src/components/capture/CaptureScreen.tsx`
- Modify: `src/components/capture/CaptureScreen.test.tsx`
- Modify: `src/components/capture/CaptureScreen.voice.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `VoiceRecorder.onTranscript(text)` and existing `parseCapture` logic.
- Produces: idle/manual-entry/transcript/parsing visual states without changing API payloads.

- [ ] **Step 1: Write failing Capture UI tests**

Add tests:

```tsx
it("starts with quiet helper copy and no waveform", () => {
  renderCapture();
  expect(screen.getByText("Скажіть усе як є. Решту впорядкуємо.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Почати запис" })).toBeVisible();
  expect(screen.queryByTestId("audio-waveform")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Ввести текст вручну" })).toBeVisible();
});

it("shows an editable transcript and explicit analysis action", async () => {
  await completeVoiceTranscription("Купити молоко сьогодні");
  expect(screen.getByLabelText("Текст після запису")).toHaveValue("Купити молоко сьогодні");
  expect(screen.getByRole("button", { name: "Проаналізувати" })).toBeEnabled();
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
pnpm test -- src/components/capture/CaptureScreen.test.tsx src/components/capture/CaptureScreen.voice.test.tsx
```

Expected: FAIL on new copy, manual-entry trigger, transcript label, and action label.

- [ ] **Step 3: Implement state-aware composition**

Keep the existing `text`, `inputMethod`, persistence, and parse functions. Replace only the editing-state JSX:

```tsx
<section aria-label="Створення нотатки" className="capture-screen">
  {!text ? <p className="capture-helper">Скажіть усе як є. Решту впорядкуємо.</p> : null}
  <VoiceRecorder onTranscript={handleTranscript} disabled={!aiAvailable} />
  <div className={text ? "transcript-card" : "manual-entry"}>
    <label htmlFor="capture-text">{inputMethod === "voice" ? "Текст після запису" : "Ваша нотатка"}</label>
    <textarea id="capture-text" value={text} onChange={(event) => changeText(event.target.value)} rows={text ? 5 : 3} />
  </div>
  <button type="button" className="primary-button analyze-button" onClick={() => parseCapture()} disabled={isParsing || !text.trim() || !aiAvailable}>
    {isParsing ? "Аналізуємо…" : "Проаналізувати"}
    {!isParsing ? <AppIcon name="send" decorative /> : null}
  </button>
</section>
```

When `text` is empty, the manual-entry surface is visually collapsed behind a `Ввести текст вручну` button but remains available after microphone denial or offline state. Do not auto-focus the transcript.

Apply a shared `capture-state-enter` class to idle, recording, transcribing, and transcript containers. Animate opacity and a maximum 6 px translation for 180 ms; do not keep outgoing content mounted solely for animation.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```bash
pnpm test -- src/components/capture/CaptureScreen.test.tsx src/components/capture/CaptureScreen.voice.test.tsx src/components/app-shell/AppShell.test.tsx
pnpm typecheck
```

Expected: PASS and API payload assertions remain unchanged.

Commit:

```bash
git add src/components/capture/CaptureScreen.tsx src/components/capture/CaptureScreen.test.tsx src/components/capture/CaptureScreen.voice.test.tsx src/app/globals.css
git commit -m "feat: redesign the capture and transcript flow"
```

---

### Task 4: Accessible Today and Week Period Menu

**Files:**
- Create: `src/components/tasks/PeriodMenu.tsx`
- Create: `src/components/tasks/PeriodMenu.test.tsx`
- Modify: `src/components/tasks/PlanScreen.tsx`
- Modify: `src/components/tasks/PlanScreen.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `TaskPeriod = "today" | "week"` and `PeriodMenu({ value, onChange })`.
- Consumes: existing `addLocalDays`, `comparePlanTasks`, `TaskCard`, and `today` local date key.

- [ ] **Step 1: Write failing PeriodMenu tests**

```tsx
it("selects Week and returns focus to the trigger", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<PeriodMenu value="today" onChange={onChange} />);
  const trigger = screen.getByRole("button", { name: "Змінити період" });
  await user.click(trigger);
  await user.click(screen.getByRole("menuitemradio", { name: "Тиждень" }));
  expect(onChange).toHaveBeenCalledWith("week");
  expect(trigger).toHaveFocus();
});

it("closes on Escape without changing the period", async () => {
  const user = userEvent.setup();
  render(<PeriodMenu value="today" onChange={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "Змінити період" }));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Replace old date-strip tests with Today/Week tests**

```tsx
it("defaults to Today and switches to a seven-day Week", async () => {
  const user = userEvent.setup();
  render(<PlanScreen tasks={[todayTask, tomorrowTask]} today="2026-07-19" {...actions} />);
  expect(screen.getByRole("heading", { name: "Сьогодні" })).toBeVisible();
  expect(screen.getByText(todayTask.title)).toBeVisible();
  expect(screen.queryByText(tomorrowTask.title)).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Змінити період" }));
  await user.click(screen.getByRole("menuitemradio", { name: "Тиждень" }));
  expect(screen.getByRole("heading", { name: "Тиждень" })).toBeVisible();
  expect(screen.getAllByRole("group", { name: /задачі/ })).toHaveLength(7);
  expect(screen.getByText(todayTask.title)).toBeVisible();
  expect(screen.getByText(tomorrowTask.title)).toBeVisible();
});
```

- [ ] **Step 3: Run and verify RED**

Run:

```bash
pnpm test -- src/components/tasks/PeriodMenu.test.tsx src/components/tasks/PlanScreen.test.tsx
```

Expected: FAIL because the menu does not exist and `PlanScreen` still renders seven date buttons.

- [ ] **Step 4: Implement PeriodMenu and vertical Week sections**

Create `PeriodMenu.tsx` with a trigger ref, local `open` state, `role="menu"`, two `menuitemradio` buttons, document-level outside pointer handling while open, Escape handling, and focus return after selection/close. Export:

```ts
export type TaskPeriod = "today" | "week";
export function PeriodMenu(props: { value: TaskPeriod; onChange(value: TaskPeriod): void }): JSX.Element;
```

Give the anchored menu a 140 ms opacity/scale entrance with `transform-origin: top right`. Changing Today/Week crossfades the heading and applies the shared card entrance without blocking menu focus return.

In `PlanScreen`, replace selected-date state with:

```tsx
const [period, setPeriod] = useState<TaskPeriod>("today");
const dates = Array.from({ length: 7 }, (_, index) => addLocalDays(today, index));
const activeTasks = tasks.filter((task) => task.status === "active");
```

Render only today's sorted tasks in Today mode. In Week mode, map exactly seven dates to `<section role="group" aria-label={`${formatPlanDate(date)} задачі`}>`; render compact day headings and only the matching sorted cards. If every day is empty, show one `На цей тиждень задач немає.` message.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```bash
pnpm test -- src/components/tasks/PeriodMenu.test.tsx src/components/tasks/PlanScreen.test.tsx
pnpm typecheck
```

Expected: PASS.

Commit:

```bash
git add src/components/tasks/PeriodMenu.tsx src/components/tasks/PeriodMenu.test.tsx src/components/tasks/PlanScreen.tsx src/components/tasks/PlanScreen.test.tsx src/app/globals.css
git commit -m "feat: add Today and Week task modes"
```

---

### Task 5: Accessible Priority Task Cards

**Files:**
- Modify: `src/components/tasks/TaskCard.tsx`
- Modify: `src/components/tasks/TaskCard.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: visual priority classes `priority-high`, `priority-medium`, `priority-normal`.
- Preserves: `onChange`, `onComplete`, `onRestore`, and `onDelete` callbacks.

- [ ] **Step 1: Write failing priority tests**

```tsx
it.each([
  ["high", "priority-high", "Високий пріоритет"],
  ["medium", "priority-medium", "Середній пріоритет"],
  ["low", "priority-normal", "Звичайний пріоритет"],
  [null, "priority-normal", "Звичайний пріоритет"],
] as const)("maps %s to the accessible card treatment", (priority, className, label) => {
  renderTask(makeTask({ priority }));
  const card = screen.getByRole("article");
  expect(card).toHaveClass(className);
  expect(card).toHaveAccessibleName(expect.stringContaining(label));
  expect(screen.queryByText(/Пріоритет:/)).not.toBeInTheDocument();
});
```

Add a test that changes the date in edit mode and verifies `onChange` receives the new date unchanged.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
pnpm test -- src/components/tasks/TaskCard.test.tsx
```

Expected: FAIL because cards have no priority class and render a visible priority label.

- [ ] **Step 3: Implement card mapping and icon actions**

Add:

```ts
function priorityPresentation(priority: TaskPriority | null) {
  if (priority === "high") return { className: "priority-high", label: "Високий пріоритет" };
  if (priority === "medium") return { className: "priority-medium", label: "Середній пріоритет" };
  return { className: "priority-normal", label: "Звичайний пріоритет" };
}
```

Use the class on `<article>` and include the label in its `aria-label`. Remove the visible priority paragraph. Keep visible title and time. Replace long visible action labels with icon buttons whose Ukrainian `aria-label` values preserve the existing testable actions. Editing form labels remain visible.

Add rails:

```css
.task-card::before { content: ""; position: absolute; left: 0; top: 16px; width: 3px; border-radius: 999px; }
.task-card.priority-high::before { height: calc(100% - 32px); background: var(--danger); }
.task-card.priority-medium::before { height: 66%; background: var(--warning); }
.task-card.priority-normal::before { height: 34%; background: var(--info); }
```

- [ ] **Step 4: Verify GREEN and commit**

Run:

```bash
pnpm test -- src/components/tasks/TaskCard.test.tsx src/components/tasks/InboxScreen.test.tsx src/components/tasks/PlanScreen.test.tsx
pnpm typecheck
```

Expected: PASS.

Commit:

```bash
git add src/components/tasks/TaskCard.tsx src/components/tasks/TaskCard.test.tsx src/app/globals.css
git commit -m "feat: restyle task cards by priority"
```

---

### Task 6: Preview, Inbox, Regression, and Visual QA

**Files:**
- Modify: `src/components/preview/QuickPreview.tsx`
- Modify: `src/components/preview/QuickPreview.test.tsx`
- Modify: `src/components/tasks/InboxScreen.tsx`
- Modify: `src/components/tasks/InboxScreen.test.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/e2e/noteai-core.spec.ts`

**Interfaces:**
- Consumes: established graphite tokens, `AppIcon`, `TaskCard`, and existing preview/inbox behavior.
- Produces: visually consistent Preview and Inbox with no domain behavior changes.

- [ ] **Step 1: Add failing semantic regression assertions**

Add to Preview and Inbox tests:

```tsx
expect(screen.getByRole("region", { name: "Попередній перегляд задач" })).toHaveClass("quick-preview");
expect(screen.getByRole("heading", { name: "Inbox" })).toBeVisible();
expect(screen.getAllByRole("article")[0]).toHaveClass("task-card");
```

Update `tests/e2e/noteai-core.spec.ts` to assert:

```ts
await expect(page.getByRole("button", { name: "Запис" })).toHaveAttribute("aria-current", "page");
await page.getByRole("button", { name: "Задачі" }).click();
await expect(page.getByRole("heading", { name: "Сьогодні" })).toBeVisible();
await page.getByRole("button", { name: "Змінити період" }).click();
await page.getByRole("menuitemradio", { name: "Тиждень" }).click();
await expect(page.getByRole("heading", { name: "Тиждень" })).toBeVisible();
```

- [ ] **Step 2: Run focused tests and confirm RED where copy/roles changed**

Run:

```bash
pnpm test -- src/components/preview/QuickPreview.test.tsx src/components/tasks/InboxScreen.test.tsx
```

Expected: any changed role/class assertion fails before the markup adjustment.

- [ ] **Step 3: Apply final card-system classes without changing behavior**

Use the existing Quick Preview inputs, labels, select options, validation, confirmation, and retry logic unchanged. Add only icon decoration and approved card classes. Keep Inbox classification and completed restoration logic unchanged. Finish responsive rules for 320 px, 390 px, and 480 px widths, 200% text zoom, safe-area spacing, visible `:focus-visible`, and reduced motion.

- [ ] **Step 4: Run the full verification suite**

Run:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm scan:secrets
pnpm build
```

Expected: every command exits 0 with no new warnings.

Run E2E when browser binaries are present:

```bash
pnpm test:e2e
```

Expected: mobile Chromium and WebKit core flows pass. If binaries are absent, install them only with user-approved network access and rerun.

- [ ] **Step 5: Perform visual QA in the local app**

Verify and capture these states at 320 x 700, 390 x 844, and 480 x 900:

1. idle Capture;
2. active recording with real amplitude response;
3. editable transcript;
4. Quick Preview;
5. Today tasks;
6. open period menu;
7. Week tasks;
8. Inbox;
9. microphone denied;
10. offline AI-disabled state.

Check that no fixed navigation overlaps content, no icon lacks an accessible name, and priority rail color/length mappings are consistent. Verify screen, recorder, transcript, menu, period, and task-card transitions at normal settings and again with `prefers-reduced-motion: reduce`; no transition may block a click or keyboard action.

- [ ] **Step 6: Commit the integration pass**

```bash
git add src/components/preview src/components/tasks/InboxScreen.tsx src/components/tasks/InboxScreen.test.tsx src/app/globals.css tests/e2e/noteai-core.spec.ts
git commit -m "feat: complete NoteAI card-system redesign"
```
