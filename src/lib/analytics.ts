import {
  inject,
  track,
  type BeforeSendEvent,
} from "@vercel/analytics";

export type SafeEvent =
  | "capture_confirmed"
  | "parse_failed"
  | "transcription_failed";

const safeEvents = new Set<SafeEvent>([
  "capture_confirmed",
  "parse_failed",
  "transcription_failed",
]);

function analyticsEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true";
}

function removePageContext(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type === "pageview") return null;

  try {
    return { type: "event", url: new URL("/", event.url).href };
  } catch {
    return null;
  }
}

export function initializeSafeAnalytics(): void {
  if (!analyticsEnabled() || typeof window === "undefined") return;
  if (
    window.va &&
    document.head.querySelector('script[data-disable-auto-track="1"]')
  ) {
    return;
  }

  inject({
    framework: "next",
    disableAutoTrack: true,
    beforeSend: removePageContext,
  });
}

/** Sends only the allowlisted event name. Never add properties or page context. */
export function trackSafeEvent(name: SafeEvent): void {
  if (!analyticsEnabled() || !safeEvents.has(name)) return;
  initializeSafeAnalytics();
  track(name);
}
