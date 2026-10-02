"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { puttSessions } from "@/lib/db/schema";
import { rollSession, validateSessionParams } from "@/lib/putt";

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
