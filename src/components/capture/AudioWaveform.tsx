import type { CSSProperties } from "react";

type AudioWaveformProps = {
  levels: number[];
};

export function AudioWaveform({ levels }: AudioWaveformProps) {
  return (
    <div
      className="audio-waveform"
      data-testid="audio-waveform"
      aria-hidden="true"
    >
      {levels.map((level, index) => (
        <i
          key={index}
          style={
            {
              "--level": String(Math.max(0, Math.min(1, level))),
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
