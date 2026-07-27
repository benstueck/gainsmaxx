"use client";

import { useEffect } from "react";

/** Registers the service worker built from app/sw.ts (served via the
 *  app/serwist/[path] route) so the app becomes installable and its shell
 *  gets cached for offline use. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // The SW is served from /serwist/sw.js, so it defaults to that path as
    // its scope — widen it to the whole app (the route's response already
    // sends Service-Worker-Allowed: / to permit this).
    navigator.serviceWorker
      .register("/serwist/sw.js", { scope: "/" })
      .catch((err) => {
        console.error("Service worker registration failed:", err);
      });
  }, []);

  return null;
}
