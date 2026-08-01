import { expectedStrokes } from "@/lib/sg";
import type { WedgeShot, WedgeShotResult, WedgeSessionSummary } from "./types";

/**
 * Wedgemaxx scoring engine — pure and dependency-free (only imports the
 * equally-pure SG engine) so it runs identically offline on the client and
 * on the server.
 *
 * READ plans/02-wedgemaxx.md BEFORE CHANGING ANY CONSTANT HERE. The
 * calibration is not arbitrary; each piece fixes a specific, verified defect
 * in the naive "points = 100 + 50 × SG" formulation.
 */

/** Score awarded for reference (PGA Tour average) distance control. */
export const BASE_POINTS = 100;

/**
 * Points per stroke gained. Purely an aesthetic knob: it scales the spread
 * of scores without changing signal-to-noise, so retune it freely. Points
 * are never persisted, so changing it re-scores all history consistently.
 */
export const POINTS_PER_STROKE = 50;

/**
 * Beyond this proximity the ball is no longer on the green. Matches the SG
 * engine's ARG_MAX_YARDS. Without the switch, the putting table's 90 ft
 * (= 30 yd) ceiling would score a 30-yard miss and a 40-yard chunk
 * identically. The two curves are nearly continuous here (green@90ft = 2.400
 * vs fairway@30yd = 2.500), so the transition costs ~5 points.
 */
const GREEN_RADIUS_YD = 30;

/**
 * A shot is never treated as holed. An exact carry would otherwise mean
 * proximity 0 → Exp(end) = 0, scoring ~194 while being one yard off scores
 * ~142 — a 52-point cliff on a single yard, which whole-yard entry would hit
 * often enough to dominate a session. Floored, a perfect number is a tap-in.
 */
const MIN_PROXIMITY_YD = 1;

/**
 * SG for a mishit (shank/top/duff): the ball makes **zero progress**, ending
 * as far from the pin as it started, so Exp(end) === Exp(start) and the shot
 * is worth exactly one wasted stroke.
 *
 * Stated explicitly rather than derived by passing carry = 0, which only
 * happens to give −1 while targets stay outside the 30-yard putting range.
 *
 * Two properties worth preserving if this is ever retuned:
 * - It lands ~41 points at every target, always BELOW the worst realistic
 *   distance miss, so marking a merely-bad shot as a mishit is never the
 *   cheap way out. The escape hatch can't be gamed.
 * - It costs ~1.5 points off a 40-ball average — noticeable, not ruinous.
 */
const MISHIT_SG = -1;

/** Mean radial miss of an isotropic 2-D Gaussian, in units of per-axis σ. */
const RAYLEIGH_MEAN = Math.sqrt(Math.PI / 2);

/** Mean absolute per-axis miss of a Gaussian, in units of σ. */
const HALF_NORMAL_MEAN = Math.sqrt(2 / Math.PI);

/**
 * Whose distance control scores exactly BASE_POINTS, as a multiple of tour
 * dispersion. 1.0 = **PGA Tour average is the anchor**, so breaking 100 means
 * out-controlling tour distance-wise — deliberately hard. (Originally 1.5,
 * anchoring on scratch, which real sessions showed was far too generous.)
 */
const REFERENCE_DISPERSION_MULTIPLIER = 1;

/** Expected strokes to hole out from `proxYd` yards from the pin. */
function endExpectedStrokes(proxYd: number): number {
  return proxYd <= GREEN_RADIUS_YD
    ? expectedStrokes("green", proxYd * 3)
    : expectedStrokes("fairway", proxYd);
}

/** Signed error in yards: negative = short, positive = long. Null for a mishit. */
export function shotDeltaYd(
  target: number,
  carry: number | null,
): number | null {
  return carry == null ? null : carry - target;
}

/** Distance from the pin used for scoring, floored so nothing ever holes out. */
export function shotProximityYd(target: number, carry: number): number {
  return Math.max(Math.abs(carry - target), MIN_PROXIMITY_YD);
}

/**
 * Raw strokes gained for the shot, treating all error as longitudinal (the
 * only dimension a range gives us). Start lie is always fairway.
 * A null carry means a mishit — see MISHIT_SG.
 */
export function wedgeShotSg(target: number, carry: number | null): number {
  if (carry == null) return MISHIT_SG;
  return (
    expectedStrokes("fairway", target) -
    endExpectedStrokes(shotProximityYd(target, carry)) -
    1
  );
}

/**
 * Tour-average TOTAL proximity for this target — the distance at which
 * wedgeShotSg is exactly 0. Implied by the SG table itself; no external
 * dataset needed. endExpectedStrokes is monotonic in proximity, so this
 * bisects cleanly.
 */
