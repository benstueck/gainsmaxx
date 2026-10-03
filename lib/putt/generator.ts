import type { BreakDirection, Elevation, PuttSpec } from "./types";

const BREAKS: BreakDirection[] = ["l2r", "r2l", "straight"];
const ELEVATIONS: Elevation[] = ["uphill", "downhill", "flat"];

/**
 * A deterministic PRNG seeded from a string (mulberry32 over an FNV-1a hash).
 *
 * Needed because the fallback sequence is rolled during render, and render
 * happens on BOTH the server and the client. `Math.random()` there produces a
 * different putt in each, which React reports as a hydration mismatch and
 * recovers from by throwing away the server tree — so the player could be
 * shown one putt, then silently handed another. Seeding from the session id
 * makes both sides agree, and keeps the same session showing the same putt
 * across reloads.
 */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates, using an injectable source so sessions are reproducible in tests. */
function shuffle<T>(items: T[], random: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Deal `count` values from `options` as evenly as possible, then shuffle.
 *
 * The remainder when count isn't divisible by the option count is itself dealt
 * from a shuffled pool, so the surplus doesn't always land on the same option.
 */
function balancedDeck<T>(
  options: T[],
  count: number,
  random: () => number,
): T[] {
  const each = Math.floor(count / options.length);
  const deck: T[] = [];
  for (const option of options) {
    for (let i = 0; i < each; i++) deck.push(option);
  }
  const remainder = count - deck.length;
  if (remainder > 0) deck.push(...shuffle(options, random).slice(0, remainder));
  return shuffle(deck, random);
}

/** Uniform whole feet in [lo, hi], excluding `previous` when it's in range. */
function nextDistance(
  lo: number,
  hi: number,
  previous: number | null,
  random: () => number,
): number {
  const span = hi - lo + 1;
  if (span <= 1) return lo;
  const excludes = previous != null && previous >= lo && previous <= hi;
  if (!excludes) {
    return lo + Math.min(span - 1, Math.floor(random() * span));
  }
  // Draw from the span minus the excluded value, then step over it.
  const pick = lo + Math.min(span - 2, Math.floor(random() * (span - 1)));
  return pick >= previous ? pick + 1 : pick;
}

/**
 * Roll a whole session's putts up front.
 *
 * Dealt as a sequence rather than putt-by-putt because **break directions must
 * be balanced by construction**. Drawing independently, 11 L2R and 4 R2L in an
 * 18-putt session is entirely ordinary — and in that session a pure *read*
 * fault leaks into the *direction* gauge as a fake stroke bias, sending the
 * player off to rebuild a stroke that was never broken. No amount of care in
 * the analytics recovers from a skewed sample, so it's fixed at the source.
 *
 * Elevation is balanced too, on the same argument against the speed gauge.
 *
 * Rolling up front also means a reload or force-quit hands back the *same*
 * putt instead of re-rolling it, and the offline layer gets the sequence free.
 */
export function rollSession(
  count: number,
  minDistanceFt: number,
  maxDistanceFt: number,
  random: () => number = Math.random,
): PuttSpec[] {
  if (count <= 0) return [];
  const lo = Math.ceil(Math.min(minDistanceFt, maxDistanceFt));
  const hi = Math.floor(Math.max(minDistanceFt, maxDistanceFt));

  const breaks = balancedDeck(BREAKS, count, random);
  const elevations = balancedDeck(ELEVATIONS, count, random);

  const putts: PuttSpec[] = [];
  let previous: number | null = null;
  for (let i = 0; i < count; i++) {
    const distanceFt = nextDistance(lo, hi, previous, random);
    previous = distanceFt;
    putts.push({
      distanceFt,
      elevation: elevations[i],
      breakDirection: breaks[i],
    });
  }
  return putts;
}
