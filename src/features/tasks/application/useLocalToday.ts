"use client";

import { useEffect, useState } from "react";
import { toLocalDateKey } from "../domain/dateWindow";

export function millisecondsUntilNextLocalMidnight(now: Date): number {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return Math.max(1, nextMidnight.getTime() - now.getTime());
}

export function useLocalToday(): string {
  const [today, setToday] = useState(() => toLocalDateKey(new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    function reconcileAndSchedule() {
      const now = new Date();
      setToday(toLocalDateKey(now));
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(reconcileAndSchedule, millisecondsUntilNextLocalMidnight(now));
    }

    function reconcileWhenVisible() {
      if (document.visibilityState === "visible") reconcileAndSchedule();
    }

    reconcileAndSchedule();
    window.addEventListener("focus", reconcileAndSchedule);
    document.addEventListener("visibilitychange", reconcileWhenVisible);

    return () => {
      if (timer !== null) clearTimeout(timer);
      window.removeEventListener("focus", reconcileAndSchedule);
      document.removeEventListener("visibilitychange", reconcileWhenVisible);
    };
  }, []);

  return today;
}
