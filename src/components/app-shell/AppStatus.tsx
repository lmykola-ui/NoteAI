"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  isOnlineNow,
  subscribeToOnlineStatus,
} from "@/lib/connectivity";

type AppStatusProps = {
  isOnline?: boolean;
  onOnlineChange?(isOnline: boolean): void;
};

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeToOnlineStatus, isOnlineNow, () => false);
}

export function AppStatus({
  isOnline: suppliedOnlineStatus,
  onOnlineChange,
}: AppStatusProps) {
  const observedOnlineStatus = useOnlineStatus();
  const isOnline = suppliedOnlineStatus ?? observedOnlineStatus;

  useEffect(() => {
    onOnlineChange?.(isOnline);
  }, [isOnline, onOnlineChange]);

  if (isOnline) return null;

  return (
    <p role="status" className="app-status">
      Офлайн: локальні задачі доступні, AI тимчасово не працює
    </p>
  );
}
