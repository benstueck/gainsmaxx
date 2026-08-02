/**
 * Routes that must never be entered while offline, regardless of whether a
 * document happens to be cached.
 *
 * A cached page is only useful if you can actually *do* something on it.
 * These exist purely to perform a server mutation — creating a round or
 * session, or saving profile settings — so reaching them offline just walks
 * the user into a failed save. Blocking at the navigation is honest: the
 * modal explains why, instead of letting them fill in a form that can't
 * submit.
 *
 * Note this is deliberately separate from the cache check. Being cached is
 * about *can* we render it; this is about *should* we.
 */
const OFFLINE_BLOCKED_PATHS = new Set([
  "/profile",
  "/wedgemaxx/new",
  "/round/new",
]);

export function isBlockedOffline(path: string): boolean {
  // Ignore any query string — /round/new?foo is still /round/new.
  const [pathname] = path.split("?");
  return OFFLINE_BLOCKED_PATHS.has(pathname);
}
