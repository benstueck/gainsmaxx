"use client";

import { useCallback, useState } from "react";

/**
 * Is there a cached copy of this page the service worker could serve?
 *
 * This is what makes an offline navigation safe to allow. Blocking purely on
 * `navigator.onLine` is too blunt — it stops you reaching pages that ARE
 * cached — while allowing everything is too loose, because landing on an
 * uncached page offline is a dead end with no navigation out of it.
 */
async function hasCachedCopy(href: string): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    // ignoreSearch so /wedgemaxx?foo still matches the cached /wedgemaxx.
    const hit = await caches.match(href, { ignoreSearch: true });
    return hit != null;
  } catch {
    return false;
  }
}

/**
 * Guards navigations and server-backed actions while offline.
 *
 * Navigations are allowed through when the destination is already in the
 * service worker's cache, and blocked with an explanatory modal when it
 * isn't. Actions (deletes, finishes) are always blocked offline — a cache
 * can't help a mutation.
 */
export function useOfflineGuard() {
  const [blocked, setBlocked] = useState(false);

  const guardClick = useCallback((e: React.MouseEvent) => {
    if (navigator.onLine) return;
    // Decide asynchronously, so cancel the default navigation either way and
    // re-issue it ourselves if the page turns out to be cached.
    e.preventDefault();
    const href = e.currentTarget.getAttribute("href");
    void (async () => {
      if (href && (await hasCachedCopy(href))) {
        // A full navigation rather than the client router: the router would
        // fetch an RSC payload that may not be cached even when the document
        // is, whereas the service worker can serve this straight from the
        // pages cache.
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
