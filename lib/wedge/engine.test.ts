import { describe, expect, it } from "vitest";
import {
  BASE_POINTS,
  nextTarget,
  referenceSg,
  scoreShot,
  sessionSummary,
  shotProximityYd,
  tourDistanceErrorYd,
  tourProximityYd,
  tourSigmaYd,
  wedgeShotPoints,
  wedgeShotSg,
} from "./engine";

/** Mirrors SCRATCH_DISPERSION_MULTIPLIER — the documented anchor contract. */
const SCRATCH_MULTIPLIER = 1.5;

/** Deterministic PRNG so simulation tests never flake. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianFrom(random: () => number): () => number {
  return () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = random();
    while (v === 0) v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

describe("shot geometry", () => {
  it("floors proximity at 1 yard so nothing ever holes out", () => {
    expect(shotProximityYd(130, 130)).toBe(1);
    expect(shotProximityYd(130, 129)).toBe(1);
    expect(shotProximityYd(130, 125)).toBe(5);
    expect(shotProximityYd(130, 135)).toBe(5);
  });

  it("has no cliff at an exact carry (the bug the floor exists to prevent)", () => {
    // Unfloored, an exact carry would be a hole-out worth ~52 more points
    // than being a single yard off.
    const exact = wedgeShotPoints(130, 130);
    const oneOff = wedgeShotPoints(130, 129);
    expect(exact).toBeCloseTo(oneOff, 10);
  });

  it("treats short and long misses symmetrically", () => {
    expect(wedgeShotPoints(110, 104)).toBeCloseTo(
      wedgeShotPoints(110, 116),
      10,
    );
  });
});

describe("points curve", () => {
  const targets = [50, 90, 140];

  it("decreases monotonically as the miss grows", () => {
    for (const target of targets) {
      let previous = Infinity;
      for (let err = 1; err <= 45; err++) {
        const points = wedgeShotPoints(target, target - err);
        expect(points).toBeLessThan(previous);
        previous = points;
      }
    }
  });

  it("stays continuous across the 30-yard green boundary", () => {
    // The putting table ends at 90ft (=30yd); beyond that we switch to the
    // fairway table. The step should be small enough to feel like a curve.
    for (const target of targets) {
      const onGreen = wedgeShotPoints(target, target - 30);
      const offGreen = wedgeShotPoints(target, target - 31);
      expect(onGreen - offGreen).toBeGreaterThan(0);
      expect(onGreen - offGreen).toBeLessThan(8);
    }
  });

  it("never goes negative across the realistic input range", () => {
    for (let target = 50; target <= 140; target += 10) {
      for (let err = 0; err <= 40; err++) {
        expect(wedgeShotPoints(target, target - err)).toBeGreaterThan(0);
      }
    }
  });

  it("keeps scoring misses beyond 30 yards instead of flattening out", () => {
    // A green-only model would clamp at the putting table's 90ft ceiling and
    // score a 30yd miss identically to a 40yd chunk.
    expect(wedgeShotPoints(130, 100)).toBeGreaterThan(wedgeShotPoints(130, 90));
  });
});

describe("tour reference derivation", () => {
  it("derives tour distance error matching published 3-5 yard dispersion", () => {
    for (const target of [50, 90, 130, 140]) {
      const err = tourDistanceErrorYd(target);
      expect(err).toBeGreaterThan(2);
      expect(err).toBeLessThan(6);
    }
    // Longer targets are harder to control than shorter ones.
    expect(tourDistanceErrorYd(140)).toBeGreaterThan(tourDistanceErrorYd(50));
  });

  it("solves tour proximity as the zero-SG distance", () => {
    for (const target of [50, 90, 140]) {
      const prox = tourProximityYd(target);
      expect(wedgeShotSg(target, target - prox)).toBeCloseTo(0, 3);
    }
  });
});

describe("calibration: scratch averages 100 at every target", () => {
  // The whole point of the per-distance reference. Without it a tour player
  // scores 111 from 50yd but 106 from 140yd, and scratch drifts similarly.
  for (const target of [50, 90, 140]) {
    it(`holds at ${target} yards`, () => {
      const gauss = gaussianFrom(mulberry32(target * 7919));
      const sigma = tourSigmaYd(target) * SCRATCH_MULTIPLIER;
      const N = 15000;
      let total = 0;
      for (let i = 0; i < N; i++) {
        total += wedgeShotPoints(target, target + gauss() * sigma);
      }
      expect(total / N).toBeCloseTo(BASE_POINTS, 0);
    });
  }

  it("scores a tour-level player above scratch", () => {
    const gauss = gaussianFrom(mulberry32(4242));
    const sigma = tourSigmaYd(110);
    const N = 15000;
    let total = 0;
    for (let i = 0; i < N; i++) {
      total += wedgeShotPoints(110, 110 + gauss() * sigma);
    }
    const average = total / N;
    expect(average).toBeGreaterThan(BASE_POINTS + 3);
    expect(average).toBeLessThan(BASE_POINTS + 12);
  });

  it("memoizes the reference per whole yard", () => {
    expect(referenceSg(110)).toBe(referenceSg(110));
    expect(referenceSg(110)).toBe(referenceSg(110.4));
  });
});

describe("sessionSummary", () => {
  const shots = [
    { targetDistance: 100, carryDistance: 94 }, // 6 short
    { targetDistance: 120, carryDistance: 116 }, // 4 short
    { targetDistance: 80, carryDistance: 78 }, // 2 short
  ];

  it("reports signed bias, which is the coachable number", () => {
    const s = sessionSummary(shots);
    // Consistently short — bias must be negative, not just a spread figure.
    expect(s.averageBiasYd).toBeCloseTo(-4, 10);
    expect(s.averageAbsErrorYd).toBeCloseTo(4, 10);
  });

  it("distinguishes bias from spread", () => {
    // Equal and opposite misses: big spread, no bias.
    const s = sessionSummary([
      { targetDistance: 100, carryDistance: 90 },
      { targetDistance: 100, carryDistance: 110 },
    ]);
    expect(s.averageBiasYd).toBeCloseTo(0, 10);
    expect(s.averageAbsErrorYd).toBeCloseTo(10, 10);
  });

  it("averages points over the balls actually hit", () => {
    const s = sessionSummary(shots);
    expect(s.ballsHit).toBe(3);
    const manual =
      shots.reduce(
        (acc, x) => acc + wedgeShotPoints(x.targetDistance, x.carryDistance),
        0,
      ) / 3;
    expect(s.averagePoints).toBeCloseTo(manual, 10);
  });

  it("picks best and worst by points", () => {
    const s = sessionSummary(shots);
    expect(s.best?.carryDistance).toBe(78); // 2 yards off
    expect(s.worst?.carryDistance).toBe(94); // 6 yards off
  });

  it("handles an empty session", () => {
    const s = sessionSummary([]);
    expect(s.ballsHit).toBe(0);
    expect(s.averagePoints).toBe(0);
    expect(s.averageBiasYd).toBe(0);
    expect(s.best).toBeNull();
    expect(s.worst).toBeNull();
  });

  it("scores a single shot consistently with the engine", () => {
    const r = scoreShot({ targetDistance: 115, carryDistance: 108 });
    expect(r.deltaYd).toBe(-7);
    expect(r.points).toBeCloseTo(wedgeShotPoints(115, 108), 10);
  });
});

describe("nextTarget", () => {
  it("stays within range and returns whole yards", () => {
    const random = mulberry32(1);
    for (let i = 0; i < 500; i++) {
      const t = nextTarget(50, 140, null, random);
      expect(Number.isInteger(t)).toBe(true);
      expect(t).toBeGreaterThanOrEqual(50);
      expect(t).toBeLessThanOrEqual(140);
    }
  });

  it("never repeats the previous target", () => {
    const random = mulberry32(7);
    let previous: number | null = null;
    for (let i = 0; i < 2000; i++) {
      const t = nextTarget(50, 55, previous, random);
      expect(t).not.toBe(previous);
      previous = t;
    }
  });

  it("still covers the whole range when excluding the previous value", () => {
    const random = mulberry32(99);
    const seen = new Set<number>();
    let previous: number | null = 52;
    for (let i = 0; i < 2000; i++) {
      previous = nextTarget(50, 55, previous, random);
      seen.add(previous);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([50, 51, 52, 53, 54, 55]);
  });

  it("degenerates safely when min equals max", () => {
    expect(nextTarget(100, 100, 100, mulberry32(3))).toBe(100);
  });

  it("tolerates a random() returning values at the top of its range", () => {
    expect(nextTarget(50, 60, null, () => 0.999999999)).toBe(60);
    expect(nextTarget(50, 60, 55, () => 0.999999999)).toBe(60);
  });
});
