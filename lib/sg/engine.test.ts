import { describe, it, expect } from "vitest";
import {
  interpolate,
  expectedStrokes,
  categorize,
  strokesGainedForShot,
  holeStrokesGained,
  handicapAdjustment,
  roundStrokesGained,
} from "./engine";
import type { HoleInput, ShotInput } from "./types";

const shot = (
  s: Partial<ShotInput> & Pick<ShotInput, "startLie" | "startDistance">,
): ShotInput => ({
  endLie: null,
  endDistance: null,
  isHoled: false,
  penaltyStrokes: 0,
  ...s,
});

describe("interpolate", () => {
  const pts: [number, number][] = [
    [10, 1],
    [20, 2],
    [30, 4],
  ];
  it("returns exact values at points", () => {
    expect(interpolate(pts, 10)).toBe(1);
    expect(interpolate(pts, 20)).toBe(2);
  });
  it("interpolates linearly between points", () => {
    expect(interpolate(pts, 15)).toBeCloseTo(1.5, 6);
    expect(interpolate(pts, 25)).toBeCloseTo(3, 6);
  });
  it("clamps outside the range", () => {
    expect(interpolate(pts, 5)).toBe(1);
    expect(interpolate(pts, 100)).toBe(4);
  });
});

describe("expectedStrokes (Tour)", () => {
  it("reads exact table values", () => {
    expect(expectedStrokes("fairway", 150)).toBeCloseTo(2.95, 6);
    expect(expectedStrokes("rough", 50)).toBeCloseTo(2.85, 6);
    expect(expectedStrokes("tee", 400)).toBeCloseTo(3.99, 6);
    expect(expectedStrokes("green", 10)).toBeCloseTo(1.61, 6); // feet
  });
  it("interpolates by distance", () => {
    // fairway 178 between 175 (3.06) and 180 (3.08)
    expect(expectedStrokes("fairway", 178)).toBeCloseTo(3.072, 6);
    // green 2 ft between 1 (1.00) and 3 (1.04)
    expect(expectedStrokes("green", 2)).toBeCloseTo(1.02, 6);
  });
  it("clamps below/above a lie's covered range", () => {
    expect(expectedStrokes("tee", 50)).toBeCloseTo(2.92, 6); // tee data starts at 100
    expect(expectedStrokes("fairway", 5)).toBeCloseTo(2.2, 6); // first fairway point
    expect(expectedStrokes("fairway", 1000)).toBeCloseTo(4.94, 6); // last fairway point
  });
});

describe("categorize", () => {
  it("classifies by starting position", () => {
    expect(categorize("tee", 400, 4)).toBe("ott");
    expect(categorize("tee", 520, 5)).toBe("ott");
    expect(categorize("tee", 180, 3)).toBe("app"); // par-3 tee shot
    expect(categorize("fairway", 150, 4)).toBe("app");
    expect(categorize("green", 15, 4)).toBe("putt");
  });
  it("uses the 30-yard boundary for around-the-green", () => {
    expect(categorize("rough", 30, 4)).toBe("arg");
    expect(categorize("rough", 31, 4)).toBe("app");
    expect(categorize("sand", 20, 5)).toBe("arg");
  });
});

describe("strokesGainedForShot", () => {
  it("scores a made putt positively", () => {
    // 10-ft putt holed: 1.61 − 0 − 1 = 0.61
    const r = strokesGainedForShot(
      shot({ startLie: "green", startDistance: 10, isHoled: true }),
      4,
    );
    expect(r.category).toBe("putt");
    expect(r.sg).toBeCloseTo(0.61, 6);
  });

  it("applies a 1-stroke penalty (water drop) — plan example", () => {
    // Fairway 178 → Rough 50, penalty: 3.072 − 2.85 − 1 − 1 = −1.778
    const r = strokesGainedForShot(
      shot({
        startLie: "fairway",
        startDistance: 178,
        endLie: "rough",
        endDistance: 50,
        penaltyStrokes: 1,
      }),
      4,
    );
    expect(r.category).toBe("app");
    expect(r.sg).toBeCloseTo(-1.778, 6);
  });

  it("applies a 2-stroke OOB penalty — plan example", () => {
    // Tee 500 → Fairway 200, OOB: 4.41 − 3.19 − 1 − 2 = −1.78
    const r = strokesGainedForShot(
      shot({
        startLie: "tee",
        startDistance: 500,
        endLie: "fairway",
        endDistance: 200,
        penaltyStrokes: 2,
      }),
      5,
    );
    expect(r.category).toBe("ott");
    expect(r.sg).toBeCloseTo(-1.78, 6);
  });
});

