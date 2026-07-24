import { benchmarks } from "./data";
import type { BenchmarkPoint, Lie, SgCategory } from "./benchmarks.types";
import type {
  Baseline,
  CategoryTotals,
  HoleInput,
  HoleSummary,
  RoundSummary,
  ShotInput,
  ShotResult,
} from "./types";

const CATEGORIES: SgCategory[] = ["ott", "app", "arg", "putt"];

/** The 30-yard boundary (yards) separating around-the-green from approach. */
export const ARG_MAX_YARDS = 30;

function emptyTotals(): CategoryTotals {
  return { ott: 0, app: 0, arg: 0, putt: 0 };
}

/**
 * Linear interpolation over sorted [distance, value] points. Values are clamped
 * to the endpoints outside the covered range (no extrapolation).
 */
export function interpolate(points: BenchmarkPoint[], x: number): number {
  if (points.length === 0) throw new Error("interpolate: no points");
  const first = points[0];
  const last = points[points.length - 1];
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];

  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return last[1]; // unreachable given the guards above
}

/**
 * Tour expected strokes to hole out from a lie + distance. Distance is feet for
 * the green (putting), yards for every other lie.
 */
export function expectedStrokes(lie: Lie, distance: number): number {
  if (lie === "green") {
    return interpolate(benchmarks.tour.putting.green, distance);
  }
  return interpolate(benchmarks.tour.longGame.lies[lie], distance);
}

/**
 * Classify a shot by its starting position.
 * - green → putt
 * - tee → OTT (par 4/5) or APP (par-3 tee shot)
 * - other lies → ARG within 30 yд of the hole, else APP
 */
export function categorize(
  startLie: Lie,
  startDistanceYards: number,
  par: number,
): SgCategory {
  if (startLie === "green") return "putt";
  if (startLie === "tee") return par === 3 ? "app" : "ott";
  return startDistanceYards <= ARG_MAX_YARDS ? "arg" : "app";
}

/**
 * Strokes gained for a single shot vs the Tour baseline:
 *   SG = Exp(start) − Exp(end) − 1 − penaltyStrokes    (Exp(end) = 0 when holed)
 */
export function strokesGainedForShot(shot: ShotInput, par: number): ShotResult {
  const start = expectedStrokes(shot.startLie, shot.startDistance);
  const end =
    shot.isHoled || shot.endLie == null || shot.endDistance == null
      ? 0
      : expectedStrokes(shot.endLie, shot.endDistance);
  const sg = start - end - 1 - shot.penaltyStrokes;
  return { category: categorize(shot.startLie, shot.startDistance, par), sg };
}

/** Per-category SG (vs Tour) and score for one hole. */
export function holeStrokesGained(
  shots: ShotInput[],
  par: number,
): HoleSummary {
  const byCategory = emptyTotals();
  let score = 0;
  for (const shot of shots) {
    const { category, sg } = strokesGainedForShot(shot, par);
    byCategory[category] += sg;
    score += 1 + shot.penaltyStrokes;
  }
  const total = CATEGORIES.reduce((sum, c) => sum + byCategory[c], 0);
  return { byCategory, total, score };
}

/**
 * Handicap adjustment (strokes lost per 18 vs Tour, per category), interpolated
 * between the 5-stroke bracket levels and clamped to the table's range.
 */
export function handicapAdjustment(handicap: number): CategoryTotals {
  const { levels } = benchmarks.handicapAdjustments;
  const keys = Object.keys(levels)
    .map(Number)
    .sort((a, b) => a - b);
  const lo = keys[0];
  const hi = keys[keys.length - 1];
  const h = Math.max(lo, Math.min(hi, handicap));

  // Exact or bracketing levels.
  let lower = keys[0];
  let upper = keys[keys.length - 1];
  for (let i = 1; i < keys.length; i++) {
    if (h <= keys[i]) {
      lower = keys[i - 1];
      upper = keys[i];
      break;
    }
  }
  const a = levels[String(lower)];
  const b = levels[String(upper)];
  const t = upper === lower ? 0 : (h - lower) / (upper - lower);

  const out = emptyTotals();
  for (const c of CATEGORIES) out[c] = a[c] + t * (b[c] - a[c]);
  return out;
}

/**
 * Aggregate a round's SG. Per-shot SG is always vs Tour; a handicap baseline is
 * applied by adding back that handicap's expected per-round category loss,
 * scaled to the number of holes played (18-hole adjustment × holesPlayed / 18).
 * Holes with no shots are ignored.
 */
export function roundStrokesGained(
  holes: HoleInput[],
  baseline: Baseline,
): RoundSummary {
  const byCategory = emptyTotals();
  let score = 0;
  let parPlayed = 0;
  let holesPlayed = 0;

  for (const hole of holes) {
    if (hole.shots.length === 0) continue;
    const h = holeStrokesGained(hole.shots, hole.par);
    for (const c of CATEGORIES) byCategory[c] += h.byCategory[c];
    score += h.score;
    parPlayed += hole.par;
    holesPlayed += 1;
  }

  if (baseline !== "tour") {
    const adj = handicapAdjustment(baseline);
    const scale = holesPlayed / 18;
    for (const c of CATEGORIES) byCategory[c] += adj[c] * scale;
  }

  const teeToGreen = byCategory.ott + byCategory.app + byCategory.arg;
  const total = teeToGreen + byCategory.putt;
  return {
    byCategory,
    teeToGreen,
    total,
    score,
    toPar: score - parPlayed,
    holesPlayed,
    baseline,
  };
}
