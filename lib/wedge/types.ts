/** One recorded Wedgemaxx ball: the target the app called out, and the carry
 *  distance the player actually hit. Both in whole yards. */
export interface WedgeShot {
  targetDistance: number;
  carryDistance: number;
}

export interface WedgeShotResult extends WedgeShot {
  /** Signed error in yards: negative = short of the target, positive = long. */
  deltaYd: number;
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
   */
  averageBiasYd: number;
  /** Mean absolute error — raw distance-control spread. */
  averageAbsErrorYd: number;
  best: WedgeShotResult | null;
  worst: WedgeShotResult | null;
}
