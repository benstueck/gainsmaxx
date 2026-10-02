"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { puttSessions, puttAttempts } from "@/lib/db/schema";
import { rollSession, validateSessionParams } from "@/lib/putt";
import type { PuttAttempt } from "@/lib/putt";

/** Create an in-progress session and enter it. */
export async function createPuttSession(
  puttCount: number,
  minDistance: number,
  maxDistance: number,
): Promise<void> {
  const user = await requireUser();

  const invalid = validateSessionParams(puttCount, minDistance, maxDistance);
  if (invalid) throw new Error(invalid);

  // Rolled here, as a whole sequence, for three reasons: a reload or
  // force-quit hands back the SAME putt rather than re-rolling it, the offline
  // layer gets the sequence without needing the server, and — the one that
  // actually matters — break directions can only be balanced across the
  // session if they're dealt together. An unbalanced session lets a read fault
  // masquerade as a stroke bias in the summary.
  const putts = rollSession(puttCount, minDistance, maxDistance);

  const db = getDb();
  const [row] = await db
    .insert(puttSessions)
    .values({
      userId: user.id,
      clientUuid: randomUUID(),
      puttCount,
      minDistance,
      maxDistance,
      putts,
      status: "in_progress",
    })
    .returning({ id: puttSessions.id });

  redirect(`/puttmaxx/${row.id}`);
}

/** Permanently remove a session and every attempt in it. */
export async function deletePuttSession(sessionId: string): Promise<void> {
  const user = await requireUser();
  const db = getDb();
  await db
    .delete(puttSessions)
    .where(
      and(eq(puttSessions.id, sessionId), eq(puttSessions.userId, user.id)),
    );
  redirect("/puttmaxx");
}

/**
 * Replace a session's attempts with the client's current state.
 *
 * A full replace rather than an append: it makes the write idempotent, so a
 * retried save after a dropped connection can't double-insert, and editing an
 * earlier putt needs no separate path. At ≤100 rows per session the cost is
 * irrelevant next to getting resync right.
 */
async function writeAttempts(
  sessionId: string,
  userId: string,
  attempts: PuttAttempt[],
  elapsedSeconds: number,
  status?: "complete",
) {
  const db = getDb();

  // Ownership check first — everything below trusts the session id.
  const [session] = await db
    .select({ id: puttSessions.id })
    .from(puttSessions)
    .where(and(eq(puttSessions.id, sessionId), eq(puttSessions.userId, userId)))
    .limit(1);
  if (!session) throw new Error("Session not found.");

  await db.delete(puttAttempts).where(eq(puttAttempts.sessionId, sessionId));
  if (attempts.length > 0) {
    await db.insert(puttAttempts).values(
      attempts.map((a, i) => ({
        sessionId,
        puttNumber: i + 1,
        distance: a.distanceFt,
        elevation: a.elevation,
        breakDirection: a.breakDirection,
        made: a.made,
        speedError: a.speedError,
        lineError: a.lineError,
        misreadLine: a.misreadLine,
        misreadSpeed: a.misreadSpeed,
        comebackDistance: a.comebackDistanceFt,
        comebackMade: a.comebackMade,
        comebackSpeedError: a.comebackSpeedError,
        comebackLineError: a.comebackLineError,
      })),
    );
  }

  await db
    .update(puttSessions)
    .set({
      elapsedSeconds,
      updatedAt: new Date(),
      ...(status ? { status } : {}),
    })
    .where(eq(puttSessions.id, sessionId));
}

/** Autosave mid-session. */
export async function savePuttSession(
  sessionId: string,
  attempts: PuttAttempt[],
  elapsedSeconds: number,
): Promise<void> {
  const user = await requireUser();
  await writeAttempts(sessionId, user.id, attempts, elapsedSeconds);
}

/** Finish — scores over the putts actually hit, so ending early is honest. */
export async function finishPuttSession(
  sessionId: string,
  attempts: PuttAttempt[],
  elapsedSeconds: number,
): Promise<void> {
  const user = await requireUser();
  await writeAttempts(sessionId, user.id, attempts, elapsedSeconds, "complete");
  redirect(`/puttmaxx/${sessionId}/summary`);
}
