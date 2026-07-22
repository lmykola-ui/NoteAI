"use client";

import { useEffect } from "react";

const shellCacheName = "noteai-shell-v2";
const publicAssetPaths = new Set(["/noteai-sw.js"]);

function isAllowedShellUrl(resourceUrl: string): boolean {
  const url = new URL(resourceUrl);
  return (
    url.origin === window.location.origin &&
    (url.pathname === "/" ||
      url.pathname.startsWith("/_next/static/") ||
      publicAssetPaths.has(url.pathname))
  );
}

async function cacheCurrentShell(): Promise<void> {
  const resourceUrls = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter(isAllowedShellUrl);
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
    if (process.env.NODE_ENV === "development") {
      void Promise.all([
        navigator.serviceWorker?.getRegistrations().then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        ),
        caches?.delete(shellCacheName),
      ]).then(() => {
        document.documentElement.dataset.offlineReady = "development";
      });
      return;
    }

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
