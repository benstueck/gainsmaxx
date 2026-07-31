/** One recorded Wedgemaxx ball: the target the app called out, and the carry
 *  distance the player actually hit. Both in whole yards. */
export interface WedgeShot {
  targetDistance: number;
  /**
   * Null marks a **mishit** (shank, top, duff) — there's no meaningful carry
   * to record, and often no way to measure one. Null is the single source of
   * truth for "this was a mishit", so a shot can never be in the
   * contradictory state of being flagged a mishit while carrying a distance.
   */
  carryDistance: number | null;
}

export interface WedgeShotResult extends WedgeShot {
  isMishit: boolean;
  /**
   * Signed error in yards: negative = short of the target, positive = long.
   * **Null for a mishit** — deliberately not 0, so it can't be silently
   * averaged into the distance-control stats.
   */
  deltaYd: number | null;
  /** Points for this ball. 100 = scratch-level distance control. */
  points: number;
}

export interface WedgeSessionSummary {
  shots: WedgeShotResult[];
  ballsHit: number;
  /** Mean points across the balls actually hit. 0 when none. */
  averagePoints: number;
  /**
   * Mean SIGNED error — the coachable number. Negative means you're
   * systematically leaving it short, positive means consistently long.
   * Distinct from averageAbsErrorYd, which measures spread rather than bias.
   *
   * Computed over **struck balls only**: a shank says nothing about your
   * distance calibration, and folding one in as a huge "short" miss would
   * poison the bias figure.
   */
  averageBiasYd: number;
  /** Mean absolute error — raw distance-control spread. Struck balls only. */
  averageAbsErrorYd: number;
  /** Balls struck (excludes mishits) — the denominator for bias/spread. */
  ballsStruck: number;
  mishitCount: number;
  /** Mishits as a fraction of balls hit (0–1) — a strike-quality metric. */
  mishitRate: number;
  best: WedgeShotResult | null;
  worst: WedgeShotResult | null;
}
