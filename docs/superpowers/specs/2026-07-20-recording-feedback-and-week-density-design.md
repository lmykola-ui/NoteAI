# Recording Feedback and Week Density Design

## Goal

Make recording feedback trustworthy and keep the weekly plan visually dense: show only scheduled days, display elapsed recording time, and make the waveform visibly react to the microphone signal.

## Scope

### Weekly plan

- In `week` mode, render a day group only when that date has at least one active task.
- Keep the existing seven-day window and task ordering.
- Keep the existing empty-week message when no active tasks exist in the full window.
- A rendered group continues to use `Сьогодні` for the current date and the localized date for other days.

### Recording timer

- Show an elapsed timer in the recording-card header, aligned opposite the red recording indicator.
- Start at `00:00` when `MediaRecorder.start()` succeeds.
- Update once per second and format as `MM:SS` for the existing recording limit.
- Reset the timer after stop, failure, discard, offline interruption, disable, or unmount.
- Keep the timer readable without making every tick intrusive to assistive technology.

### Voice-reactive waveform

- Use the real microphone stream through Web Audio when reduced motion is not requested.
- Replace the fixed low-sensitivity mapping with adaptive voice-level mapping that removes the current low-volume dead zone.
- Quiet input remains close to the minimum bar height; ordinary speech produces clear movement; louder speech produces taller bars without clipping the card.
- Smooth changes between frames so the waveform reacts quickly without flicker.
- The visual bars remain decorative for assistive technology.
- When Web Audio is unavailable or cannot resume, keep the existing fallback animation. Under reduced motion, keep the indicator static.

## Architecture

- `PlanScreen` derives non-empty day groups from the existing active week tasks before rendering.
- `VoiceRecorder` owns elapsed recording time because it already owns the recorder lifecycle and all cleanup paths.
- A small pure audio-level mapper converts time-domain samples plus previous bar levels into the next visual levels. `VoiceRecorder` uses it inside its animation loop, while unit tests verify silence, normal speech, loud speech, and clamping independently.
- `AudioWaveform` remains a presentational component that renders the supplied normalized levels.

## Error and lifecycle behavior

- Timer and waveform stop together before transcription begins.
- A delayed callback from an old recording session cannot update the current timer or waveform.
- Existing permission, offline, transcription, and auto-stop behavior remains unchanged.

## Accessibility and motion

- The visible timer uses tabular numerals to avoid layout movement.
- The recording card remains a status region, but timer ticks are not individually announced.
- Existing focus treatment, contrast, target sizes, and reduced-motion behavior remain unchanged.

## Testing

- `PlanScreen`: week mode renders groups only for dates containing active tasks.
- Audio-level mapper: silence stays low, speech moves the bars, louder samples create higher levels, and output stays within `0...1`.
- `VoiceRecorder`: timer starts at `00:00`, advances once per second, and resets on stop/discard.
- Existing recorder lifecycle, transcription, accessibility, lint, typecheck, and production-build checks continue to pass.
