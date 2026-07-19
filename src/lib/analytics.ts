import { track } from "@vercel/analytics";

export type SafeEvent =
  | "capture_confirmed"
  | "parse_failed"
  | "transcription_failed";

export function trackSafeEvent(name: SafeEvent): void {
  if (process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true") track(name);
}
