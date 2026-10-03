/**
 * The significance machinery behind the bias gauges.
 *
 * Kept separate from the putting domain because it's pure statistics, and
 * because it's the part most worth testing in isolation: everything the
 * summary claims about a "tendency" rests on it.
 */

/** Two-sided p below this is required before a lean is *called* a bias. */
export const BIAS_ALPHA = 0.05;

/** log C(n, k), summed termwise so large n can't overflow a float. */
function logChoose(n: number, k: number): number {
  let r = 0;
  for (let i = 1; i <= k; i++) r += Math.log(n - i + 1) - Math.log(i);
  return r;
}

/**
 * Two-sided exact binomial p-value against a fair-coin null.
 *
 * The null is "this player has no tendency", i.e. each miss is equally likely
 * to fall either side. Exact rather than a normal approximation because the
 * samples here are small — an 18-putt session yields ~10 misses, exactly where
 * the approximation is least trustworthy.
 */
export function twoSidedBinomialP(a: number, b: number): number {
  const n = a + b;
  if (n === 0) return 1;
  const k = Math.max(a, b);
  const logHalfN = -n * Math.LN2;
  let tail = 0;
  for (let i = k; i <= n; i++) tail += Math.exp(logChoose(n, i) + logHalfN);
  return Math.min(1, 2 * tail);
}

export interface BiasResult<T extends string> {
  /** The two opposing outcomes, in the order their counts are reported. */
  sides: readonly [T, T];
  counts: readonly [number, number];
  /** Total observations — the denominator the gauge should be read against. */
  n: number;
  /** −1 = entirely the first side, +1 = entirely the second, 0 = even. */
  tilt: number;
  /**
   * The dominant side's share, 0.5 (dead even) to 1 (unanimous).
   *
   * This is the *descriptive* number, and it's always shown. 78% low is worth
   * knowing even at p = 0.18: it's what actually happened, and a player
   * reading their own trends is better served by the proportion than by a
   * verdict withheld. `significant` stays separate for the claim.
   */
  share: number;
  /** Which way it leans. Null only when dead even (or empty). */
  leaning: T | null;
  pValue: number;
  /**
   * Whether the sample actually supports calling this a bias.
   *
   * This is the whole point. With 10 misses a 6–4 split is the single most
   * likely outcome for a player with *no* tendency at all; reporting it as a
   * bias would send them to the range to fix a problem they don't have, which
   * is strictly worse than saying nothing. The gauge still renders the tilt —
   * the user can see the raw counts — but the verdict stays silent until the
   * evidence earns it.
   *
   * Note three gauges are tested per session, so roughly 1 session in 7 will
   * show a spurious call at this alpha. Over repeated sessions a real tendency
   * recurs and a spurious one doesn't, which is the honest way to read it.
   */
  significant: boolean;
}

/** Compare two opposing counts and decide whether the lean is real. */
export function detectBias<T extends string>(
  sides: readonly [T, T],
  counts: readonly [number, number],
): BiasResult<T> {
  const [a, b] = counts;
  const n = a + b;
  const pValue = twoSidedBinomialP(a, b);
  return {
    sides,
    counts,
    n,
    tilt: n === 0 ? 0 : (b - a) / n,
    share: n === 0 ? 0 : Math.max(a, b) / n,
    leaning: a === b ? null : a > b ? sides[0] : sides[1],
    pValue,
    significant: n > 0 && a !== b && pValue < BIAS_ALPHA,
  };
}
