import type { CSSProperties } from "react";

type AudioWaveformProps = {
  levels: number[];
  fallbackActive?: boolean;
};

function waveformMetrics(level: number) {
  const quietThreshold = 0.06;
  const normalized = Math.max(0, Math.min(1, (level - quietThreshold) / 0.6));
  const height = 5 + Math.pow(normalized, 0.65) * 27;
  return {
    height: `${height.toFixed(2)}px`,
    scale: (height / 32).toFixed(4),
  };
}

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
        const metrics = waveformMetrics(level);
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
                "--height": metrics.height,
                "--scale": metrics.scale,
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
