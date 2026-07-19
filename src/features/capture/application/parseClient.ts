import type { InputMethod, ParseResult } from "@/features/tasks/domain/task";
import {
  assertOnline,
  beginOnlineRequest,
  isOnlineNow,
  OfflineError,
} from "@/lib/connectivity";

export async function parseText(input: {
  text: string;
  today: string;
  timeZone: string;
  inputMethod: InputMethod;
}): Promise<ParseResult> {
  const onlineRequest = beginOnlineRequest();
  try {
    assertOnline();
    const response = await fetch("/api/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: onlineRequest.signal,
    });
    assertOnline();

    if (!response.ok) throw new Error("AI_UNAVAILABLE");

    const result = (await response.json()) as ParseResult;
    assertOnline();
    return result;
  } catch (error) {
    if (onlineRequest.signal.aborted || !isOnlineNow()) {
      throw new OfflineError();
    }
    throw error;
  } finally {
    onlineRequest.finish();
  }
}
