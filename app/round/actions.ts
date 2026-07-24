"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getProfile } from "@/lib/db/queries";
import {
  rounds,
  holes as holesTable,
  shots as shotsTable,
} from "@/lib/db/schema";
import { holeShotInputs, type HoleState } from "@/lib/round";
import { strokesGainedForShot } from "@/lib/sg";

/** Create a new in-progress round and enter its tracking session. */
export async function createRound(
  numHoles: number,
  courseName: string | null,
): Promise<void> {
  const user = await requireUser();
  const db = getDb();
  const profile = await getProfile(user.id);

  const [row] = await db
    .insert(rounds)
    .values({
      userId: user.id,
      clientUuid: randomUUID(),
      numHoles,
      courseName: courseName?.trim() || null,
      baselineSnapshot: profile?.handicap ?? null,
      status: "in_progress",
    })
    .returning({ id: rounds.id });

  redirect(`/round/${row.id}`);
}

/** Replace a round's holes/shots with the given state, computing per-shot SG. */
async function persist(
  roundId: string,
  holeStates: HoleState[],
): Promise<void> {
  const user = await requireUser();
  const db = getDb();

  const [round] = await db
    .select({ id: rounds.id })
    .from(rounds)
    .where(and(eq(rounds.id, roundId), eq(rounds.userId, user.id)))
    .limit(1);
  if (!round) throw new Error("Round not found");

  // Simple, idempotent replace — a round is small.
  await db.delete(holesTable).where(eq(holesTable.roundId, roundId));

  for (const hole of holeStates) {
    if (hole.length == null && hole.shots.length === 0) continue;

    const [holeRow] = await db
      .insert(holesTable)
      .values({ roundId, holeNumber: hole.holeNumber, par: hole.par })
      .returning({ id: holesTable.id });

    const inputs = holeShotInputs(hole);
    const values = inputs.map((si, i) => {
      const { category, sg } = strokesGainedForShot(si, hole.par);
      return {
        holeId: holeRow.id,
        shotNumber: i + 1,
        startLie: si.startLie,
        startDistance: String(si.startDistance),
        endLie: si.endLie,
        endDistance: si.endDistance == null ? null : String(si.endDistance),
        isHoled: si.isHoled,
        penaltyStrokes: si.penaltyStrokes,
        isOb: si.penaltyStrokes === 2,
        sgCategory: category,
        sgValue: String(sg),
      };
    });
    if (values.length > 0) await db.insert(shotsTable).values(values);
  }

  await db
    .update(rounds)
    .set({ updatedAt: new Date() })
    .where(eq(rounds.id, roundId));
}

/** Autosave the in-progress round. */
export async function saveRound(
  roundId: string,
  holeStates: HoleState[],
): Promise<void> {
  await persist(roundId, holeStates);
}

/** Persist final state, mark the round complete, and return to the feed. */
export async function finishRound(
  roundId: string,
  holeStates: HoleState[],
): Promise<void> {
  await persist(roundId, holeStates);
  const user = await requireUser();
  const db = getDb();
  await db
    .update(rounds)
    .set({ status: "complete", updatedAt: new Date() })
    .where(and(eq(rounds.id, roundId), eq(rounds.userId, user.id)));
  redirect(`/round/${roundId}/summary`);
}
