import { describe, expect, it } from "vitest";
import { summarizeSession } from "./analytics";
import type {
  BreakDirection,
  LineError,
  PuttAttempt,
  SpeedError,
} from "./types";

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

const made = (over: Partial<PuttAttempt> = {}) => putt({ made: true, ...over });

/** A miss that leaves a tap-in and is holed — the ordinary two-putt. */
const missed = (
  lineError: LineError | null,
  breakDirection: BreakDirection = "straight",
  over: Partial<PuttAttempt> = {},
) =>
  putt({
    lineError,
    breakDirection,
    comebackDistanceFt: 2,
    comebackMade: true,
    ...over,
  });

describe("the read/direction split earns its place", () => {
  it("catches a pure under-read that an absolute gauge would erase", () => {
    // A player who ALWAYS misses on the low side. Across balanced breaks that
    // means missing right on L2R and left on R2L — so absolute left/right
    // cancels to nothing while the read axis is unanimous.
    const session = [
      ...Array.from({ length: 6 }, () => missed("right", "l2r")),
      ...Array.from({ length: 6 }, () => missed("left", "r2l")),
    ];
    const s = summarizeSession(session);

    // Read gauge: 12 low, 0 high — unmistakable.
    expect(s.readBias.counts).toEqual([0, 12]);
    expect(s.readBias.leaning).toBe("low");
    expect(s.readBias.significant).toBe(true);

    // Direction gauge: 6 left, 6 right — correctly reports nothing, because
    // the stroke is fine. This is the pair of assertions the whole two-gauge
    // design exists for.
    expect(s.directionBias.counts).toEqual([6, 6]);
    expect(s.directionBias.leaning).toBeNull();
    expect(s.directionBias.significant).toBe(false);
  });

  it("catches a pure stroke pull that the read axis stays quiet on", () => {
    // Always misses LEFT regardless of break — a face/path fault, not a read
    // fault. Absolute direction should fire; high/low should cancel, since
    // left is the low side on R2L but the high side on L2R.
    const session = [
      ...Array.from({ length: 6 }, () => missed("left", "l2r")),
      ...Array.from({ length: 6 }, () => missed("left", "r2l")),
    ];
    const s = summarizeSession(session);

    expect(s.directionBias.counts).toEqual([12, 0]);
    expect(s.directionBias.significant).toBe(true);
    expect(s.directionBias.leaning).toBe("left");

    expect(s.readBias.counts).toEqual([6, 6]);
    expect(s.readBias.significant).toBe(false);
  });

  it("ignores straight putts in the read gauge — nothing to misread", () => {
    const s = summarizeSession(
      Array.from({ length: 12 }, () => missed("left", "straight")),
    );
    expect(s.readBias.n).toBe(0);
    expect(s.readBias.significant).toBe(false);
    // ...but they still count toward the stroke gauge.
    expect(s.directionBias.counts).toEqual([12, 0]);
  });
});

describe("pooled vs first-putt stroke gauge", () => {
  it("keeps both, because comebacks may sharpen or dilute the signal", () => {
    // A player who pulls every first putt but whose short comebacks miss
    // randomly: the first-putt gauge sees the fault clearly, the pooled gauge
    // has it watered down. Which is the truer read is an empirical question,
    // so both are computed and real sessions get to answer it.
    const session = [
      ...Array.from({ length: 10 }, () =>
        missed("left", "straight", { comebackLineError: "right" as LineError }),
      ),
    ];
    const s = summarizeSession(session);
    expect(s.firstPuttDirectionBias.counts).toEqual([10, 0]);
    expect(s.firstPuttDirectionBias.significant).toBe(true);
    expect(s.directionBias.counts).toEqual([10, 10]);
    expect(s.directionBias.significant).toBe(false);
  });
});

