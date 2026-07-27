import { describe, expect, it } from "vitest";
import {
  careerBucketTotals,
  computeBucketTotals,
  holeFairwayInRegulation,
  holeGreenInRegulation,
  roundFirGir,
  scaleBucketsPer18,
  type CategoryBuckets,
} from "./round-stats";
import { holeShotInputs, type HoleState, type ShotEnd } from "./round";
import { strokesGainedForShot } from "./sg";

function shot(s: Partial<ShotEnd> = {}): ShotEnd {
  return {
    endLie: "fairway",
    endDistance: 100,
    isHoled: false,
    penaltyStrokes: 0,
    ...s,
  };
}

function hole(par: number, length: number | null, shots: ShotEnd[]): HoleState {
  return { holeNumber: 1, par, length, shots };
}

describe("computeBucketTotals", () => {
  it("buckets a tee shot by hole length and an approach shot by its own start distance", () => {
    // Par 4, 375 yd (OTT bucket "350–400"): tee -> fairway at 120 yd, then an
    // approach shot (start 120 yd, OTT bucket "100–150") holed out.
    const h = hole(4, 375, [
      shot({ endLie: "fairway", endDistance: 120 }),
      shot({ isHoled: true, endLie: null, endDistance: null }),
    ]);
    const totals = computeBucketTotals([[h]]);

    const inputs = holeShotInputs(h);
    const expectedOtt = strokesGainedForShot(inputs[0], h.par).sg;
    const expectedApp = strokesGainedForShot(inputs[1], h.par).sg;

    const ottRow = totals.ott.find((r) => r.bucket === "350–400")!;
    expect(ottRow.shotCount).toBe(1);
    expect(ottRow.totalSg).toBeCloseTo(expectedOtt, 8);

    const appRow = totals.app.find((r) => r.bucket === "100–150")!;
    expect(appRow.shotCount).toBe(1);
    expect(appRow.totalSg).toBeCloseTo(expectedApp, 8);

    // Every other bucket across all categories stays empty.
    const otherRows = [
      ...totals.ott.filter((r) => r.bucket !== "350–400"),
      ...totals.app.filter((r) => r.bucket !== "100–150"),
      ...totals.arg,
      ...totals.putt,
    ];
    for (const row of otherRows) {
      expect(row.shotCount).toBe(0);
      expect(row.totalSg).toBe(0);
    }
  });

  it("buckets a par-3 tee shot as APP and a short putt as PUTT", () => {
    const h = hole(3, 165, [
      shot({ endLie: "green", endDistance: 8 }),
      shot({ isHoled: true, endLie: null, endDistance: null }),
    ]);
    const totals = computeBucketTotals([[h]]);

    expect(totals.app.find((r) => r.bucket === "150–200")!.shotCount).toBe(1);
    expect(totals.putt.find((r) => r.bucket === "5–10")!.shotCount).toBe(1);
    expect(totals.ott.every((r) => r.shotCount === 0)).toBe(true);
  });
});

describe("scaleBucketsPer18", () => {
  it("scales totalSg to a per-18 rate without touching shotCount", () => {
    const buckets: CategoryBuckets = {
      ott: [{ bucket: "<350", totalSg: 3, shotCount: 5 }],
      app: [],
      arg: [],
      putt: [],
    };
    const scaled = scaleBucketsPer18(buckets, 9);
    expect(scaled.ott[0].totalSg).toBeCloseTo(6, 8);
    expect(scaled.ott[0].shotCount).toBe(5);
  });

  it("is a no-op with zero holes played", () => {
    const buckets: CategoryBuckets = {
      ott: [{ bucket: "<350", totalSg: 3, shotCount: 5 }],
      app: [],
      arg: [],
      putt: [],
    };
    expect(scaleBucketsPer18(buckets, 0)).toBe(buckets);
  });
});

describe("careerBucketTotals", () => {
  it("weights a 9-hole round as half a data point, like computeCareerStats", () => {
    const h18 = hole(4, 375, [shot({ endLie: "fairway", endDistance: 120 })]);
    const h9 = hole(4, 375, [shot({ endLie: "fairway", endDistance: 120 })]);
    const totals = careerBucketTotals([
      { status: "complete", holesPlayed: 18, holes: [h18] },
      { status: "complete", holesPlayed: 9, holes: [h9] },
    ]);
    const raw = computeBucketTotals([[h18], [h9]]);
    const expected = scaleBucketsPer18(raw, 27);
    const row = totals.ott.find((r) => r.bucket === "350–400")!;
    const expectedRow = expected.ott.find((r) => r.bucket === "350–400")!;
    expect(row.totalSg).toBeCloseTo(expectedRow.totalSg, 8);
  });

  it("excludes in-progress rounds", () => {
    const h = hole(4, 375, [shot({ endLie: "fairway", endDistance: 120 })]);
    const totals = careerBucketTotals([
      { status: "in_progress", holesPlayed: 5, holes: [h] },
    ]);
    expect(totals.ott.every((r) => r.shotCount === 0)).toBe(true);
  });
});

