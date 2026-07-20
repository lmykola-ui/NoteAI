import { render, screen } from "@testing-library/react";
import { AudioWaveform } from "./AudioWaveform";

it("renders clamped level bars hidden from assistive technology", () => {
  render(<AudioWaveform levels={[0, 0.25, 1, 2]} />);

  const waveform = screen.getByTestId("audio-waveform");
  const bars = waveform.querySelectorAll("i");
  expect(waveform).toHaveAttribute("aria-hidden", "true");
  expect(bars).toHaveLength(4);
  expect(bars[0]).toHaveStyle("--level: 0");
  expect(bars[3]).toHaveStyle("--level: 1");
});
