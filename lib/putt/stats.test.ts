import { describe, expect, it } from "vitest";
import { BIAS_ALPHA, detectBias, twoSidedBinomialP } from "./stats";

describe("twoSidedBinomialP", () => {
  it("matches hand-computed exact values", () => {
    // n=10, 8–2: 2 × (45+10+1)/1024
    expect(twoSidedBinomialP(8, 2)).toBeCloseTo(0.109375, 10);
    // n=10, 9–1: 2 × (10+1)/1024
    expect(twoSidedBinomialP(9, 1)).toBeCloseTo(0.021484375, 10);
    // n=10, 10–0: 2 × 1/1024
    expect(twoSidedBinomialP(10, 0)).toBeCloseTo(0.001953125, 10);
  });

  it("is 1 for an even split and for no data", () => {
    expect(twoSidedBinomialP(5, 5)).toBe(1);
    expect(twoSidedBinomialP(0, 0)).toBe(1);
  });

  it("is symmetric — which side leans doesn't change the evidence", () => {
    expect(twoSidedBinomialP(3, 12)).toBeCloseTo(twoSidedBinomialP(12, 3), 12);
  });

  it("never exceeds 1", () => {
    for (let a = 0; a <= 12; a++) {
      expect(twoSidedBinomialP(a, 12 - a)).toBeLessThanOrEqual(1);
    }
  });

  it("stays finite at sizes that would overflow a naive C(n,k)", () => {
    const p = twoSidedBinomialP(320, 280);
    expect(Number.isFinite(p)).toBe(true);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });
});

describe("detectBias", () => {
  const dir = (l: number, r: number) =>
    detectBias(["left", "right"] as const, [l, r]);

  it("refuses to call a 6–4 split — the headline requirement", () => {
    // With 10 misses this is the single most likely outcome for a player with
    // NO tendency. Calling it would send them to fix a problem they don't have.
    const b = dir(6, 4);
    expect(b.leaning).toBe("left");
    expect(b.significant).toBe(false);
    expect(b.pValue).toBeGreaterThan(BIAS_ALPHA);
  });

  it("calls a genuinely lopsided split at a healthy sample", () => {
    const b = dir(5, 15);
    expect(b.leaning).toBe("right");
    expect(b.significant).toBe(true);
    expect(b.pValue).toBeLessThan(BIAS_ALPHA);
  });

  it("stays silent on a dead-even split however large", () => {
    const b = dir(50, 50);
    expect(b.leaning).toBeNull();
    expect(b.significant).toBe(false);
  });

  it("stays silent with no data rather than dividing by zero", () => {
    const b = dir(0, 0);
    expect(b.n).toBe(0);
    expect(b.tilt).toBe(0);
    expect(b.leaning).toBeNull();
    expect(b.significant).toBe(false);
  });

  it("needs more evidence from a small sample than a large one", () => {
    // Same 80/20 ratio, different n: only the larger sample earns the call.
    expect(dir(8, 2).significant).toBe(false);
    expect(dir(24, 6).significant).toBe(true);
  });

  it("reports tilt signed toward the second side, scaled −1..+1", () => {
    expect(dir(10, 0).tilt).toBe(-1);
    expect(dir(0, 10).tilt).toBe(1);
    expect(dir(5, 5).tilt).toBe(0);
    expect(dir(3, 9).tilt).toBeCloseTo(0.5, 10);
  });

  it("reports the dominant side's share, which is always shown", () => {
    // The descriptive number. 78% low is worth knowing at p = 0.18; hiding it
    // behind a verdict taught the player nothing about their own round.
    expect(dir(10, 0).share).toBe(1);
    expect(dir(7, 2).share).toBeCloseTo(7 / 9, 10);
    expect(dir(2, 7).share).toBeCloseTo(7 / 9, 10);
    expect(dir(5, 5).share).toBe(0.5);
    expect(dir(0, 0).share).toBe(0);
  });

  it("separates share from significance — a high share can still be unproven", () => {
    const b = dir(4, 0);
    expect(b.share).toBe(1);
    expect(b.significant).toBe(false);
  });

  it("still exposes the tilt when it won't call it, so the gauge can render", () => {
    const b = dir(6, 4);
    expect(b.significant).toBe(false);
    expect(b.tilt).toBeCloseTo(-0.2, 10);
    expect(b.counts).toEqual([6, 4]);
  });
});
