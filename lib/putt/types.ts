/** Which way the putt breaks, as the player looks at it. */
export type BreakDirection = "l2r" | "r2l" | "straight";

/** Slope along the line of the putt. */
export type Elevation = "uphill" | "downhill" | "flat";

/** Speed component of a miss. Null means the pace was right. */
export type SpeedError = "fast" | "slow";

/** Line component of a miss, in absolute terms. Null means the line was right. */
export type LineError = "left" | "right";

/**
 * Which side of the hole a miss finished on, relative to the break.
 *
 * The "low" side is the amateur side — where the ball ends up when you don't
 * play enough break. Deliberately distinct from LineError: left/right measures
 * the *stroke*, high/low measures the *read*, and conflating them cancels out
 * the commonest fault in amateur putting (see plans/03-puttmaxx.md).
 */
export type MissSide = "high" | "low";

/** One putt the app called out: distance in whole feet, plus the read. */
export interface PuttSpec {
  distanceFt: number;
  elevation: Elevation;
  breakDirection: BreakDirection;
}

/**
 * One recorded hole: the first putt, and — when it missed — the comeback.
 *
 * The comeback is captured on the same 3×3 grid as the first putt rather than
 * a yes/no, because it's a putt and therefore a data point. At 1–5 ft there's
 * almost no break to misread, which makes comebacks the *cleanest* read of
 * face angle in the session, not contamination.
 */
export interface PuttAttempt extends PuttSpec {
  made: boolean;
  speedError: SpeedError | null;
  lineError: LineError | null;
  /** Self-reported: "I read the line wrong", as distinct from stroking it badly. */
  misreadLine: boolean;
  misreadSpeed: boolean;

  /** Null when the first putt dropped. Whole feet. */
  comebackDistanceFt: number | null;
  /** Null when there was no comeback. */
  comebackMade: boolean | null;
  comebackSpeedError: SpeedError | null;
  comebackLineError: LineError | null;
}

export interface PuttAttemptResult extends PuttAttempt {
  /** 1, 2 or 3 — derived from the outcomes, never stored. */
  puttsTaken: number;
  /** expectedPutts(distance) − puttsTaken. The hole's strokes gained. */
  holeSg: number;
  /**
   * The first putt scored on its own:
   *   expectedPutts(distance) − 1 − expectedPutts(comeback)
   *
   * Separates a miss that leaves a tap-in from one that runs 6 ft past — the
   * same "2 putts" to the hole score, but nothing like the same stroke. The
   * direct analogue of proximity in Wedgemaxx.
   */
  firstPuttSg: number;
  /** Which side of the hole the first putt missed on, relative to the break. */
  missSide: MissSide | null;
}
