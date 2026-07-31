/**
 * Session setup parameters and their validation.
 *
 * Lives here rather than beside the server actions because a "use server"
 * module may only export async functions — constants and a synchronous
 * validator in that file break the build (and neither tsc nor eslint catches
 * it). Keeping it in the pure engine also lets the client form and the server
 * action share exactly one definition of "valid".
 */

export const DEFAULT_BALL_COUNT = 40;
export const DEFAULT_MIN_DISTANCE = 50;
export const DEFAULT_MAX_DISTANCE = 140;

export const MIN_BALLS = 1;
export const MAX_BALLS = 200;

/** Mirrors the DB check constraints. Returns null when valid. */
export function validateSessionParams(
  ballCount: number,
  minDistance: number,
  maxDistance: number,
): string | null {
  if (
    !Number.isInteger(ballCount) ||
    ballCount < MIN_BALLS ||
    ballCount > MAX_BALLS
  ) {
    return `Enter a ball count between ${MIN_BALLS} and ${MAX_BALLS}.`;
  }
  if (!Number.isInteger(minDistance) || minDistance < 1) {
    return "Enter a minimum distance of at least 1 yard.";
  }
  if (!Number.isInteger(maxDistance) || maxDistance < minDistance) {
    return "Maximum distance must be at least the minimum.";
  }
  return null;
}
