import type { CSSProperties } from "react";

type AudioWaveformProps = {
  levels: number[];
  fallbackActive?: boolean;
};

export function AudioWaveform({
  levels,
  fallbackActive = false,
}: AudioWaveformProps) {
  return (
    <div
      className={`audio-waveform${fallbackActive ? " is-fallback-active" : ""}`}
      data-testid="audio-waveform"
      aria-hidden="true"
    >
      {levels.map((level, index) => {
        const centerWeight =
          1 -
          Math.abs(index - (levels.length - 1) / 2) /
            Math.max(1, levels.length / 2);
        return (
          <i
            key={index}
            style={
              {
                "--level": String(Math.max(0, Math.min(1, level))),
                "--bar-index": index,
                "--fallback-delay": `${index * -67}ms`,
                "--fallback-duration": `${760 + (index % 4) * 70}ms`,
                "--fallback-peak": String(1.8 + centerWeight * 4.6),
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
