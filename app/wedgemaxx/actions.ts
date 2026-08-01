"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { wedgeSessions, wedgeShots as wedgeShotsTable } from "@/lib/db/schema";
import { validateSessionParams, type WedgeShot } from "@/lib/wedge";

/** Create a new in-progress session and enter it. */
export async function createWedgeSession(
  ballCount: number,
  minDistance: number,
  maxDistance: number,
): Promise<void> {
  const user = await requireUser();

  const invalid = validateSessionParams(ballCount, minDistance, maxDistance);
  if (invalid) throw new Error(invalid);

  const db = getDb();
  const [row] = await db
    .insert(wedgeSessions)
    .values({
      userId: user.id,
      clientUuid: randomUUID(),
      ballCount,
      minDistance,
      maxDistance,
      status: "in_progress",
    })
    .returning({ id: wedgeSessions.id });

  redirect(`/wedgemaxx/${row.id}`);
}

/** Owned-session guard shared by the mutating actions. */
async function requireOwnedSession(sessionId: string, userId: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: wedgeSessions.id })
    .from(wedgeSessions)
    .where(
      and(eq(wedgeSessions.id, sessionId), eq(wedgeSessions.userId, userId)),
    )
    .limit(1);
  if (!row) throw new Error("Session not found");
  return db;
}

/**
 * Replace the session's shots wholesale. Simple and idempotent — a session is
 * at most a couple hundred rows, and this keeps edits/undo from needing any
 * diffing. Points are never written; they're always derived on read.
 */
export async function saveWedgeSession(
  sessionId: string,
  shots: WedgeShot[],
  elapsedSeconds: number,
): Promise<void> {
  const user = await requireUser();
  const db = await requireOwnedSession(sessionId, user.id);

  await db
    .delete(wedgeShotsTable)
    .where(eq(wedgeShotsTable.sessionId, sessionId));
  if (shots.length > 0) {
    await db.insert(wedgeShotsTable).values(
      shots.map((s, i) => ({
        sessionId,
        shotNumber: i + 1,
        targetDistance: s.targetDistance,
        // Null carry is the mishit flag — preserved end to end.
        carryDistance: s.carryDistance,
      })),
    );
  }
  await db
    .update(wedgeSessions)
    .set({ elapsedSeconds, updatedAt: new Date() })
    .where(eq(wedgeSessions.id, sessionId));
}

/** Persist final state, mark complete, and open the session's summary. */
export async function finishWedgeSession(
  sessionId: string,
  shots: WedgeShot[],
  elapsedSeconds: number,
): Promise<void> {
  await saveWedgeSession(sessionId, shots, elapsedSeconds);
  const user = await requireUser();
  const db = getDb();
  await db
    .update(wedgeSessions)
    .set({ status: "complete", updatedAt: new Date() })
    .where(
      and(eq(wedgeSessions.id, sessionId), eq(wedgeSessions.userId, user.id)),
    );
  redirect(`/wedgemaxx/${sessionId}/summary`);
}

/** Permanently remove a session and its shots (cascade). */
export async function deleteWedgeSession(sessionId: string): Promise<void> {
  const user = await requireUser();
  const db = getDb();
  await db
    .delete(wedgeSessions)
    .where(
      and(eq(wedgeSessions.id, sessionId), eq(wedgeSessions.userId, user.id)),
    );
  redirect("/wedgemaxx");
}
