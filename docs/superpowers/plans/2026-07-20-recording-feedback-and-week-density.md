# Recording Feedback and Week Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide empty days in the weekly plan, show an elapsed recording timer, and make the recording waveform visibly react to ordinary microphone levels.

**Architecture:** `PlanScreen` renders prefiltered non-empty date groups. A pure `mapVoiceLevels` helper converts Web Audio time-domain samples into smoothed normalized bar levels, and `VoiceRecorder` owns both the analyser loop and elapsed-time lifecycle so all recording cleanup remains session-scoped.

**Tech Stack:** Next.js 16, React 19, TypeScript, Web Audio API, MediaRecorder, Vitest, Testing Library.

## Global Constraints

- Preserve the existing seven-day `week` window and the whole-week empty state.
- Timer format is `MM:SS` and starts only after `MediaRecorder.start()` succeeds.
- Waveform bars remain decorative and reduced-motion behavior remains static.
- Do not change transcription, permission, offline, or 59-second auto-stop behavior.
- Preserve the current dark design tokens, card geometry, and motion system.

---

### Task 1: Render only scheduled days in week mode

**Files:**
- Modify: `src/components/tasks/PlanScreen.tsx`
- Test: `src/components/tasks/PlanScreen.test.tsx`

**Interfaces:**
- Consumes: `activeTasks: Task[]`, `dates: string[]`, `TaskCard`.
- Produces: `weekDayGroups: Array<{ date: string; tasks: Task[] }>` used by week-mode rendering.

- [ ] **Step 1: Write the failing test**

Update the first `PlanScreen` test after selecting `Тиждень`:

```tsx
expect(screen.getByRole("heading", { name: "Тиждень" })).toBeVisible();
expect(screen.getAllByRole("group", { name: /День/ })).toHaveLength(2);
expect(screen.getByRole("group", { name: "День 19 липня" })).toBeVisible();
expect(screen.getByRole("group", { name: "День 20 липня" })).toBeVisible();
expect(screen.queryByRole("group", { name: "День 21 липня" })).not.toBeInTheDocument();
expect(screen.getByText(todayTask.title)).toBeVisible();
expect(screen.getByText(tomorrowTask.title)).toBeVisible();
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm vitest run src/components/tasks/PlanScreen.test.tsx
```

Expected: FAIL because seven day groups are rendered instead of two.

- [ ] **Step 3: Implement non-empty day groups**

In `PlanScreen`, derive groups after `weekTasks`:

```tsx
const weekDayGroups = dates.flatMap((date) => {
  const dayTasks = weekTasks.filter((task) => task.scheduledDate === date);
  return dayTasks.length ? [{ date, tasks: dayTasks }] : [];
});
```

Replace `dates.map(...)` in week mode with:

```tsx
{weekDayGroups.map(({ date, tasks: dayTasks }) => (
  <section
    key={date}
    className="week-day"
    role="group"
    aria-label={`День ${formatPlanDate(date)}`}
  >
    <h2>{date === today ? "Сьогодні" : formatPlanDate(date)}</h2>
    <div className="task-list">
      {dayTasks.map((task) => (
        <TaskCard key={task.id} task={task} today={today} {...actions} />
      ))}
    </div>
  </section>
))}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same command. Expected: all `PlanScreen` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/PlanScreen.tsx src/components/tasks/PlanScreen.test.tsx
git commit -m "fix: hide empty days from weekly plan"
```

---

### Task 2: Map ordinary microphone input to responsive bar levels

**Files:**
- Create: `src/components/capture/audioLevels.ts`
- Create: `src/components/capture/audioLevels.test.ts`
- Modify: `src/components/capture/VoiceRecorder.tsx`

**Interfaces:**
- Consumes: `samples: Uint8Array`, `previousLevels: readonly number[]`.
- Produces: `mapVoiceLevels(samples, previousLevels): number[]`, each value clamped to `0...1`.

- [ ] **Step 1: Write the failing mapper tests**

Create `audioLevels.test.ts`:

