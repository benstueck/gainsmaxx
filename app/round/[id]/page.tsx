import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getProfile } from "@/lib/db/queries";
import { rounds, holes as holesT, shots as shotsT } from "@/lib/db/schema";
import { RoundSession } from "@/components/round/round-session";
import type { HoleState, ShotEnd } from "@/lib/round";

export default async function RoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const db = getDb();

  const [round] = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.id, id), eq(rounds.userId, user.id)))
    .limit(1);
  if (!round) notFound();

  const holeRows = await db
    .select()
    .from(holesT)
    .where(eq(holesT.roundId, id))
    .orderBy(asc(holesT.holeNumber));
  const holeIds = holeRows.map((h) => h.id);
  const shotRows = holeIds.length
    ? await db
        .select()
        .from(shotsT)
        .where(inArray(shotsT.holeId, holeIds))
        .orderBy(asc(shotsT.shotNumber))
    : [];

  const initialHoles: HoleState[] = holeRows.map((h) => {
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

  const profile = await getProfile(user.id);
  const handicap = profile?.handicap != null ? Number(profile.handicap) : null;

  return (
    <RoundSession
      roundId={id}
      numHoles={round.numHoles}
      handicap={handicap}
      initialHoles={initialHoles}
    />
  );
}
