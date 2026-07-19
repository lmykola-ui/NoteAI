"use client";

import { useEffect, useState } from "react";

type AppStatusProps = {
  onOnlineChange?(isOnline: boolean): void;
};

export function AppStatus({ onOnlineChange }: AppStatusProps) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);

    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

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
