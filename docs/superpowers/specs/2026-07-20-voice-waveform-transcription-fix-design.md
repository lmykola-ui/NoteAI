# Voice Waveform and Local Transcription Fix

Date: 2026-07-20
Status: Approved direction

## Goal

Make voice capture visibly active during every recording and restore successful transcription in the integrated local preview.

## Root causes

- The integrated preview runs from a Git worktree that does not contain the ignored root `.env`, so `/api/transcribe` returns `502` because the OpenAI configuration is absent.
- `VoiceRecorder` uses Web Audio for live amplitude. When that API is unavailable, it falls back to constant quiet levels, so the waveform is present but motionless.

## Recording behavior

- Keep the current Web Audio analyser as the preferred path.
- When Web Audio is available, bar heights continue to follow the measured microphone amplitude.
- When Web Audio is unavailable, switch to a deterministic animated fallback waveform with staggered bars. This fallback communicates active recording but does not claim to measure loudness.
- The fallback runs only while `MediaRecorder` is recording and stops immediately on stop, error, offline transition, disable, or unmount.
- With `prefers-reduced-motion: reduce`, keep the existing static quiet waveform and do not run continuous animation.

## Local transcription behavior

- Do not copy or commit `.env` secrets into the worktree.
- Restart the local preview with the existing root `.env` loaded into the process environment.
- Keep the current server-side `/api/transcribe` contract and generic client error handling unchanged.

## Accessibility and visuals

- Preserve the existing recording card, timer, stop button, and graphite palette.
- The fallback uses the same bars and restrained easing; it must not flash or introduce additional color.
- The waveform remains decorative and hidden from assistive technology because the textual recording state already communicates the status.

## Testing

- Add a failing recorder test proving that missing Web Audio activates the animated fallback.
- Add a failing test proving reduced-motion mode does not activate that fallback.
- Verify the existing real-level path and cleanup tests still pass.
- Run the complete unit suite, lint, typecheck, secret scan, and production build.
- Re-test the local microphone flow in the in-app preview after restarting it with the existing root environment.
