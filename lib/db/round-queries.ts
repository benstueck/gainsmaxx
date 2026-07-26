import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./index";
import { rounds, holes as holesT, shots as shotsT } from "./schema";
import { holeShotInputs, type HoleState, type ShotEnd } from "@/lib/round";
import { roundStrokesGained, type Baseline, type RoundSummary } from "@/lib/sg";

type HoleRow = typeof holesT.$inferSelect;
type ShotRow = typeof shotsT.$inferSelect;

/** Reconstruct the local HoleState[] for one round from its DB rows. */
function toHoleStates(holeRows: HoleRow[], shotRows: ShotRow[]): HoleState[] {
  return holeRows
    .slice()
    .sort((a, b) => a.holeNumber - b.holeNumber)
    .map((h) => {
      const hs = shotRows
        .filter((s) => s.holeId === h.id)
        .sort((a, b) => a.shotNumber - b.shotNumber);
      // Shot 1's start distance is the hole length.
      const length = hs.length ? Number(hs[0].startDistance) : null;
      const shots: ShotEnd[] = hs.map((s) => ({
        endLie: s.endLie,
        endDistance: s.endDistance != null ? Number(s.endDistance) : null,
        isHoled: s.isHoled,
        penaltyStrokes: s.penaltyStrokes,
      }));
      return { holeNumber: h.holeNumber, par: h.par, length, shots };
    });
}

export type LoadedRound = {
  round: typeof rounds.$inferSelect;
  holes: HoleState[];
};

/** Load one round the user owns, with its reconstructed holes. Null if not owned. */
export async function loadRound(
  roundId: string,
  userId: string,
): Promise<LoadedRound | null> {
  const db = getDb();

  const [round] = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.id, roundId), eq(rounds.userId, userId)))
    .limit(1);
  if (!round) return null;

  const holeRows = await db
    .select()
    .from(holesT)
    .where(eq(holesT.roundId, roundId))
    .orderBy(asc(holesT.holeNumber));
  const holeIds = holeRows.map((h) => h.id);
  const shotRows = holeIds.length
    ? await db
        .select()
        .from(shotsT)
        .where(inArray(shotsT.holeId, holeIds))
        .orderBy(asc(shotsT.shotNumber))
    : [];

  return { round, holes: toHoleStates(holeRows, shotRows) };
}

export type FeedRound = {
  id: string;
  playedAt: string;
  courseName: string | null;
  numHoles: number;
  status: "in_progress" | "complete";
  summary: RoundSummary;
};

/**
 * Load all of a user's rounds (newest first) with a computed SG summary vs the
 * given baseline. Three queries total regardless of round count.
 */
export async function loadUserRounds(
  userId: string,
  baseline: Baseline,
): Promise<FeedRound[]> {
  const db = getDb();

  const roundRows = await db
    .select()
    .from(rounds)
    .where(eq(rounds.userId, userId))
    .orderBy(desc(rounds.playedAt));
  if (roundRows.length === 0) return [];

  const roundIds = roundRows.map((r) => r.id);
  const holeRows = await db
    .select()
    .from(holesT)
    .where(inArray(holesT.roundId, roundIds));
  const holeIds = holeRows.map((h) => h.id);
  const shotRows = holeIds.length
    ? await db.select().from(shotsT).where(inArray(shotsT.holeId, holeIds))
    : [];

  return roundRows.map((round) => {
    const roundHoleRows = holeRows.filter((h) => h.roundId === round.id);
    const holes = toHoleStates(roundHoleRows, shotRows);
    const summary = roundStrokesGained(
      holes.map((h) => ({ par: h.par, shots: holeShotInputs(h) })),
      baseline,
    );
    return {
      id: round.id,
      playedAt: round.playedAt.toISOString(),
      courseName: round.courseName,
      numHoles: round.numHoles,
      status: round.status,
      summary,
    };
  });
}