export function tourProximityYd(target: number): number {
  const needed = expectedStrokes("fairway", target) - 1;
  let lo = MIN_PROXIMITY_YD;
  let hi = 60;
  if (endExpectedStrokes(lo) >= needed) return lo;
  if (endExpectedStrokes(hi) <= needed) return hi;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (endExpectedStrokes(mid) < needed) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Tour's DISTANCE-ONLY error σ. Total proximity includes a lateral miss the
 * player physically cannot make on a range, so grading a 1-D outcome against
 * it flatters them. For an isotropic 2-D miss the mean radius is 1.253σ, so
 * σ = proximity / 1.253. Yields 2.4 yd @50 through 5.0 yd @140, matching
 * published 3–5 yd tour wedge dispersion.
 */
export function tourSigmaYd(target: number): number {
  return tourProximityYd(target) / RAYLEIGH_MEAN;
}

/** Mean absolute distance error a tour player would post at this target. */
export function tourDistanceErrorYd(target: number): number {
  return tourSigmaYd(target) * HALF_NORMAL_MEAN;
}

/** Expected value of wedgeShotSg for a player whose error is N(0, sigma). */
function expectedSgForSigma(target: number, sigma: number): number {
  const SAMPLES = 401;
  const span = 4 * sigma;
  const step = (2 * span) / (SAMPLES - 1);
  let weighted = 0;
  let weight = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const e = -span + i * step;
    const w = Math.exp((-e * e) / (2 * sigma * sigma));
    weighted += w * wedgeShotSg(target, target + e);
    weight += w;
  }
  return weighted / weight;
}

/**
 * The per-target reference: expected SG of a TOUR-average player here.
 * Because the points curve is convex, a player's session average sits ~7
 * points above their score at their average error — so the anchor has to be
 * an expectation over the whole error distribution, not the score at the mean
 * error. With this, tour averages exactly BASE_POINTS at every target by
 * linearity of expectation.
 *
 * Memoized per whole yard: the integration is far too slow to redo per shot.
 */
const referenceCache = new Map<number, number>();
export function referenceSg(target: number): number {
  const key = Math.round(target);
  const cached = referenceCache.get(key);
  if (cached !== undefined) return cached;
  const value = expectedSgForSigma(
    key,
    tourSigmaYd(key) * REFERENCE_DISPERSION_MULTIPLIER,
  );
  referenceCache.set(key, value);
  return value;
}

/** Points for one ball. 100 = scratch-level control, at every target. */
export function wedgeShotPoints(target: number, carry: number | null): number {
  return (
    BASE_POINTS +
    POINTS_PER_STROKE * (wedgeShotSg(target, carry) - referenceSg(target))
  );
}

export function scoreShot(shot: WedgeShot): WedgeShotResult {
  const { targetDistance, carryDistance } = shot;
  return {
    targetDistance,
    carryDistance,
    isMishit: carryDistance == null,
    deltaYd: shotDeltaYd(targetDistance, carryDistance),
    points: wedgeShotPoints(targetDistance, carryDistance),
  };
}

export function sessionSummary(shots: WedgeShot[]): WedgeSessionSummary {
  const scored = shots.map(scoreShot);
  if (scored.length === 0) {
    return {
      shots: scored,
      ballsHit: 0,
      averagePoints: 0,
      averageBiasYd: 0,
      averageAbsErrorYd: 0,
      ballsStruck: 0,
      mishitCount: 0,
      mishitRate: 0,
      best: null,
      worst: null,
    };
  }

  const n = scored.length;
  // Bias and spread describe distance CONTROL, so they're over struck balls
  // only — a shank carries no information about calibration.
  const struck = scored.filter(
    (s): s is WedgeShotResult & { deltaYd: number } => s.deltaYd != null,
  );
  const mean = (values: number[]) =>
    values.length === 0
      ? 0
      : values.reduce((acc, v) => acc + v, 0) / values.length;

  return {
    shots: scored,
    ballsHit: n,
    averagePoints: mean(scored.map((s) => s.points)),
    averageBiasYd: mean(struck.map((s) => s.deltaYd)),
    averageAbsErrorYd: mean(struck.map((s) => Math.abs(s.deltaYd))),
    ballsStruck: struck.length,
    mishitCount: n - struck.length,
    mishitRate: (n - struck.length) / n,
    best: scored.reduce((a, b) => (b.points > a.points ? b : a)),
    worst: scored.reduce((a, b) => (b.points < a.points ? b : a)),
  };
}

/**
 * Next target yardage: a uniform whole yard in [min, max] that is never the
 * immediately-preceding target (so a rep never feels wasted). `random` is
 * injectable purely so tests can be deterministic.
 */
export function nextTarget(
  min: number,
  max: number,
  previous: number | null,
  random: () => number = Math.random,
): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  const span = hi - lo + 1;
  if (span <= 1) return lo;

  const excludes = previous != null && previous >= lo && previous <= hi;
  if (!excludes) {
    return lo + Math.min(span - 1, Math.floor(random() * span));
  }
  // Draw from the span minus the excluded value, then skip over it.
  const pick = lo + Math.min(span - 2, Math.floor(random() * (span - 1)));
  return pick >= previous ? pick + 1 : pick;
}
