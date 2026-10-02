import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./index";
import { puttSessions, puttAttempts as puttAttemptsT } from "./schema";
import { parsePutts, summarizeSession } from "@/lib/putt";
import type { PuttAttempt, PuttSessionSummary, PuttSpec } from "@/lib/putt";

type SessionRow = typeof puttSessions.$inferSelect;
type AttemptRow = typeof puttAttemptsT.$inferSelect;

/**
 * Strokes gained and every derived figure are computed here, never read from a
 * stored column — the same discipline as round SG and Wedgemaxx points. The
 * scoring rule can then be corrected without leaving stale values behind.
 */
function toAttempts(rows: AttemptRow[]): PuttAttempt[] {
  return rows
    .slice()
    .sort((a, b) => a.puttNumber - b.puttNumber)
    .map((a) => ({
      distanceFt: a.distance,
      elevation: a.elevation,
      breakDirection: a.breakDirection,
      made: a.made,
      speedError: a.speedError,
      lineError: a.lineError,
      misreadLine: a.misreadLine,
      misreadSpeed: a.misreadSpeed,
      comebackDistanceFt: a.comebackDistance,
      comebackMade: a.comebackMade,
      comebackSpeedError: a.comebackSpeedError,
      comebackLineError: a.comebackLineError,
    }));
}

export type LoadedPuttSession = {
  session: SessionRow;
  putts: PuttSpec[];
  attempts: PuttAttempt[];
};

/** Load one session the user owns, with its attempts. Null if not owned. */
export async function loadPuttSession(
  sessionId: string,
  userId: string,
): Promise<LoadedPuttSession | null> {
  const db = getDb();

  const [session] = await db
    .select()
    .from(puttSessions)
    .where(and(eq(puttSessions.id, sessionId), eq(puttSessions.userId, userId)))
    .limit(1);
  if (!session) return null;

  const attemptRows = await db
    .select()
    .from(puttAttemptsT)
    .where(eq(puttAttemptsT.sessionId, sessionId))
    .orderBy(asc(puttAttemptsT.puttNumber));

  return {
    session,
    putts: parsePutts(session.putts),
    attempts: toAttempts(attemptRows),
  };
}

export type FeedPuttSession = {
  id: string;
  startedAt: string;
  status: "in_progress" | "complete";
  puttCount: number;
  minDistance: number;
  maxDistance: number;
  elapsedSeconds: number;
  summary: PuttSessionSummary;
};

/**
 * All of a user's sessions, newest first, each with a computed summary.
 * Two queries total regardless of session count.
 */
export async function loadUserPuttSessions(
  userId: string,
): Promise<FeedPuttSession[]> {
  const db = getDb();

  const sessionRows = await db
    .select()
    .from(puttSessions)
    .where(eq(puttSessions.userId, userId))
    .orderBy(desc(puttSessions.startedAt));
  if (sessionRows.length === 0) return [];

  const sessionIds = sessionRows.map((s) => s.id);
  const attemptRows = await db
    .select()
    .from(puttAttemptsT)
    .where(inArray(puttAttemptsT.sessionId, sessionIds));

  return sessionRows.map((session) => ({
    id: session.id,
    startedAt: session.startedAt.toISOString(),
    status: session.status,
    puttCount: session.puttCount,
    minDistance: session.minDistance,
    maxDistance: session.maxDistance,
    elapsedSeconds: session.elapsedSeconds,
    summary: summarizeSession(
      toAttempts(attemptRows.filter((a) => a.sessionId === session.id)),
    ),
  }));
}

/**
 * The most recent session's parameters, to prefill the setup screen so the
 * user isn't retyping their preferred range every time.
 */
export async function lastPuttSessionParams(userId: string): Promise<{
  puttCount: number;
  minDistance: number;
  maxDistance: number;
} | null> {
  const db = getDb();
  const [row] = await db
    .select({
      puttCount: puttSessions.puttCount,
      minDistance: puttSessions.minDistance,
      maxDistance: puttSessions.maxDistance,
    })
    .from(puttSessions)
    .where(eq(puttSessions.userId, userId))
    .orderBy(desc(puttSessions.startedAt))
    .limit(1);
  return row ?? null;
}
