import { offlineDb } from "./db";
import { saveWedgeSession } from "@/app/wedgemaxx/actions";
import type { WedgeShot } from "@/lib/wedge";

/**
 * Local draft queue for Wedgemaxx sessions — mirrors round-sync.ts.
 *
 * A draft row only ever exists because a push to Supabase failed. While one
 * exists it's the resilience backstop for that session, and it's deleted the
 * moment a sync succeeds, so the store never becomes a second long-lived copy
 * of everything that needs reconciling.
 */
export async function getWedgeDraft(sessionId: string) {
  return offlineDb.wedgeDrafts.get(sessionId);
}

export async function putWedgeDraft(
  sessionId: string,
  shots: WedgeShot[],
  elapsedSeconds: number,
  wantsFinish: boolean,
): Promise<void> {
  await offlineDb.wedgeDrafts.put({
    sessionId,
    shots,
    elapsedSeconds,
    wantsFinish,
    updatedAt: Date.now(),
  });
}

export async function clearWedgeDraft(sessionId: string): Promise<void> {
  await offlineDb.wedgeDrafts.delete(sessionId);
}

/**
 * Best-effort flush of every queued session draft that only needs a plain
 * save. A queued finish is deliberately skipped: finishing redirects to the
 * summary, which has to happen from a live, mounted session rather than a
 * background sweep. Runs on app load and on reconnect as a safety net for
 * sessions left mid-sync.
 */
export async function flushAllWedgeDrafts(): Promise<void> {
  const drafts = await offlineDb.wedgeDrafts.toArray();
  for (const draft of drafts) {
    if (draft.wantsFinish) continue;
    try {
      await saveWedgeSession(
        draft.sessionId,
        draft.shots,
        draft.elapsedSeconds,
      );
      await clearWedgeDraft(draft.sessionId);
    } catch {
      // Still offline or still failing — leave it queued for the next attempt.
    }
  }
}
