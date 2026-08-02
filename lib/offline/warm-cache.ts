/**
 * Pre-fetch the pages you'd want offline, so the service worker has a
 * *document* cached for them.
 *
 * Why this is necessary: tapping a link is a client-side navigation, which
 * only caches an RSC payload. Those entries are keyed by a request carrying
 * `Next-Router-State-Tree`, and Next's `Vary` header includes it — so a
 * cached RSC entry only matches a navigation originating from the identical
 * router state, which almost never recurs. In practice RSC entries are
 * unusable for offline navigation.
 *
 * A *document* entry has no such problem: a plain fetch caches it under the
 * bare URL, and a full navigation later matches it. So while online we warm
 * the documents for the app shell and whatever page you're on, and the guard
 * hard-navigates to those when offline.
 */

/** The three tabs — the pages you'd reach for after relaunching offline. */
const SHELL_ROUTES = ["/feed", "/wedgemaxx", "/profile"];

/** Unauthenticated routes: warming from here would cache a redirect. */
const PUBLIC_ROUTES = new Set(["/", "/login", "/signup", "/nux"]);

export async function warmOfflineCache(currentPath: string): Promise<void> {
  if (typeof caches === "undefined") return;
  if (!navigator.onLine) return;
  // Only warm once we're inside the authenticated app, otherwise the fetches
  // follow a redirect to /login and we'd cache that under /feed.
  if (PUBLIC_ROUTES.has(currentPath)) return;

  const targets = new Set([...SHELL_ROUTES, currentPath]);
  for (const url of targets) {
    try {
      // Already have a document for it — nothing to do.
      if (await caches.match(url, { ignoreSearch: true })) continue;
      // A plain fetch (no RSC headers) is what gets cached under the bare URL.
      await fetch(url, { credentials: "same-origin" });
    } catch {
      // Offline or transient — it'll be retried on the next load.
    }
  }
}