```ts
import { expect, it } from "vitest";
import { mapVoiceLevels } from "./audioLevels";

const previous = Array.from({ length: 13 }, () => 0.06);

function samplesWithDeviation(deviation: number) {
  return Uint8Array.from({ length: 64 }, (_, index) =>
    index % 2 ? 128 + deviation : 128 - deviation,
  );
}

it("keeps silence close to the quiet bar level", () => {
  const levels = mapVoiceLevels(samplesWithDeviation(0), previous);
  expect(Math.max(...levels)).toBeLessThanOrEqual(0.07);
});

it("makes ordinary speech visibly taller than silence", () => {
  const quiet = mapVoiceLevels(samplesWithDeviation(0), previous);
  const speech = mapVoiceLevels(samplesWithDeviation(3), previous);
  expect(Math.max(...speech)).toBeGreaterThan(Math.max(...quiet) + 0.08);
});

it("maps louder speech to taller clamped bars", () => {
  const speech = mapVoiceLevels(samplesWithDeviation(3), previous);
  const loud = mapVoiceLevels(samplesWithDeviation(18), previous);
  expect(Math.max(...loud)).toBeGreaterThan(Math.max(...speech));
  expect(loud.every((level) => level >= 0 && level <= 1)).toBe(true);
});
```

- [ ] **Step 2: Run the mapper test and verify RED**

Run:

```bash
pnpm vitest run src/components/capture/audioLevels.test.ts
```

Expected: FAIL because `audioLevels.ts` does not exist.

- [ ] **Step 3: Implement the sensitivity curve and smoothing**

Create `audioLevels.ts`:

```ts
const MIN_LEVEL = 0.06;
const NOISE_FLOOR_RMS = 0.002;
const SPEECH_RANGE_RMS = 0.08;

export function mapVoiceLevels(
  samples: Uint8Array,
  previousLevels: readonly number[],
): number[] {
  if (!samples.length || !previousLevels.length) return [];

  const sumSquares = samples.reduce((total, sample) => {
    const centered = (sample - 128) / 128;
    return total + centered * centered;
  }, 0);
  const rms = Math.sqrt(sumSquares / samples.length);
  const audible = Math.max(0, (rms - NOISE_FLOOR_RMS) / SPEECH_RANGE_RMS);
  const voiceLevel = Math.min(1, Math.pow(audible, 0.55));
  const middle = (previousLevels.length - 1) / 2;

  return previousLevels.map((previous, index) => {
    const centerWeight = 1 - Math.abs(index - middle) / Math.max(1, middle + 2);
    const target = Math.min(1, MIN_LEVEL + voiceLevel * centerWeight * 0.94);
    const smoothing = target > previous ? 0.56 : 0.2;
    return Math.max(0, Math.min(1, previous + (target - previous) * smoothing));
  });
}
```

- [ ] **Step 4: Integrate the mapper into `VoiceRecorder`**

Import it:

```ts
import { mapVoiceLevels } from "./audioLevels";
```

Replace the inline RMS/amplitude mapping inside `sampleLevels` with:

```ts
analyser.getByteTimeDomainData(samples);
setLevels((current) => mapVoiceLevels(samples, current));
session.animationFrame = requestAnimationFrame(sampleLevels);
```

- [ ] **Step 5: Run mapper and recorder tests and verify GREEN**

Run:

```bash
pnpm vitest run src/components/capture/audioLevels.test.ts src/components/capture/VoiceRecorder.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/capture/audioLevels.ts src/components/capture/audioLevels.test.ts src/components/capture/VoiceRecorder.tsx
git commit -m "fix: make recording waveform voice responsive"
```

---

### Task 3: Add a session-safe elapsed recording timer

