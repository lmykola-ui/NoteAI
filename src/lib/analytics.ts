import { track } from "@vercel/analytics";

export type SafeEvent =
  | "capture_confirmed"
  | "parse_failed"
  | "transcription_failed";

/** Sends only the allowlisted event name. Never add properties or page context. */
export function trackSafeEvent(name: SafeEvent): void {
  if (process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true") track(name);
}
