import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "./index";
import { rounds, holes as holesT, shots as shotsT } from "./schema";
import type { HoleState, ShotEnd } from "@/lib/round";

export type LoadedRound = {
  round: typeof rounds.$inferSelect;
  holes: HoleState[];
};

/**
 * Load a round the user owns, reconstructing the local HoleState[] used by both
 * the tracking session and the summary. Returns null if not found / not owned.
 */
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

  const holes: HoleState[] = holeRows.map((h) => {
    const hs = shotRows.filter((s) => s.holeId === h.id);
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

  return { round, holes };
}
