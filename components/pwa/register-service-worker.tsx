"use client";

import { useEffect } from "react";
import { flushAllDrafts } from "@/lib/offline/round-sync";
import { flushAllWedgeDrafts } from "@/lib/offline/wedge-sync";

/** Registers the service worker built from app/sw.ts (served via the
 *  app/serwist/[path] route) so the app becomes installable and its shell
 *  gets cached for offline use. Also opportunistically flushes any queued
 *  offline drafts — rounds and Wedgemaxx sessions alike — the safety net for
 *  a draft left behind when its own page never got reopened (e.g. the app
 *  relaunched straight into Feed instead of the in-progress round). */
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

  useEffect(() => {
    const flush = () => {
      void flushAllDrafts();
      void flushAllWedgeDrafts();
    };
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);

  return null;
}
