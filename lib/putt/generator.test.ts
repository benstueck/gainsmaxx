import { describe, expect, it } from "vitest";
import { rollSession, seededRandom } from "./generator";
import type { BreakDirection, Elevation } from "./types";

/** Deterministic PRNG (mulberry32) so a failure is always reproducible. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tally = <T extends string>(xs: T[]) =>
  xs.reduce<Record<string, number>>(
    (m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }),
    {},
  );

describe("rollSession — distances", () => {
  it("stays inside the requested range", () => {
    for (const seed of [1, 2, 3, 99]) {
      for (const p of rollSession(40, 5, 12, seeded(seed))) {
        expect(p.distanceFt).toBeGreaterThanOrEqual(5);
        expect(p.distanceFt).toBeLessThanOrEqual(12);
        expect(Number.isInteger(p.distanceFt)).toBe(true);
      }
    }
  });

  it("never calls the same distance twice in a row", () => {
    for (const seed of [1, 7, 42, 1234]) {
      const putts = rollSession(60, 5, 12, seeded(seed));
      for (let i = 1; i < putts.length; i++) {
        expect(putts[i].distanceFt).not.toBe(putts[i - 1].distanceFt);
      }
    }
  });

  it("handles a single-distance range without looping forever", () => {
    const putts = rollSession(5, 7, 7, seeded(1));
    expect(putts).toHaveLength(5);
    expect(putts.every((p) => p.distanceFt === 7)).toBe(true);
  });

  it("tolerates a reversed range", () => {
    const putts = rollSession(10, 12, 5, seeded(3));
    for (const p of putts) {
      expect(p.distanceFt).toBeGreaterThanOrEqual(5);
      expect(p.distanceFt).toBeLessThanOrEqual(12);
    }
  });

  it("returns nothing for a non-positive count", () => {
    expect(rollSession(0, 5, 12, seeded(1))).toEqual([]);
    expect(rollSession(-3, 5, 12, seeded(1))).toEqual([]);
  });
});

describe("rollSession — balanced reads", () => {
  it("deals break directions exactly evenly when count divides by 3", () => {
    // The whole point: an unbalanced sample lets a READ fault masquerade as a
    // STROKE bias, because under-reading misses right on L2R and left on R2L.
    for (const seed of [1, 2, 3, 4, 5, 77]) {
      const counts = tally(
        rollSession(18, 5, 12, seeded(seed)).map((p) => p.breakDirection),
      );
      expect(counts.l2r).toBe(6);
      expect(counts.r2l).toBe(6);
      expect(counts.straight).toBe(6);
    }
  });

  it("balances elevation too, for the same reason against the speed gauge", () => {
    for (const seed of [1, 9, 31]) {
      const counts = tally(
        rollSession(18, 5, 12, seeded(seed)).map((p) => p.elevation),
      );
      expect(counts.uphill).toBe(6);
      expect(counts.downhill).toBe(6);
      expect(counts.flat).toBe(6);
    }
  });

  it("never lets a break direction run away when the count doesn't divide by 3", () => {
    // 20 putts can't split evenly; the most any option may take is ceil(20/3).
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const counts = tally(
        rollSession(20, 5, 12, seeded(seed)).map((p) => p.breakDirection),
      );
      for (const n of Object.values(counts)) {
        expect(n).toBeGreaterThanOrEqual(6);
        expect(n).toBeLessThanOrEqual(7);
      }
    }
  });

  it("beats independent draws, which skew badly at session size", () => {
    // Guards against anyone "simplifying" the deck back to per-putt random.
    const rng = seeded(5);
    const BREAKS: BreakDirection[] = ["l2r", "r2l", "straight"];
    let worstIndependent = 0;
    for (let trial = 0; trial < 200; trial++) {
      const drawn = Array.from(
        { length: 18 },
        () => BREAKS[Math.floor(rng() * 3)],
      );
      const counts = tally(drawn);
      worstIndependent = Math.max(worstIndependent, ...Object.values(counts));
    }
    // Independent draws routinely produce a 9+ run of one break...
    expect(worstIndependent).toBeGreaterThanOrEqual(9);
    // ...where the deck is pinned at exactly 6.
    const dealt = tally(
      rollSession(18, 5, 12, seeded(5)).map((p) => p.breakDirection),
    );
    expect(Math.max(...Object.values(dealt))).toBe(6);
  });

  it("does not deal the same order every session", () => {
    const a = rollSession(18, 5, 12, seeded(1)).map((p) => p.breakDirection);
    const b = rollSession(18, 5, 12, seeded(2)).map((p) => p.breakDirection);
    expect(a).not.toEqual(b);
  });

  it("is reproducible for a given seed", () => {
    expect(rollSession(12, 5, 12, seeded(8))).toEqual(
      rollSession(12, 5, 12, seeded(8)),
    );
  });

  it("spreads the remainder rather than always favouring the same option", () => {
    // With 19 putts one option gets the extra; across seeds it must vary,
    // otherwise the deck quietly reintroduces a systematic lean.
    const favoured = new Set<Elevation>();
    for (let seed = 1; seed <= 40; seed++) {
      const counts = tally(
        rollSession(19, 5, 12, seeded(seed)).map((p) => p.elevation),
      );
      for (const [k, n] of Object.entries(counts)) {
        if (n === 7) favoured.add(k as Elevation);
      }
    }
    expect(favoured.size).toBeGreaterThan(1);
  });
});

describe("seededRandom", () => {
  // The fallback sequence is rolled during render, which happens on BOTH the
  // server and the client. An unseeded roll gives each a different putt, which
  // React reports as a hydration mismatch and recovers from by discarding the
  // server tree — so the player can be shown one putt and handed another.
  it("gives an identical sequence for the same seed", () => {
    const a = Array.from({ length: 8 }, seededRandom("session-abc"));
    const b = Array.from({ length: 8 }, seededRandom("session-abc"));
    expect(a).toEqual(b);
  });

  it("gives different sequences for different seeds", () => {
    const a = Array.from({ length: 8 }, seededRandom("session-abc"));
    const b = Array.from({ length: 8 }, seededRandom("session-xyz"));
    expect(a).not.toEqual(b);
  });

  it("produces a session reproducible from its id alone", () => {
    expect(rollSession(12, 5, 12, seededRandom("abc"))).toEqual(
      rollSession(12, 5, 12, seededRandom("abc")),
    );
  });

  it("stays in [0, 1)", () => {
    const r = seededRandom("whatever");
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
