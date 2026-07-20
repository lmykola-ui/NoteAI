"use client";

import { useEffect } from "react";
import { initializeSafeAnalytics } from "@/lib/analytics";

export function AnalyticsInitializer() {
  useEffect(() => {
    initializeSafeAnalytics();
  }, []);

  return null;
}
