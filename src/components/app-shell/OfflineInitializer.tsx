"use client";

import { useEffect } from "react";

const shellCacheName = "noteai-shell-v1";

async function cacheCurrentShell(): Promise<void> {
  const resourceUrls = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((resourceUrl) => {
      const url = new URL(resourceUrl);
      return (
        url.origin === window.location.origin &&
        !url.pathname.startsWith("/api/")
      );
    });
  const urls = [...new Set([window.location.origin + "/", ...resourceUrls])];
  const cache = await caches.open(shellCacheName);

  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "reload" });
        if (response.ok) await cache.put(url, response);
      } catch {
        // An already-cached shell remains usable when initialization runs offline.
      }
    }),
  );
}

export function OfflineInitializer() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("caches" in window)) {
      document.documentElement.dataset.offlineReady = "unsupported";
      return;
    }

    let initialization: Promise<void> | undefined;

    function initialize() {
      initialization ??= navigator.serviceWorker
        .register("/noteai-sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then(cacheCurrentShell)
        .then(() => {
          document.documentElement.dataset.offlineReady = "true";
        })
        .catch(() => {
          document.documentElement.dataset.offlineReady = "false";
        });
    }

    window.addEventListener("noteai:local-data-ready", initialize);
    if (navigator.serviceWorker.controller) initialize();

    return () => {
      window.removeEventListener("noteai:local-data-ready", initialize);
    };
  }, []);

  return null;
}
