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

it("marks a fallback waveform and staggers its bars", () => {
  render(<AudioWaveform levels={[0.1, 0.2]} fallbackActive />);

  const waveform = screen.getByTestId("audio-waveform");
  const bars = waveform.querySelectorAll("i");
  expect(waveform).toHaveClass("is-fallback-active");
  expect(bars[0]).toHaveStyle("--bar-index: 0");
  expect(bars[1]).toHaveStyle("--bar-index: 1");
});
