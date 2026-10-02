import { describe, expect, it } from "vitest";
import { puttCareerStats } from "./career-stats";
import { summarizeSession } from "./analytics";
import type { BreakDirection, LineError, PuttAttempt } from "./types";

function putt(over: Partial<PuttAttempt> = {}): PuttAttempt {
  return {
    distanceFt: 8,
    elevation: "flat",
    breakDirection: "straight",
    made: false,
    speedError: null,
    lineError: null,
    misreadLine: false,
    misreadSpeed: false,
    comebackDistanceFt: null,
    comebackMade: null,
    comebackSpeedError: null,
    comebackLineError: null,
    ...over,
  };
}
const made = (o: Partial<PuttAttempt> = {}) => putt({ made: true, ...o });
const missed = (
  line: LineError | null,
  brk: BreakDirection = "straight",
  o: Partial<PuttAttempt> = {},
) =>
  putt({
    lineError: line,
    breakDirection: brk,
    comebackDistanceFt: 2,
    comebackMade: true,
    ...o,
  });

const session = (
  attempts: PuttAttempt[],
  status: "in_progress" | "complete" = "complete",
) => ({ status, summary: summarizeSession(attempts) });

describe("puttCareerStats", () => {
  it("weights by putt, not by session", () => {
    // A long session of makes and a short session of misses. Averaging session
    // averages would let the 4-putt session pull as hard as the 40-putt one.
    const long = session(Array.from({ length: 40 }, () => made()));
    const short = session(Array.from({ length: 4 }, () => missed("left")));
    const c = puttCareerStats([long, short]);

    expect(c.puttsHit).toBe(44);
    expect(c.averageSg).toBeCloseTo(
      (long.summary.totalSg + short.summary.totalSg) / 44,
      8,
    );
    const naive = (long.summary.totalSg / 40 + short.summary.totalSg / 4) / 2;
    expect(c.averageSg).toBeGreaterThan(naive);
  });

  it("excludes in-progress and empty sessions", () => {
    const c = puttCareerStats([
      session([made(), made()]),
      session([made()], "in_progress"),
      session([]),
    ]);
    expect(c.sessionsCompleted).toBe(1);
    expect(c.puttsHit).toBe(2);
  });

  it("ranks the best session by SG per putt, not by total", () => {
    // A long mediocre session beats a short excellent one on TOTAL, which
    // would be the wrong thing to celebrate.
    const longOk = session(Array.from({ length: 20 }, () => made()));
    const shortGreat = session([made({ distanceFt: 12 })]);
    const c = puttCareerStats([longOk, shortGreat]);
    expect(c.bestSessionSg).toBeCloseTo(shortGreat.summary.totalSg / 1, 8);
    expect(longOk.summary.totalSg).toBeGreaterThan(shortGreat.summary.totalSg);
  });

  it("tracks make and three-putt rates over all putts", () => {
    const c = puttCareerStats([
      session([
        made(),
        made(),
        missed("left"),
        putt({
          lineError: "right",
          comebackDistanceFt: 5,
          comebackMade: false,
        }),
      ]),
    ]);
    expect(c.makePercent).toBeCloseTo(0.5, 8);
    expect(c.threePuttRate).toBeCloseTo(0.25, 8);
  });

  it("returns zeros and silent gauges with no completed sessions", () => {
    const c = puttCareerStats([]);
    expect(c.sessionsCompleted).toBe(0);
    expect(c.averageSg).toBe(0);
    expect(c.bestSessionSg).toBeNull();
    expect(c.directionBias.significant).toBe(false);
    expect(c.readBias.n).toBe(0);
  });
});

describe("career bias is where the gate finally has data", () => {
  // Three sessions a player under-reads in. Individually each has too few
  // misses to call; pooled, the tendency is unmistakable. This is the whole
  // argument for computing bias at career level too.
  const underReadSession = () =>
    session([
      ...Array.from({ length: 2 }, () => missed("right", "l2r")),
      ...Array.from({ length: 2 }, () => missed("left", "r2l")),
      made(),
    ]);

  it("stays silent on one session but fires across several", () => {
    const one = puttCareerStats([underReadSession()]);
    expect(one.readBias.counts).toEqual([0, 4]);
    expect(one.readBias.significant).toBe(false);

    const many = puttCareerStats([
      underReadSession(),
      underReadSession(),
      underReadSession(),
    ]);
    expect(many.readBias.counts).toEqual([0, 12]);
    expect(many.readBias.significant).toBe(true);
    expect(many.readBias.leaning).toBe("low");
  });

  it("still keeps the stroke gauge neutral — the fault is the read", () => {
    const many = puttCareerStats([
      underReadSession(),
      underReadSession(),
      underReadSession(),
    ]);
    expect(many.directionBias.counts).toEqual([6, 6]);
    expect(many.directionBias.significant).toBe(false);
  });

  it("pools raw misses rather than averaging session means", () => {
    const c = puttCareerStats([
      session([missed("left"), missed("left")]),
      session([missed("left")]),
    ]);
    expect(c.directionBias.counts).toEqual([3, 0]);
  });
});
