import type { PuttSpec } from "./types";

/**
 * Read the pre-rolled sequence out of the `putts` jsonb column.
 *
 * This is the one place a `jsonb` column crosses into typed code. Postgres
 * guarantees the value is valid JSON and nothing whatsoever about its shape,
 * so a session written by an older build — or a hand-edited row — could hold
 * anything. Without this, a malformed entry surfaces as a crash mid-round on a
 * practice green, which is the worst possible moment.
 *
 * Unrecognised entries are dropped rather than rejecting the whole sequence:
 * one corrupt putt shouldn't cost the player the other seventeen. The caller
 * falls back to rolling a fresh putt for the gap.
 *
 * Lives here rather than beside the query that uses it because
 * `lib/db/putt-queries.ts` is `server-only`, which can't be imported under
 * vitest — the same reason `parseHandicapSnapshot` sits in `lib/baseline.ts`.
 */
export function parsePutts(value: unknown): PuttSpec[] {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is PuttSpec => {
    if (typeof p !== "object" || p === null) return false;
    const spec = p as Record<string, unknown>;
    return (
      typeof spec.distanceFt === "number" &&
      Number.isFinite(spec.distanceFt) &&
      (spec.elevation === "uphill" ||
        spec.elevation === "downhill" ||
        spec.elevation === "flat") &&
      (spec.breakDirection === "l2r" ||
        spec.breakDirection === "r2l" ||
        spec.breakDirection === "straight")
    );
  });
}
