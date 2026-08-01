import { describe, expect, it } from "vitest";
import { wedgeCareerStats } from "./career-stats";
import { sessionSummary } from "./engine";
import type { WedgeShot } from "./types";

function session(
  shots: WedgeShot[],
  status: "in_progress" | "complete" = "complete",
) {
  return { status, summary: sessionSummary(shots) };
}

/** n balls all missed by `miss` yards from `target`. */
function uniform(n: number, target: number, miss: number): WedgeShot[] {
  return Array.from({ length: n }, () => ({
    targetDistance: target,
    carryDistance: target - miss,
  }));
}

describe("wedgeCareerStats", () => {
  it("weights by ball, not by session", () => {
    // 40 balls at one standard, 10 at another. A per-session average would
    // weight these equally; per-ball gives the long session 4x the pull.
    const long = session(uniform(40, 100, 2));
    const short = session(uniform(10, 100, 20));
    const stats = wedgeCareerStats([long, short]);

    const expected =
      (long.summary.averagePoints * 40 + short.summary.averagePoints * 10) / 50;
    expect(stats.averagePoints).toBeCloseTo(expected, 8);

    // Sanity: it must sit nearer the 40-ball session than the midpoint.
    const naiveMean =
      (long.summary.averagePoints + short.summary.averagePoints) / 2;
    expect(stats.averagePoints).toBeGreaterThan(naiveMean);
  });

  it("counts balls and sessions", () => {
    const stats = wedgeCareerStats([
      session(uniform(12, 90, 3)),
      session(uniform(8, 120, 5)),
    ]);
    expect(stats.sessionsCompleted).toBe(2);
    expect(stats.ballsHit).toBe(20);
  });

  it("reports the best single session", () => {
    const good = session(uniform(10, 100, 1));
    const bad = session(uniform(10, 100, 25));
    const stats = wedgeCareerStats([bad, good]);
    expect(stats.bestSessionPoints).toBeCloseTo(good.summary.averagePoints, 8);
  });

  it("excludes in-progress and empty sessions", () => {
    const stats = wedgeCareerStats([
      session(uniform(10, 100, 2)),
      session(uniform(10, 100, 30), "in_progress"),
      session([]),
    ]);
    expect(stats.sessionsCompleted).toBe(1);
    expect(stats.ballsHit).toBe(10);
  });

  it("weights bias by struck balls so mishits never skew it", () => {
    // Session A: 4 balls, all 6 short. Session B: 2 struck (both 2 long) plus
    // 2 mishits. Bias must average the 6 struck balls, ignoring the mishits.
    const a = session(uniform(4, 100, 6));
    const b = session([
      { targetDistance: 100, carryDistance: 102 },
      { targetDistance: 100, carryDistance: 102 },
      { targetDistance: 100, carryDistance: null },
      { targetDistance: 100, carryDistance: null },
    ]);
    const stats = wedgeCareerStats([a, b]);
    expect(stats.averageBiasYd).toBeCloseTo((-6 * 4 + 2 * 2) / 6, 8);
    expect(stats.mishitRate).toBeCloseTo(2 / 8, 8);
  });

  it("handles a career of nothing but mishits without dividing by zero", () => {
    const stats = wedgeCareerStats([
      session([
        { targetDistance: 100, carryDistance: null },
        { targetDistance: 120, carryDistance: null },
      ]),
    ]);
    expect(stats.averageBiasYd).toBe(0);
    expect(stats.mishitRate).toBe(1);
    expect(Number.isFinite(stats.averagePoints)).toBe(true);
  });

  it("returns zeros with no completed sessions", () => {
    const stats = wedgeCareerStats([]);
    expect(stats.sessionsCompleted).toBe(0);
    expect(stats.averagePoints).toBe(0);
    expect(stats.bestSessionPoints).toBeNull();
  });
});