describe("holeStrokesGained — the SG invariant", () => {
  // Par 4, 400 yd, made in 3 (birdie), fully chained.
  const par = 4;
  const shots: ShotInput[] = [
    shot({
      startLie: "tee",
      startDistance: 400,
      endLie: "fairway",
      endDistance: 150,
    }),
    shot({
      startLie: "fairway",
      startDistance: 150,
      endLie: "green",
      endDistance: 20,
    }),
    shot({ startLie: "green", startDistance: 20, isHoled: true }),
  ];

  it("sum(shot SG) == holeBenchmark(tee) − score", () => {
    const h = holeStrokesGained(shots, par);
    expect(h.score).toBe(3);
    expect(h.total).toBeCloseTo(expectedStrokes("tee", 400) - h.score, 6);
    expect(h.total).toBeCloseTo(0.99, 6);
  });

  it("splits SG into the right categories", () => {
    const h = holeStrokesGained(shots, par);
    expect(h.byCategory.arg).toBe(0);
    // ott + app + putt == total
    expect(h.byCategory.ott + h.byCategory.app + h.byCategory.putt).toBeCloseTo(
      h.total,
      6,
    );
  });

  it("counts penalty strokes in the score", () => {
    const withPenalty: ShotInput[] = [
      shot({
        startLie: "tee",
        startDistance: 400,
        endLie: "fairway",
        endDistance: 60,
        penaltyStrokes: 1,
      }),
      shot({
        startLie: "fairway",
        startDistance: 60,
        endLie: "green",
        endDistance: 15,
      }),
      shot({ startLie: "green", startDistance: 15, isHoled: true }),
    ];
    // 3 entries, one carrying a penalty stroke = 2 + 1 + 1 = 4 strokes
    expect(holeStrokesGained(withPenalty, par).score).toBe(4);
  });
});

describe("handicapAdjustment", () => {
  it("returns exact bracket levels", () => {
    expect(handicapAdjustment(0)).toEqual({
      ott: 1.78,
      app: 2.03,
      arg: 0.39,
      putt: 0.94,
    });
    expect(handicapAdjustment(25).ott).toBeCloseTo(7.53, 6);
  });
  it("interpolates between brackets (12 → blend of 10 & 15)", () => {
    const a = handicapAdjustment(12);
    expect(a.ott).toBeCloseTo(4.11, 6);
    expect(a.app).toBeCloseTo(7.082, 6);
    expect(a.arg).toBeCloseTo(1.53, 6);
    expect(a.putt).toBeCloseTo(1.99, 6);
  });
  it("clamps beyond the table range", () => {
    expect(handicapAdjustment(40)).toEqual(handicapAdjustment(25));
    expect(handicapAdjustment(-5)).toEqual(handicapAdjustment(0));
  });
});

describe("roundStrokesGained", () => {
  const holes: HoleInput[] = [
    {
      par: 4,
      shots: [
        shot({
          startLie: "tee",
          startDistance: 400,
          endLie: "fairway",
          endDistance: 150,
        }),
        shot({
          startLie: "fairway",
          startDistance: 150,
          endLie: "green",
          endDistance: 20,
        }),
        shot({ startLie: "green", startDistance: 20, isHoled: true }),
      ],
    },
  ];

  it("tour baseline leaves SG unadjusted", () => {
    const r = roundStrokesGained(holes, "tour");
    expect(r.holesPlayed).toBe(1);
    expect(r.score).toBe(3);
    expect(r.toPar).toBe(-1);
    expect(r.total).toBeCloseTo(0.99, 6);
    expect(r.teeToGreen + r.byCategory.putt).toBeCloseTo(r.total, 6);
  });

  it("handicap baseline adds back the scaled per-round adjustment", () => {
    const tour = roundStrokesGained(holes, "tour");
    const h12 = roundStrokesGained(holes, 12);
    const adj = handicapAdjustment(12);
    const scale = 1 / 18; // one hole played
    expect(h12.byCategory.ott).toBeCloseTo(
      tour.byCategory.ott + adj.ott * scale,
      6,
    );
    expect(h12.total).toBeCloseTo(
      tour.total + (adj.ott + adj.app + adj.arg + adj.putt) * scale,
      6,
    );
    // score is unaffected by baseline
    expect(h12.score).toBe(tour.score);
  });

  it("ignores holes with no shots", () => {
    const r = roundStrokesGained([...holes, { par: 3, shots: [] }], "tour");
    expect(r.holesPlayed).toBe(1);
  });
});
