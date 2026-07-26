import type { CategoryTotals, SgCategory } from "@/lib/sg";
import type { FeedRound } from "@/lib/db/round-queries";

const CATEGORIES: SgCategory[] = ["ott", "app", "arg", "putt"];

export type CareerStats = {
  roundsPlayed: number;
  avgTotal: number;
  avgByCategory: CategoryTotals;
};

/**
 * Lightweight career averages across a user's completed rounds, vs whatever
 * baseline the rounds' summaries were computed against. Pure — no IO.
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

  const avgByCategory = CATEGORIES.reduce((acc, c) => {
    acc[c] =
      played.reduce((sum, r) => sum + r.summary.byCategory[c], 0) /
      played.length;
    return acc;
  }, {} as CategoryTotals);

  const avgTotal =
    played.reduce((sum, r) => sum + r.summary.total, 0) / played.length;

  return { roundsPlayed: played.length, avgTotal, avgByCategory };
}