**Files:**
- Modify: `src/components/capture/VoiceRecorder.tsx`
- Modify: `src/components/capture/VoiceRecorder.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Adds session fields `startedAt: number | null` and `elapsedTimer: ReturnType<typeof setInterval> | null`.
- Adds local state `elapsedSeconds: number`.
- Adds pure formatter `formatElapsedTime(totalSeconds: number): string`.

- [ ] **Step 1: Write the failing timer test**

Add to `VoiceRecorder.test.tsx`:

```tsx
it("shows elapsed recording time from zero and advances every second", async () => {
  vi.useFakeTimers();
  microphone();
  render(<VoiceRecorder onTranscript={vi.fn()} />);

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Почати запис" }));
    await Promise.resolve();
  });

  expect(screen.getByText("00:00")).toBeVisible();
  act(() => vi.advanceTimersByTime(1_000));
  expect(screen.getByText("00:01")).toBeVisible();
  act(() => vi.advanceTimersByTime(59_000));
  expect(screen.queryByText("01:00")).not.toBeInTheDocument();
});
```

Add a reset regression test:

```tsx
it("clears elapsed time when a recording session is discarded", async () => {
  vi.useFakeTimers();
  microphone();
  const { rerender } = render(<VoiceRecorder onTranscript={vi.fn()} />);

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Почати запис" }));
    await Promise.resolve();
  });
  act(() => vi.advanceTimersByTime(4_000));
  expect(screen.getByText("00:04")).toBeVisible();

  rerender(<VoiceRecorder onTranscript={vi.fn()} disabled />);
  rerender(<VoiceRecorder onTranscript={vi.fn()} disabled={false} />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Почати запис" }));
    await Promise.resolve();
  });
  expect(screen.getByText("00:00")).toBeVisible();
});
```

- [ ] **Step 2: Run the timer tests and verify RED**

Run:

```bash
pnpm vitest run src/components/capture/VoiceRecorder.test.tsx
```

Expected: FAIL because no elapsed timer is rendered.

- [ ] **Step 3: Add timer formatting and lifecycle fields**

Add:

```ts
function formatElapsedTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
```

Extend `RecordingSession`:

```ts
startedAt: number | null;
elapsedTimer: ReturnType<typeof setInterval> | null;
```

Add state:

```ts
const [elapsedSeconds, setElapsedSeconds] = useState(0);
```

Initialize both session fields to `null`.

- [ ] **Step 4: Start and clear the timer with the recorder lifecycle**

Add:

```ts
function clearElapsedTimer(session: RecordingSession) {
  if (session.elapsedTimer !== null) {
    clearInterval(session.elapsedTimer);
    session.elapsedTimer = null;
  }
  session.startedAt = null;
}
```

Call `clearElapsedTimer(session)` in `discardSession`, `finishRecording`, recorder error handling, the `startRecording` catch, and unmount cleanup. Reset React state to zero in current-session UI cleanup paths.

Immediately after `recorder.start()` succeeds, start the timer:

```ts
session.startedAt = Date.now();
setElapsedSeconds(0);
session.elapsedTimer = setInterval(() => {
  if (
    !mountedRef.current ||
    activeSessionRef.current !== session ||
    session.startedAt === null ||
    recorder.state !== "recording"
  ) {
    return;
  }
  setElapsedSeconds(Math.floor((Date.now() - session.startedAt) / 1_000));
}, 1_000);
```

- [ ] **Step 5: Render and style the timer**

In `.recording-heading`, render:

```tsx
<time className="recording-timer" aria-hidden="true">
  {formatElapsedTime(elapsedSeconds)}
</time>
```

Add to `globals.css`:

```css
.recording-timer {
  color: var(--text);
  font-variant-numeric: tabular-nums;
  letter-spacing: .04em;
}
```

- [ ] **Step 6: Run recorder tests and verify GREEN**

Run the same focused test command. Expected: all recorder tests pass with no leaked timers.

- [ ] **Step 7: Commit**

```bash
git add src/components/capture/VoiceRecorder.tsx src/components/capture/VoiceRecorder.test.tsx src/app/globals.css
git commit -m "feat: show elapsed recording timer"
```

---

### Task 4: Full regression and visual verification

**Files:**
- Verify all changed files from Tasks 1-3.

**Interfaces:**
- Consumes: completed implementation.
- Produces: verified local preview at `http://localhost:61623/`.

- [ ] **Step 1: Run the full automated suite**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm scan:secrets
pnpm build
git diff --check
```

Expected: every command exits `0`.

- [ ] **Step 2: Verify the weekly list visually**

Reload the existing local preview, switch to `Тиждень`, and confirm only dates with task cards are rendered; the current dark card system, spacing, localized labels, and animations remain intact.

- [ ] **Step 3: Verify recording feedback visually**

Start recording and confirm `00:00` appears immediately, advances to `00:01`, the bars stay short during silence, grow during ordinary speech, and grow further for louder speech. Stop recording and confirm the timer and waveform disappear before transcription.

- [ ] **Step 4: Review the final diff**

```bash
git status --short
git diff --stat HEAD~3..HEAD
git log -4 --oneline
```

Expected: only the planned source, test, CSS, spec, and plan files are included; the pre-existing `next-env.d.ts` change remains untouched.
