import { describe, expect, it } from "vitest";
import {
  baselineOptions,
  parseHandicapSnapshot,
  resolveBaseline,
  resolveRoundBaseline,
} from "@/lib/baseline";
import { roundStrokesGained, type Baseline } from "@/lib/sg";

describe("parseHandicapSnapshot", () => {
  it("converts the numeric column's string back to a number", () => {
    expect(parseHandicapSnapshot("12.5")).toBe(12.5);
    expect(parseHandicapSnapshot("0.0")).toBe(0);
  });

  it("treats a missing or unparseable snapshot as absent", () => {
    expect(parseHandicapSnapshot(null)).toBeNull();
    expect(parseHandicapSnapshot("")).toBeNull();
    expect(parseHandicapSnapshot("not a number")).toBeNull();
  });

  it("keeps scratch distinct from absent — 0 is a real index, not null", () => {
    // Guards the ?? vs || trap: `0 || fallback` would silently rescore a
    // scratch round against someone else's baseline.
    expect(parseHandicapSnapshot("0")).toBe(0);
    expect(resolveRoundBaseline(parseHandicapSnapshot("0"), 20)).toBe(0);
  });
});

describe("resolveRoundBaseline", () => {
  it("scores a round off the index it was played off", () => {
    expect(resolveRoundBaseline(12.5, 20)).toBe(12.5);
  });

  it("falls back only when the round has no snapshot", () => {
    expect(resolveRoundBaseline(null, 20)).toBe(20);
    expect(resolveRoundBaseline(null, "tour")).toBe("tour");
  });
});

describe("historical SG is stable across handicap changes", () => {
  // One round's worth of shot data, reused so the ONLY thing varying is the
  // baseline it's scored against.
  const holes = [
    {
      par: 4,
      shots: [
        {
          startLie: "tee" as const,
          startDistance: 400,
          endLie: "fairway" as const,
          endDistance: 150,
          isHoled: false,
          penaltyStrokes: 0,
        },
        {
          startLie: "fairway" as const,
          startDistance: 150,
          endLie: "green" as const,
          endDistance: 20,
          isHoled: false,
          penaltyStrokes: 0,
        },
        {
          startLie: "green" as const,
          startDistance: 20,
          endLie: null,
          endDistance: null,
          isHoled: true,
          penaltyStrokes: 0,
        },
      ],
    },
  ];

  const sgAt = (b: Baseline) => roundStrokesGained(holes, b).total;

  it("the same round scored off two indexes gives two different totals", () => {
    // If this ever stops being true the whole snapshot feature is pointless —
    // it would mean the baseline doesn't actually affect the number.
    expect(sgAt(12.5)).not.toBeCloseTo(sgAt(20), 6);
  });

  it("a snapshotted round ignores the current-handicap fallback entirely", () => {
    const snapshot = 12.5;
    // Simulate the user's index drifting 12.5 -> 16 -> 20 over time.
    const asIfHandicapChanged = [16, 20, 5].map((current) =>
      sgAt(resolveRoundBaseline(snapshot, current)),
    );
    for (const total of asIfHandicapChanged) {
      expect(total).toBeCloseTo(sgAt(12.5), 10);
    }
  });

  it("only an unsnapshotted round moves when the current handicap moves", () => {
    expect(sgAt(resolveRoundBaseline(null, 12.5))).not.toBeCloseTo(
      sgAt(resolveRoundBaseline(null, 20)),
      6,
    );
  });
});

describe("baselineOptions labelling", () => {
  it("names the handicap option for its context", () => {
    expect(baselineOptions(12.5)[0].label).toBe("My handicap (12.5)");
    expect(baselineOptions(12.5, "Played off")[0].label).toBe(
      "Played off (12.5)",
    );
  });

  it("omits the handicap option when there is no index", () => {
    expect(baselineOptions(null).some((o) => o.value === "handicap")).toBe(
      false,
    );
    expect(resolveBaseline("handicap", null)).toBe("tour");
  });
});
