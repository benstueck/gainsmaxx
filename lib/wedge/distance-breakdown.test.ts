import { describe, expect, it } from "vitest";
import { distanceBreakdown } from "./distance-breakdown";
import { scoreShot } from "./engine";
import type { WedgeShot } from "./types";

const shot = (
  targetDistance: number,
  carryDistance: number | null,
): WedgeShot => ({
  targetDistance,
  carryDistance,
});

describe("distanceBreakdown", () => {
  it("bands by target distance, not by carry", () => {
    // Target 120 but a badly short carry of 60 — belongs to 100–125, since the
    // question is how you score from the yardage you were asked for.
    const bands = distanceBreakdown([shot(120, 60)]);
    expect(bands).toHaveLength(1);
    expect(bands[0].label).toBe("100–125");
  });

  it("places targets on the correct side of each boundary", () => {
    const bands = distanceBreakdown([
      shot(74, 74),
      shot(75, 75),
      shot(99, 99),
      shot(100, 100),
      shot(124, 124),
      shot(125, 125),
    ]);
    expect(bands.map((b) => b.label)).toEqual([
      "Under 75",
      "75–100",
      "100–125",
      "125+",
    ]);
    expect(bands.map((b) => b.ballsHit)).toEqual([1, 2, 2, 1]);
  });

  it("omits bands with no balls rather than showing empty rows", () => {
    const bands = distanceBreakdown([shot(110, 108), shot(115, 112)]);
    expect(bands).toHaveLength(1);
    expect(bands[0].label).toBe("100–125");
  });

  it("averages points within a band", () => {
    const a = shot(110, 105);
    const b = shot(120, 118);
    const [band] = distanceBreakdown([a, b]);
    const expected = (scoreShot(a).points + scoreShot(b).points) / 2;
    expect(band.averagePoints).toBeCloseTo(expected, 8);
  });

  it("counts a mishit as a ball but keeps it out of the band's bias", () => {
    const [band] = distanceBreakdown([
      shot(110, 104), // 6 short
      shot(110, null), // mishit
    ]);
    expect(band.ballsHit).toBe(2);
    expect(band.biasYd).toBeCloseTo(-6, 8);
  });

  it("reports null bias when a band is nothing but mishits", () => {
    const [band] = distanceBreakdown([shot(110, null)]);
    expect(band.ballsHit).toBe(1);
    expect(band.biasYd).toBeNull();
  });

  it("returns nothing for an empty session", () => {
    expect(distanceBreakdown([])).toEqual([]);
  });
});
