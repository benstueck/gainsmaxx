import { describe, expect, it } from "vitest";
import { computeCareerStats } from "@/lib/career-stats";
import type { FeedRound } from "@/lib/db/round-queries";

function round(
  holesPlayed: number,
  total: number,
  overrides: Partial<FeedRound> = {},
): FeedRound {
  return {
    id: crypto.randomUUID(),
    playedAt: new Date().toISOString(),
    courseName: null,
    numHoles: holesPlayed,
    status: "complete",
    summary: {
      byCategory: {
        ott: total / 4,
        app: total / 4,
        arg: total / 4,
        putt: total / 4,
      },
      teeToGreen: (total / 4) * 3,
      total,
      score: 0,
      toPar: 0,
      holesPlayed,
      baseline: "tour",
    },
    ...overrides,
  };
}

describe("computeCareerStats", () => {
  it("weights by holes played, not equally per round", () => {
    // An 18 at +4 and a 9 at +1: naive per-round averaging gives (4+1)/2 =
    // 2.5. Holes-weighted gives (4+1)/27 holes * 18 ≈ 3.33 — the 9 pulls
    // the average down by half as much as an equally-good/bad 18 would.
    const stats = computeCareerStats([round(18, 4), round(9, 1)]);
    expect(stats.avgTotal).toBeCloseTo((5 / 27) * 18, 5);
    expect(stats.avgTotal).not.toBeCloseTo(2.5, 1);
  });

  it("matches a simple per-round average when all rounds are 18 holes", () => {
    const stats = computeCareerStats([
      round(18, 2),
      round(18, -1),
      round(18, 4),
    ]);
    expect(stats.avgTotal).toBeCloseTo((2 - 1 + 4) / 3, 5);
  });

  it("ignores in-progress rounds and rounds with no holes played", () => {
    const stats = computeCareerStats([
      round(18, 4),
      round(9, 1, { status: "in_progress" }),
      round(0, 0),
    ]);
    expect(stats.roundsPlayed).toBe(1);
    expect(stats.avgTotal).toBeCloseTo(4, 5);
  });

  it("returns zeros with no completed rounds", () => {
    const stats = computeCareerStats([]);
    expect(stats.roundsPlayed).toBe(0);
    expect(stats.avgTotal).toBe(0);
    expect(stats.avgByCategory).toEqual({ ott: 0, app: 0, arg: 0, putt: 0 });
  });
});