describe("holeFairwayInRegulation", () => {
  it("is null for an incomplete hole", () => {
    const h = hole(4, 400, [shot({ endLie: "fairway", endDistance: 150 })]);
    expect(holeFairwayInRegulation(h)).toBeNull();
  });

  it("is null for a par 3", () => {
    const h = hole(3, 165, [shot({ isHoled: true })]);
    expect(holeFairwayInRegulation(h)).toBeNull();
  });

  it("is true when the tee shot ends in the fairway", () => {
    const h = hole(4, 400, [
      shot({ endLie: "fairway", endDistance: 150 }),
      shot({ isHoled: true }),
    ]);
    expect(holeFairwayInRegulation(h)).toBe(true);
  });

  it("is true when the tee shot reaches the green", () => {
    const h = hole(4, 300, [
      shot({ endLie: "green", endDistance: 20 }),
      shot({ isHoled: true }),
    ]);
    expect(holeFairwayInRegulation(h)).toBe(true);
  });

  it("is false when the tee shot has a penalty, even if the drop lands in the fairway", () => {
    const h = hole(4, 400, [
      shot({ endLie: "fairway", endDistance: 150, penaltyStrokes: 1 }),
      shot({ isHoled: true }),
    ]);
    expect(holeFairwayInRegulation(h)).toBe(false);
  });

  it("is false when the tee shot misses to the rough", () => {
    const h = hole(4, 400, [
      shot({ endLie: "rough", endDistance: 140 }),
      shot({ isHoled: true }),
    ]);
    expect(holeFairwayInRegulation(h)).toBe(false);
  });
});

describe("holeGreenInRegulation", () => {
  it("is null for an incomplete hole", () => {
    const h = hole(4, 400, [shot({ endLie: "fairway", endDistance: 150 })]);
    expect(holeGreenInRegulation(h)).toBeNull();
  });

  it("is true when the green is reached within par - 2 strokes", () => {
    // Par 4: reach green on shot 2 (2 <= 4 - 2).
    const h = hole(4, 400, [
      shot({ endLie: "green", endDistance: 20 }),
      shot({ isHoled: true }),
    ]);
    expect(holeGreenInRegulation(h)).toBe(true);
  });

  it("is false when the green is reached one stroke late", () => {
    // Par 4: reach green on shot 3 (3 > 4 - 2).
    const h = hole(4, 400, [
      shot({ endLie: "rough", endDistance: 150 }),
      shot({ endLie: "rough", endDistance: 60 }),
      shot({ endLie: "green", endDistance: 20 }),
      shot({ isHoled: true }),
    ]);
    expect(holeGreenInRegulation(h)).toBe(false);
  });

  it("counts a penalty stroke toward the cumulative count", () => {
    // Par 5: tee shot penalized (counts as 2 strokes), reaches green on the
    // 3rd recorded shot but that's cumulative stroke 4, one over par - 2 = 3.
    const h = hole(5, 520, [
      shot({ endLie: "rough", endDistance: 250, penaltyStrokes: 1 }),
      shot({ endLie: "fairway", endDistance: 30 }),
      shot({ endLie: "green", endDistance: 5 }),
      shot({ isHoled: true }),
    ]);
    expect(holeGreenInRegulation(h)).toBe(false);
  });

  it("counts holing out directly as reaching the green", () => {
    const h = hole(3, 165, [shot({ isHoled: true })]);
    expect(holeGreenInRegulation(h)).toBe(true);
  });
});

describe("roundFirGir", () => {
  it("aggregates made/attempted across a round, excluding par 3s from FIR and incomplete holes from both", () => {
    const par3Made: HoleState = hole(3, 165, [shot({ isHoled: true })]);
    const par4Made: HoleState = hole(4, 400, [
      shot({ endLie: "fairway", endDistance: 150 }),
      shot({ endLie: "green", endDistance: 20 }),
      shot({ isHoled: true }),
    ]);
    const par4Missed: HoleState = hole(4, 400, [
      shot({ endLie: "rough", endDistance: 150 }),
      shot({ endLie: "rough", endDistance: 50 }),
      shot({ endLie: "green", endDistance: 10 }),
      shot({ isHoled: true }),
    ]);
    const incomplete: HoleState = hole(4, 400, [
      shot({ endLie: "fairway", endDistance: 150 }),
    ]);

    const result = roundFirGir([par3Made, par4Made, par4Missed, incomplete]);

    // FIR: only the two par-4s count; par4Made hits, par4Missed misses.
    expect(result.fir).toEqual({ made: 1, attempted: 2 });
    // GIR: par3Made (holed = green, stroke 1 <= 1) and par4Made (stroke 2 <=
    // 2) both hit; par4Missed reaches green on stroke 3 (> 2) misses;
    // incomplete is excluded.
    expect(result.gir).toEqual({ made: 2, attempted: 3 });
  });
});