describe("populations", () => {
  it("folds comeback misses into the stroke gauge but not make %", () => {
    const session = [
      made(),
      made(),
      missed("left", "straight", {
        comebackMade: false,
        comebackLineError: "left" as LineError,
      }),
    ];
    const s = summarizeSession(session);

    // Make % is first putts only: 2 of 3.
    expect(s.makePercent).toBeCloseTo(2 / 3, 10);
    // The stroke gauge sees both the first putt and its comeback.
    expect(s.directionBias.counts).toEqual([2, 0]);
  });

  it("keeps comebacks out of the read gauge even when they have a line error", () => {
    const s = summarizeSession([
      missed("right", "l2r", {
        comebackMade: false,
        comebackLineError: "right" as LineError,
      }),
    ]);
    // One low miss from the first putt only — the comeback is excluded.
    expect(s.readBias.counts).toEqual([0, 1]);
    expect(s.directionBias.counts).toEqual([0, 2]);
  });

  it("builds the miss map from first putts, with made at the centre", () => {
    const s = summarizeSession([
      made(),
      made(),
      missed("left"),
      missed(null, "straight", { speedError: "slow" as SpeedError }),
    ]);
    expect(s.missMap).toHaveLength(9);
    const cell = (speed: SpeedError | null, line: LineError | null) =>
      s.missMap.find((c) => c.speed === speed && c.line === line)!.count;
    expect(cell(null, null)).toBe(2);
    expect(cell(null, "left")).toBe(1);
    expect(cell("slow", null)).toBe(1);
  });

  it("never lets a malformed miss masquerade as a make", () => {
    // A miss with no error recorded is unreachable through the grid, but if
    // one ever reaches the DB it must not inflate the made count — overstating
    // performance is the worst possible way to be wrong.
    const s = summarizeSession([made(), missed(null)]);
    const centre = s.missMap.find((c) => c.speed == null && c.line == null)!;
    expect(centre.count).toBe(1);
    expect(s.firstPuttsMade).toBe(1);
  });
});

describe("counts and scoring", () => {
  it("tallies the putt distribution", () => {
    const s = summarizeSession([
      made(),
      missed("left"),
      putt({ comebackDistanceFt: 4, comebackMade: false }),
    ]);
    expect(s.onePutts).toBe(1);
    expect(s.twoPutts).toBe(1);
    expect(s.threePutts).toBe(1);
  });

  it("totals strokes gained across the session", () => {
    const s = summarizeSession([
      made({ distanceFt: 8 }),
      missed(null, "straight", { distanceFt: 8 }),
    ]);
    expect(s.totalSg).toBeCloseTo(0.5 - 0.5, 10);
    expect(s.averageSg).toBeCloseTo(0, 10);
  });

  it("averages comeback leave distance over missed putts only", () => {
    const s = summarizeSession([
      made(),
      missed("left", "straight", { comebackDistanceFt: 2 }),
      missed("left", "straight", { comebackDistanceFt: 6 }),
    ]);
    expect(s.comebacks).toBe(2);
    expect(s.averageComebackFt).toBeCloseTo(4, 10);
  });

  it("reports no comeback average when nothing was missed", () => {
    expect(summarizeSession([made(), made()]).averageComebackFt).toBeNull();
  });

  it("bands by called distance, omitting empty bands", () => {
    const s = summarizeSession([
      made({ distanceFt: 5 }),
      missed(null, "straight", { distanceFt: 11 }),
      made({ distanceFt: 11 }),
    ]);
    expect(s.bands.map((b) => b.label)).toEqual(["Under 6 ft", "9–12 ft"]);
    expect(s.bands[1].attempts).toBe(2);
    expect(s.bands[1].makePercent).toBeCloseTo(0.5, 10);
  });
});

describe("self-reported vs measured read", () => {
  it("counts low misses the player never flagged as a misread", () => {
    const s = summarizeSession([
      missed("right", "l2r"), // low, unflagged
      missed("right", "l2r", { misreadLine: true }), // low, flagged
      missed("left", "l2r"), // high side, irrelevant
    ]);
    expect(s.unflaggedLowMisses).toBe(1);
    expect(s.misreadLineCount).toBe(1);
  });
});

describe("empty session", () => {
  it("returns zeros rather than NaN", () => {
    const s = summarizeSession([]);
    expect(s.attemptCount).toBe(0);
    expect(s.totalSg).toBe(0);
    expect(s.averageSg).toBe(0);
    expect(s.makePercent).toBe(0);
    expect(s.averageComebackFt).toBeNull();
    expect(s.bands).toEqual([]);
    expect(s.directionBias.significant).toBe(false);
    expect(s.missMap).toHaveLength(9);
  });
});
