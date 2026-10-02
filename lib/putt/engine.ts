import { expectedStrokes } from "@/lib/sg";
import type {
  BreakDirection,
  Elevation,
  LineError,
  MissSide,
  PuttAttempt,
  PuttAttemptResult,
} from "./types";

/**
 * Expected putts to hole out from `distanceFt`, Tour baseline.
 *
 * Thin wrapper over the SG engine's green table, which means Puttmaxx needs no
 * calibration of its own: strokes gained falls straight out, and a session
 * total of 0.00 means you putted like a Tour pro.
 */
export function expectedPutts(distanceFt: number): number {
  return expectedStrokes("green", Math.max(0, distanceFt));
}

/**
 * Putts taken on the hole: 1 made, 2 comeback holed, 3 comeback missed.
 *
 * Derived rather than stored, so the rule can be corrected later without
 * rewriting history. Four-putts aren't representable — an accepted
 * simplification inside the ~15 ft this mode is built for.
 */
export function puttsTaken(attempt: PuttAttempt): number {
  if (attempt.made) return 1;
  return attempt.comebackMade === false ? 3 : 2;
}

/** Strokes gained for the hole: what it should have cost, minus what it did. */
export function holeSg(attempt: PuttAttempt): number {
  return expectedPutts(attempt.distanceFt) - puttsTaken(attempt);
}

/**
 * The first putt scored in isolation — the diagnostic number.
 *
 * Note this does NOT use the comeback's outcome, only where it left the ball:
 * holing a 6-footer you never should have faced doesn't make the first putt
 * any better.
 */
export function firstPuttSg(attempt: PuttAttempt): number {
  if (attempt.made) return expectedPutts(attempt.distanceFt) - 1;
  const leave = attempt.comebackDistanceFt ?? 0;
  return expectedPutts(attempt.distanceFt) - 1 - expectedPutts(leave);
}

/**
 * Which side of the hole a miss finished on, relative to the break.
 *
 * Low is the "amateur side" — where you finish when you under-read. On an L2R
 * putt the ball moves left to right, so the low side is the right; on an R2L
 * putt it's the left. Straight putts have no high/low, and a putt with no line
 * error didn't miss sideways at all.
 *
 * Derived, never stored: it's a pure function of the line error and the break,
 * and storing it would duplicate state that could drift out of sync.
 */
export function missSide(
  lineError: LineError | null,
  breakDirection: BreakDirection,
): MissSide | null {
  if (lineError == null || breakDirection === "straight") return null;
  if (breakDirection === "l2r") return lineError === "right" ? "low" : "high";
  return lineError === "left" ? "low" : "high";
}

/**
 * The comeback's read, inferred from the first putt.
 *
 * On a planar green a missed uphill-L2R putt leaves a roughly downhill-R2L
 * comeback. **Derived, never stored** — it's modelled on an assumption real
 * greens violate, and a modelled value sitting in a column is indistinguishable
 * from a measured one six months later.
 *
 * Returns null when the putt was holed, since there's no comeback to describe.
 */
export function comebackRead(
  attempt: PuttAttempt,
): { elevation: Elevation; breakDirection: BreakDirection } | null {
  if (attempt.made) return null;
  const flip = <T extends string>(v: T, a: T, b: T): T =>
    v === a ? b : v === b ? a : v;
  return {
    elevation: flip(attempt.elevation, "uphill", "downhill"),
    breakDirection: flip(attempt.breakDirection, "l2r", "r2l"),
  };
}

/** Score one hole, attaching every derived figure. */
export function scoreAttempt(attempt: PuttAttempt): PuttAttemptResult {
  return {
    ...attempt,
    puttsTaken: puttsTaken(attempt),
    holeSg: holeSg(attempt),
    firstPuttSg: firstPuttSg(attempt),
    missSide: missSide(attempt.lineError, attempt.breakDirection),
  };
}
