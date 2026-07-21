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

it("eases a sudden loud sound instead of jumping to full height", () => {
  const loud = mapVoiceLevels(samplesWithDeviation(18), previous);

  expect(Math.max(...loud)).toBeLessThanOrEqual(0.3);
});
