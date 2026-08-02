/** Public API for the Wedgemaxx scoring engine. Pure + framework-free — runs
 *  identically on the client (offline) and the server.
 *
 *  Design & scoring derivation: plans/02-wedgemaxx.md */
export {
  BASE_POINTS,
  POINTS_PER_STROKE,
  shotDeltaYd,
  shotProximityYd,
  wedgeShotSg,
  wedgeShotPoints,
  tourProximityYd,
  tourSigmaYd,
  tourDistanceErrorYd,
  referenceSg,
  scoreShot,
  sessionSummary,
  nextTarget,
} from "./engine";

export {
  DEFAULT_BALL_COUNT,
  DEFAULT_MIN_DISTANCE,
  DEFAULT_MAX_DISTANCE,
  MIN_BALLS,
  MAX_BALLS,
  validateSessionParams,
} from "./session-params";

export { formatDuration, formatClock } from "./format";

export { wedgeCareerStats } from "./career-stats";
export type { WedgeCareerStats } from "./career-stats";

export { distanceBreakdown } from "./distance-breakdown";
export type { DistanceBand } from "./distance-breakdown";

export type { WedgeShot, WedgeShotResult, WedgeSessionSummary } from "./types";
