/** Public API for the strokes-gained engine. Pure + framework-free — runs
 *  identically on the client (offline) and the server. */
export {
  interpolate,
  expectedStrokes,
  categorize,
  strokesGainedForShot,
  holeStrokesGained,
  handicapAdjustment,
  roundStrokesGained,
  ARG_MAX_YARDS,
} from "./engine";

export { benchmarks } from "./data";

export type {
  Lie,
  SgCategory,
  Baseline,
  ShotInput,
  HoleInput,
  CategoryTotals,
  ShotResult,
  HoleSummary,
  RoundSummary,
} from "./types";
