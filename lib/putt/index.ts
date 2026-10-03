/** Public API for the Puttmaxx engine. Pure + framework-free — runs
 *  identically on the client (offline) and the server.
 *
 *  Design: plans/03-puttmaxx.md */
export {
  expectedPutts,
  puttsTaken,
  holeSg,
  firstPuttSg,
  missSide,
  comebackRead,
  scoreAttempt,
} from "./engine";

export { rollSession, seededRandom } from "./generator";

export { parsePutts } from "./parse";

export { summarizeSession } from "./analytics";
export { puttCareerStats } from "./career-stats";
export type { PuttCareerStats } from "./career-stats";
export type {
  MissCell,
  PuttDistanceBand,
  PuttSessionSummary,
} from "./analytics";

export { detectBias, twoSidedBinomialP, BIAS_ALPHA } from "./stats";
export type { BiasResult } from "./stats";

export {
  DEFAULT_PUTT_COUNT,
  DEFAULT_MIN_DISTANCE_FT,
  DEFAULT_MAX_DISTANCE_FT,
  MIN_PUTTS,
  MAX_PUTTS,
  MIN_DISTANCE_FT,
  MAX_DISTANCE_FT,
  validateSessionParams,
} from "./session-params";

export type {
  BreakDirection,
  Elevation,
  SpeedError,
  LineError,
  MissSide,
  PuttSpec,
  PuttAttempt,
  PuttAttemptResult,
} from "./types";
