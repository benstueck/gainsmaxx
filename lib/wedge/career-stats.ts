import type { WedgeSessionSummary } from "./types";

export interface WedgeCareerStats {
  sessionsCompleted: number;
  ballsHit: number;
  /** Mean points per ball across every completed session. */
  averagePoints: number;
  /** Best single session's average, or null with no completed sessions. */
  bestSessionPoints: number | null;
  /** Mean signed error across struck balls — negative means short. */
  averageBiasYd: number;
  /** Mishits as a fraction of all balls hit (0–1). */
  mishitRate: number;
}

/**
 * Career Wedgemaxx numbers across completed sessions.
 *
 * Weighted **per ball**, not per session — the same reasoning as
 * `lib/career-stats.ts` weighting rounds by holes played. A 40-ball session is
 * four times the evidence of a 10-ball one, and averaging session averages
 * would let a short session swing the career figure just as hard as a long
 * one.
 */
export function wedgeCareerStats(
  sessions: {
    status: "in_progress" | "complete";
    summary: WedgeSessionSummary;
  }[],
): WedgeCareerStats {
  const played = sessions.filter(
    (s) => s.status === "complete" && s.summary.ballsHit > 0,
  );

  if (played.length === 0) {
    return {
      sessionsCompleted: 0,
      ballsHit: 0,
      averagePoints: 0,
      bestSessionPoints: null,
      averageBiasYd: 0,
      mishitRate: 0,
    };
  }

  const totalBalls = played.reduce((sum, s) => sum + s.summary.ballsHit, 0);
  const totalStruck = played.reduce((sum, s) => sum + s.summary.ballsStruck, 0);
  const totalPoints = played.reduce(
    (sum, s) => sum + s.summary.averagePoints * s.summary.ballsHit,
    0,
  );
  // Bias is a struck-ball statistic, so it carries its own denominator.
  const totalBias = played.reduce(
    (sum, s) => sum + s.summary.averageBiasYd * s.summary.ballsStruck,
    0,
  );
  const totalMishits = played.reduce(
    (sum, s) => sum + s.summary.mishitCount,
    0,
  );

  return {
    sessionsCompleted: played.length,
    ballsHit: totalBalls,
    averagePoints: totalPoints / totalBalls,
    bestSessionPoints: Math.max(...played.map((s) => s.summary.averagePoints)),
    averageBiasYd: totalStruck === 0 ? 0 : totalBias / totalStruck,
    mishitRate: totalMishits / totalBalls,
  };
}
