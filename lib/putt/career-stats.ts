import { missSide } from "./engine";
import { detectBias, type BiasResult } from "./stats";
import type { PuttSessionSummary } from "./analytics";
import type { LineError, MissSide, SpeedError } from "./types";

export interface PuttCareerStats {
  sessionsCompleted: number;
  puttsHit: number;
  totalSg: number;
  /** Mean strokes gained per putt across every completed session. */
  averageSg: number;
  makePercent: number;
  threePuttRate: number;
  /** Best single session's SG per putt, or null with no completed sessions. */
  bestSessionSg: number | null;

  /**
   * Career tendencies — the numbers a single session usually can't support.
   *
   * This is where the significance gate finally has something to work with.
   * An 18-putt session yields ~10 misses, and at that size only a near-total
   * split clears the threshold, so within one session the gauges mostly read
   * "not enough data yet" — correctly, but unhelpfully. Pooled across
   * sessions a real tendency accumulates and a spurious one doesn't, which is
   * both the honest way to read a bias and the only way most players will
   * ever see one called.
   */
  directionBias: BiasResult<LineError>;
  readBias: BiasResult<MissSide>;
  speedBias: BiasResult<SpeedError>;
}

const EMPTY_BIAS = {
  direction: detectBias(["left", "right"] as const, [0, 0]),
  read: detectBias(["high", "low"] as const, [0, 0]),
  speed: detectBias(["fast", "slow"] as const, [0, 0]),
};

/**
 * Career Puttmaxx numbers across completed sessions.
 *
 * Weighted **per putt**, not per session — the same reasoning as
 * `wedgeCareerStats` weighting per ball. A 40-putt session is four times the
 * evidence of a 10-putt one, and averaging session averages would let a short
 * session swing the career figure just as hard as a long one.
 */
export function puttCareerStats(
  sessions: {
    status: "in_progress" | "complete";
    summary: PuttSessionSummary;
  }[],
): PuttCareerStats {
  const played = sessions.filter(
    (s) => s.status === "complete" && s.summary.attemptCount > 0,
  );

  if (played.length === 0) {
    return {
      sessionsCompleted: 0,
      puttsHit: 0,
      totalSg: 0,
      averageSg: 0,
      makePercent: 0,
      threePuttRate: 0,
      bestSessionSg: null,
      directionBias: EMPTY_BIAS.direction,
      readBias: EMPTY_BIAS.read,
      speedBias: EMPTY_BIAS.speed,
    };
  }

  const puttsHit = played.reduce((n, s) => n + s.summary.attemptCount, 0);
  const totalSg = played.reduce((n, s) => n + s.summary.totalSg, 0);
  const made = played.reduce((n, s) => n + s.summary.firstPuttsMade, 0);
  const threePutts = played.reduce((n, s) => n + s.summary.threePutts, 0);

  // Pool the raw attempts so the gates see every miss, not a mean of means.
  const attempts = played.flatMap((s) => s.summary.attempts);
  const count = <T>(xs: T[], v: T) => xs.filter((x) => x === v).length;

  // Flagged misreads are excluded from the stroke axes, as in summarizeSession:
  // a miss the player attributed to the read describes their green reading,
  // not their face angle.
  const lineErrors = [
    ...attempts.filter((a) => !a.misreadLine).map((a) => a.lineError),
    ...attempts.map((a) => a.comebackLineError),
  ].filter((e): e is LineError => e != null);
  const speedErrors = [
    ...attempts.filter((a) => !a.misreadSpeed).map((a) => a.speedError),
    ...attempts.map((a) => a.comebackSpeedError),
  ].filter((e): e is SpeedError => e != null);
  // Read stays first-putt-only: a comeback's break is inferred and tiny.
  const sides = attempts
    .map((a) => missSide(a.lineError, a.breakDirection))
    .filter((s): s is MissSide => s != null);

  return {
    sessionsCompleted: played.length,
    puttsHit,
    totalSg,
    averageSg: totalSg / puttsHit,
    makePercent: made / puttsHit,
    threePuttRate: threePutts / puttsHit,
    // Best session by SG **per putt**, so a long session isn't flattered by
    // sheer volume and a short hot streak isn't crowned on two putts.
    bestSessionSg: Math.max(
      ...played.map((s) => s.summary.totalSg / s.summary.attemptCount),
    ),
    directionBias: detectBias(["left", "right"] as const, [
      count(lineErrors, "left"),
      count(lineErrors, "right"),
    ]),
    readBias: detectBias(["high", "low"] as const, [
      count(sides, "high"),
      count(sides, "low"),
    ]),
    speedBias: detectBias(["fast", "slow"] as const, [
      count(speedErrors, "fast"),
      count(speedErrors, "slow"),
    ]),
  };
}
