import type { CategoryTotals, SgCategory } from "@/lib/sg";
import type { FeedRound } from "@/lib/db/round-queries";

const CATEGORIES: SgCategory[] = ["ott", "app", "arg", "putt"];

export type CareerStats = {
  roundsPlayed: number;
  avgTotal: number;
  avgByCategory: CategoryTotals;
};

const HOLES_PER_ROUND = 18;

/**
 * Lightweight career averages across a user's completed rounds, vs whatever
 * baseline the rounds' summaries were computed against. Pure — no IO.
 *
 * Weighted by holes played rather than by round, then scaled to a per-18
 * rate: a 9-hole round naturally accumulates roughly half the raw SG of an
 * 18, so averaging round totals directly (equal weight per round) would
 * dilute the average toward zero for anyone who plays a mix of 9s and 18s.
 * Dividing by total holes played first treats a 9 as half a data point,
 * not a whole one.
 */
export function computeCareerStats(rounds: FeedRound[]): CareerStats {
  const played = rounds.filter(
    (r) => r.status === "complete" && r.summary.holesPlayed > 0,
  );

  if (played.length === 0) {
    return {
      roundsPlayed: 0,
      avgTotal: 0,
      avgByCategory: { ott: 0, app: 0, arg: 0, putt: 0 },
    };
  }

  const totalHoles = played.reduce((sum, r) => sum + r.summary.holesPlayed, 0);
  const perHoleRate = (sum: number) => (sum / totalHoles) * HOLES_PER_ROUND;

  const avgByCategory = CATEGORIES.reduce((acc, c) => {
    acc[c] = perHoleRate(
      played.reduce((sum, r) => sum + r.summary.byCategory[c], 0),
    );
    return acc;
  }, {} as CategoryTotals);

  const avgTotal = perHoleRate(
    played.reduce((sum, r) => sum + r.summary.total, 0),
  );

  return { roundsPlayed: played.length, avgTotal, avgByCategory };
}
