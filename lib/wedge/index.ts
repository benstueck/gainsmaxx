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

export type { WedgeShot, WedgeShotResult, WedgeSessionSummary } from "./types";
