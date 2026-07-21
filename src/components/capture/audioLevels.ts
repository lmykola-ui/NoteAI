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
    const centerWeight =
      1 - Math.abs(index - middle) / Math.max(1, middle + 2);
    const target = Math.min(
      1,
      MIN_LEVEL + voiceLevel * centerWeight * 0.94,
    );
    const smoothing = target > previous ? 0.24 : 0.12;
    return Math.max(
      0,
      Math.min(1, previous + (target - previous) * smoothing),
    );
  });
}
