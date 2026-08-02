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

import { isBlockedOffline } from "./routes";

/**
 * The pages you'd reach for after relaunching offline. Profile is absent on
 * purpose — it's mutation-only and blocked offline (see routes.ts), so
 * caching it would just be wasted work.
 */
const SHELL_ROUTES = ["/feed", "/wedgemaxx"];

/** Unauthenticated routes: warming from here would cache a redirect. */
const PUBLIC_ROUTES = new Set(["/", "/login", "/signup", "/nux"]);

export async function warmOfflineCache(currentPath: string): Promise<void> {
  if (typeof caches === "undefined") return;
  if (!navigator.onLine) return;
  // Only warm once we're inside the authenticated app, otherwise the fetches
  // follow a redirect to /login and we'd cache that under /feed.
  if (PUBLIC_ROUTES.has(currentPath)) return;

  // Don't warm the current page if it's one we'd refuse to open offline
  // anyway (e.g. sitting on /wedgemaxx/new when signal drops).
  const targets = new Set(SHELL_ROUTES);
  if (!isBlockedOffline(currentPath)) targets.add(currentPath);

  for (const url of targets) {
    try {
      // Deliberately NOT skipped when already cached. The list pages change
      // every time you start, finish or discard something, and a cached copy
      // is a snapshot from whenever it was warmed. Skipping meant that a
      // session created after the last warm was missing from the cached list,
      // so exiting it offline landed on a list that didn't contain it — with
      // no way back into the session. NetworkFirst overwrites the entry, so
      // re-fetching is what keeps the offline copy honest.
      await fetch(url, { credentials: "same-origin" });
    } catch {
      // Offline or transient — it'll be retried on the next load.
    }
  }
}
