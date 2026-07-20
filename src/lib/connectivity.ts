type OnlineStatusListener = () => void;

let eventStatus: boolean | undefined;

function browserReportsOnline(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.onLine !== false;
}

function rememberEventStatus(isOnline: boolean) {
  eventStatus = isOnline;
  queueMicrotask(() => {
    eventStatus = undefined;
  });
}

export function isOnlineNow(): boolean {
  return eventStatus ?? browserReportsOnline();
}

export function subscribeToOnlineStatus(
  listener: OnlineStatusListener,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handleOnline = () => {
    rememberEventStatus(true);
    listener();
  };
  const handleOffline = () => {
    rememberEventStatus(false);
    listener();
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

export class OfflineError extends Error {
  constructor() {
    super("OFFLINE");
    this.name = "OfflineError";
  }
}

export function assertOnline(): void {
  if (!isOnlineNow()) throw new OfflineError();
}

export function isOfflineError(error: unknown): error is OfflineError {
  return error instanceof OfflineError;
}

export function beginOnlineRequest(): {
  signal: AbortSignal;
  finish(): void;
} {
  assertOnline();
  const controller = new AbortController();
  const abort = () => controller.abort(new OfflineError());

  if (typeof window !== "undefined") {
    window.addEventListener("offline", abort);
  }
  if (!isOnlineNow()) abort();

  return {
    signal: controller.signal,
    finish() {
      if (typeof window !== "undefined") {
        window.removeEventListener("offline", abort);
      }
    },
  };
}
