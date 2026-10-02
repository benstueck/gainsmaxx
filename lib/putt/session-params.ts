/**
 * Session setup parameters and their validation.
 *
 * Lives here rather than beside the server actions because a "use server"
 * module may only export async functions — constants and a synchronous
 * validator in that file break the build, and neither tsc nor eslint catches
 * it. Keeping it in the pure engine also lets the client form and the server
 * action share exactly one definition of "valid".
 */

export const DEFAULT_PUTT_COUNT = 18;

/**
 * 5–12 ft by default, chosen for *information* rather than difficulty.
 *
 * 8 ft is a coin flip on the Tour table, and a coin flip yields the most misses
 * per putt attempted — misses being the only thing that feeds the bias
 * analytics. Below 5 ft you hole ~80%+, so a session produces too few misses to
 * separate a real bias from noise; above ~15 ft the drill quietly becomes lag
 * putting, where holing out isn't the goal at all.
 */
export const DEFAULT_MIN_DISTANCE_FT = 5;
export const DEFAULT_MAX_DISTANCE_FT = 12;

export const MIN_PUTTS = 1;
export const MAX_PUTTS = 100;
export const MIN_DISTANCE_FT = 1;
export const MAX_DISTANCE_FT = 60;

/** Mirrors the DB check constraints. Returns null when valid. */
export function validateSessionParams(
  puttCount: number,
  minDistanceFt: number,
  maxDistanceFt: number,
): string | null {
  if (
    !Number.isInteger(puttCount) ||
    puttCount < MIN_PUTTS ||
    puttCount > MAX_PUTTS
  ) {
    return `Enter a putt count between ${MIN_PUTTS} and ${MAX_PUTTS}.`;
  }
  if (
    !Number.isInteger(minDistanceFt) ||
    minDistanceFt < MIN_DISTANCE_FT ||
    minDistanceFt > MAX_DISTANCE_FT
  ) {
    return `Enter a minimum distance between ${MIN_DISTANCE_FT} and ${MAX_DISTANCE_FT} feet.`;
  }
  if (
    !Number.isInteger(maxDistanceFt) ||
    maxDistanceFt < minDistanceFt ||
    maxDistanceFt > MAX_DISTANCE_FT
  ) {
    return `Maximum distance must be between the minimum and ${MAX_DISTANCE_FT} feet.`;
  }
  return null;
}
