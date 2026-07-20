# Voice Waveform and Local Transcription Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the recording waveform visibly active when Web Audio is unavailable and restore local transcription in the integrated preview.

**Architecture:** `VoiceRecorder` selects one of three visualizer modes: measured live levels, animated fallback, or reduced-motion static. `AudioWaveform` owns only the visual class and stagger variables. Local secrets remain outside Git; the preview process loads the existing root `.env` at startup.

**Tech Stack:** React 19, TypeScript, CSS animations, Vitest, Testing Library, Next.js 16.

## Global Constraints

- Preserve the current recording card, timer, stop button, graphite palette, and API contracts.
- Do not copy or commit `.env` secrets into the worktree.
- The animated fallback runs only while recording and only when Web Audio is unavailable.
- `prefers-reduced-motion: reduce` keeps a static waveform.

---

### Task 1: Recording waveform fallback

**Files:**
- Modify: `src/components/capture/VoiceRecorder.tsx`
- Modify: `src/components/capture/AudioWaveform.tsx`
- Modify: `src/app/globals.css`
- Test: `src/components/capture/VoiceRecorder.test.tsx`
- Test: `src/components/capture/AudioWaveform.test.tsx`

**Interfaces:**
- Consumes: `AudioWaveform({ levels })` and the existing `RecordingSession` lifecycle.
- Produces: `AudioWaveform({ levels, fallbackActive?: boolean })` and `VisualizerMode = "static" | "live" | "fallback"` inside `VoiceRecorder`.

- [ ] **Step 1: Write failing behavior tests**

Add assertions that a recording without `window.AudioContext` renders `data-testid="audio-waveform"` with `is-fallback-active`, while reduced-motion mode renders the waveform without that class. Add a component test proving `fallbackActive` produces the class and stagger variables.

```tsx
expect(screen.getByTestId("audio-waveform")).toHaveClass(
  "is-fallback-active",
);
expect(screen.getByTestId("audio-waveform")).not.toHaveClass(
  "is-fallback-active",
);
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
env PATH=/Users/nick/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin ./node_modules/.bin/vitest run src/components/capture/VoiceRecorder.test.tsx src/components/capture/AudioWaveform.test.tsx
```

Expected: FAIL because the waveform never exposes `is-fallback-active`.

- [ ] **Step 3: Implement the minimal visualizer modes**

In `VoiceRecorder`, initialize `visualizerMode` as `"static"`. In `startAudioAnalysis`, select `"static"` for reduced motion, `"fallback"` when `window.AudioContext` is absent, and `"live"` before starting analyser sampling. Reset to `"static"` during session cleanup. Render:

```tsx
<AudioWaveform
  levels={levels}
  fallbackActive={visualizerMode === "fallback"}
/>
```

In `AudioWaveform`, add the fallback class and `--bar-index`:

```tsx
className={`audio-waveform${fallbackActive ? " is-fallback-active" : ""}`}
style={{ "--bar-index": index } as CSSProperties}
```

Add restrained staggered keyframes only for `.is-fallback-active i`; the existing reduced-motion media query remains authoritative.

- [ ] **Step 4: Run focused tests to verify GREEN**

Run the command from Step 2.

Expected: both test files pass.

- [ ] **Step 5: Commit the waveform fix**

```bash
git add src/components/capture/VoiceRecorder.tsx src/components/capture/VoiceRecorder.test.tsx src/components/capture/AudioWaveform.tsx src/components/capture/AudioWaveform.test.tsx src/app/globals.css
git commit -m "fix: animate recording waveform fallback"
```

### Task 2: Restore and verify local transcription

**Files:**
- No tracked source changes.

**Interfaces:**
- Consumes: `/Users/nick/Documents/NoteAI/.env` as local process environment.
- Produces: the existing `POST /api/transcribe` behavior in the integrated preview at `http://localhost:61623/`.

- [ ] **Step 1: Stop the current preview process**

Stop the existing Next.js dev session on port `61623` so it cannot retain the missing environment.

- [ ] **Step 2: Restart without copying secrets**

Start the preview from the integrated worktree while loading `/Users/nick/Documents/NoteAI/.env` into that process only. Do not print the values and do not create a worktree `.env` file.

- [ ] **Step 3: Run full verification**

Run:

```bash
env PATH=/Users/nick/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin ./node_modules/.bin/vitest run
env PATH=/Users/nick/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin ./node_modules/.bin/eslint .
env PATH=/Users/nick/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin ./node_modules/.bin/tsc --noEmit
env PATH=/Users/nick/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin ./node_modules/.bin/next build
```

Expected: all tests pass, lint and typecheck exit `0`, and Next.js reports a successful production build.

- [ ] **Step 4: Re-test the microphone flow**

In the in-app preview, confirm that bars move throughout recording, stop when recording stops, and successful transcription populates the editable transcript. Because microphone amplitude is user-observable, ask the user to confirm that the bars react to quiet speech and louder speech.
