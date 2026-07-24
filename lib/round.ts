import type { Lie, ShotInput } from "@/lib/sg";

/**
 * Local round-session domain. The key idea: a shot only records where the ball
 * ENDED UP (end lie + distance, or holed) plus any penalty. Each shot's START is
 * DERIVED — Tee + hole length for shot 1, otherwise the previous shot's end — so
 * editing a shot automatically re-chains everything after it.
 */

export type ShotEnd = {
  /** Null when holed. */
  endLie: Lie | null;
  /** Null when holed. Yards, or feet when endLie is "green". */
  endDistance: number | null;
  isHoled: boolean;
  /** 0 = none, 1 = penalty drop, 2 = OOB / stroke-and-distance. */
  penaltyStrokes: number;
};

export type HoleState = {
  holeNumber: number;
  par: number;
  /** Hole length in yards = the tee shot's start distance. */
  length: number | null;
  shots: ShotEnd[];
};

export const DEFAULT_PAR = 4;

export function makeHole(holeNumber: number): HoleState {
  return { holeNumber, par: DEFAULT_PAR, length: null, shots: [] };
}

/** Distance unit for a lie: feet on the green, yards everywhere else. */
export function unitFor(lie: Lie): "yd" | "ft" {
  return lie === "green" ? "ft" : "yd";
}

/** Whether the hole has been holed out. */
export function isHoleComplete(hole: HoleState): boolean {
  return hole.shots.some((s) => s.isHoled);
}

/**
 * The start position for the NEXT shot to enter (Tee + length, or the last
 * shot's end). Returns null if the hole has no length yet or is already complete.
 */
export function nextStart(
  hole: HoleState,
): { lie: Lie; distance: number } | null {
  if (hole.length == null) return null;
  let lie: Lie = "tee";
  let distance = hole.length;
  for (const s of hole.shots) {
    if (s.isHoled) return null;
    if (s.endLie == null || s.endDistance == null) return null;
    lie = s.endLie;
    distance = s.endDistance;
  }
  return { lie, distance };
}

/** Derive the engine ShotInput[] for a hole by chaining starts through ends. */
export function holeShotInputs(hole: HoleState): ShotInput[] {
  const inputs: ShotInput[] = [];
  let startLie: Lie = "tee";
  let startDistance = hole.length ?? 0;
  for (const s of hole.shots) {
    inputs.push({
      startLie,
      startDistance,
      endLie: s.isHoled ? null : s.endLie,
      endDistance: s.isHoled ? null : s.endDistance,
      isHoled: s.isHoled,
      penaltyStrokes: s.penaltyStrokes,
    });
    if (!s.isHoled && s.endLie != null && s.endDistance != null) {
      startLie = s.endLie;
      startDistance = s.endDistance;
    }
  }
  return inputs;
}
