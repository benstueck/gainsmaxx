import type { Lie, SgCategory } from "./benchmarks.types";

export type { Lie, SgCategory } from "./benchmarks.types";

/**
 * Baseline a round's SG is measured against.
 * - "tour" → raw expected-strokes (no adjustment)
 * - a number → handicap index (interpolated between the 5-stroke brackets)
 */
export type Baseline = "tour" | number;

/** One recorded stroke. Distances are in the lie's natural unit: feet on the
 *  green, yards elsewhere. `endLie`/`endDistance` are null when the ball is holed. */
export interface ShotInput {
  startLie: Lie;
  startDistance: number;
  endLie: Lie | null;
  endDistance: number | null;
  isHoled: boolean;
  /** 0 = none, 1 = penalty drop, 2 = OOB / stroke-and-distance. */
  penaltyStrokes: number;
}

/** A hole's shots plus its par (needed to classify tee shots). */
export interface HoleInput {
  par: number;
  shots: ShotInput[];
}

/** SG split by the four categories. */
export type CategoryTotals = Record<SgCategory, number>;

export interface ShotResult {
  category: SgCategory;
  /** Strokes gained vs the Tour baseline. */
  sg: number;
}

export interface HoleSummary {
  byCategory: CategoryTotals;
  /** OTT + APP + ARG + Putting, vs Tour. */
  total: number;
  /** Strokes taken on the hole (entries + penalty strokes). */
  score: number;
}

export interface RoundSummary {
  byCategory: CategoryTotals;
  teeToGreen: number;
  total: number;
  score: number;
  /** score − par over the holes actually played. */
  toPar: number;
  holesPlayed: number;
  baseline: Baseline;
}
