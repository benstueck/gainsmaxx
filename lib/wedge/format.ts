/**
 * Display helpers shared by the Wedgemaxx surfaces.
 *
 * Lives in the pure engine rather than beside a component so a client
 * component can import it without reaching through a module that
 * transitively pulls in `server-only` (which would break the build the
 * moment that chain gained a value import).
 */

/** Compact session duration: "45s", "12m", "1h 05m". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** Running clock inside a session: "7:04". */
export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
