import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./index";
import { wedgeSessions, wedgeShots as wedgeShotsT } from "./schema";
import { sessionSummary } from "@/lib/wedge";
import type { WedgeShot, WedgeSessionSummary } from "@/lib/wedge";

type SessionRow = typeof wedgeSessions.$inferSelect;
type ShotRow = typeof wedgeShotsT.$inferSelect;

/**
 * Points are always DERIVED here, never read from a stored column — exactly
 * like round SG in round-queries.ts. Retuning the scoring calibration then
 * re-scores all history consistently instead of leaving stale values behind.
 */
function toWedgeShots(rows: ShotRow[]): WedgeShot[] {
  return rows
    .slice()
    .sort((a, b) => a.shotNumber - b.shotNumber)
    .map((s) => ({
      targetDistance: s.targetDistance,
      // Null carry is the mishit flag; it flows straight through to the engine.
      carryDistance: s.carryDistance,
    }));
}

export type LoadedWedgeSession = {
  session: SessionRow;
  shots: WedgeShot[];
};

/** Load one session the user owns, with its shots. Null if not owned. */
export async function loadWedgeSession(
  sessionId: string,
  userId: string,
): Promise<LoadedWedgeSession | null> {
  const db = getDb();

  const [session] = await db
    .select()
    .from(wedgeSessions)
    .where(
      and(eq(wedgeSessions.id, sessionId), eq(wedgeSessions.userId, userId)),
    )
    .limit(1);
  if (!session) return null;

  const shotRows = await db
    .select()
    .from(wedgeShotsT)
    .where(eq(wedgeShotsT.sessionId, sessionId))
    .orderBy(asc(wedgeShotsT.shotNumber));

  return { session, shots: toWedgeShots(shotRows) };
}

export type FeedWedgeSession = {
  id: string;
  startedAt: string;
  status: "in_progress" | "complete";
  ballCount: number;
  minDistance: number;
  maxDistance: number;
  elapsedSeconds: number;
  summary: WedgeSessionSummary;
};

/**
 * All of a user's sessions, newest first, each with a computed summary.
 * Two queries total regardless of session count.
 */
export async function loadUserWedgeSessions(
  userId: string,
): Promise<FeedWedgeSession[]> {
  const db = getDb();

  const sessionRows = await db
    .select()
    .from(wedgeSessions)
    .where(eq(wedgeSessions.userId, userId))
    .orderBy(desc(wedgeSessions.startedAt));
  if (sessionRows.length === 0) return [];

  const sessionIds = sessionRows.map((s) => s.id);
  const shotRows = await db
    .select()
    .from(wedgeShotsT)
    .where(inArray(wedgeShotsT.sessionId, sessionIds));

  return sessionRows.map((session) => ({
    id: session.id,
    startedAt: session.startedAt.toISOString(),
    status: session.status,
    ballCount: session.ballCount,
    minDistance: session.minDistance,
    maxDistance: session.maxDistance,
    elapsedSeconds: session.elapsedSeconds,
    summary: sessionSummary(
      toWedgeShots(shotRows.filter((s) => s.sessionId === session.id)),
    ),
  }));
}

/**
 * The most recent session's parameters, used to prefill the setup screen so
 * the user isn't retyping their preferred ranges every time.
 */
export async function lastWedgeSessionParams(userId: string): Promise<{
  ballCount: number;
  minDistance: number;
  maxDistance: number;
} | null> {
  const db = getDb();
  const [row] = await db
    .select({
      ballCount: wedgeSessions.ballCount,
      minDistance: wedgeSessions.minDistance,
      maxDistance: wedgeSessions.maxDistance,
    })
    .from(wedgeSessions)
    .where(eq(wedgeSessions.userId, userId))
    .orderBy(desc(wedgeSessions.startedAt))
    .limit(1);
  return row ?? null;
}
