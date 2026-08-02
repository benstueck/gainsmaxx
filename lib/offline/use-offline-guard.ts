"use client";

import { useCallback, useState } from "react";
import { isBlockedOffline } from "./routes";

/**
 * Can the service worker actually serve this page offline?
 *
 * Deliberately a *strict* match (no `ignoreVary`), because it must answer the
 * narrow question "is there a cached DOCUMENT for this URL", which is the only
 * thing a full navigation can use.
 *
 * `ignoreVary` was tried and is wrong here: it also matches RSC entries, which
 * are keyed by a request carrying `Next-Router-State-Tree` (covered by Next's
 * `Vary`). Those effectively never match a later navigation, so treating one
 * as "cached" sends the user to the offline dead-end page. Documents are
 * warmed ahead of time instead — see warm-cache.ts.
 */
async function hasCachedDocument(href: string): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    const hit = await caches.match(href, { ignoreSearch: true });
    return hit != null;
  } catch {
    return false;
  }
}

/**
 * Guards navigations and server-backed actions while offline.
 *
 * Navigations proceed when a cached document exists and are blocked with an
 * explanatory modal when one doesn't. Actions (deletes, finishes) are always
 * blocked offline — a cache can't help a mutation.
 */
export function useOfflineGuard() {
  const [blocked, setBlocked] = useState(false);

  const guardClick = useCallback((e: React.MouseEvent) => {
    if (navigator.onLine) return;
    // The decision is async, so cancel the default navigation either way and
    // re-issue it ourselves once we know.
    e.preventDefault();
    const href = e.currentTarget.getAttribute("href");
    void (async () => {
      // Mutation-only routes are blocked even when cached — rendering the
      // form would just lead to a save that can't succeed.
      if (href && !isBlockedOffline(href) && (await hasCachedDocument(href))) {
        // A full navigation, not the client router: the router would fetch an
        // RSC payload that won't match any cached entry offline, and Next
        // recovers from that failure with a hard reload straight into the
        // dead-end page.
        window.location.href = href;
        return;
      }
      setBlocked(true);
    })();
  }, []);

  const guard = useCallback((action: () => void) => {
    if (!navigator.onLine) {
      setBlocked(true);
      return;
    }
    action();
  }, []);

  return { blocked, dismiss: () => setBlocked(false), guardClick, guard };
}
