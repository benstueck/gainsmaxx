import { offlineDb } from "./db";
import { savePuttSession } from "@/app/puttmaxx/actions";
import type { PuttAttempt } from "@/lib/putt";

/**
 * Local draft queue for Puttmaxx sessions — mirrors wedge-sync.ts.
 *
 * A draft row only ever exists because a push to Supabase failed. While one
 * exists it's the resilience backstop for that session, and it's deleted the
 * moment a sync succeeds, so the store never becomes a second long-lived copy
 * of everything that needs reconciling.
 */
export async function getPuttDraft(sessionId: string) {
  return offlineDb.puttDrafts.get(sessionId);
}

export async function putPuttDraft(
  sessionId: string,
  attempts: PuttAttempt[],
  elapsedSeconds: number,
  wantsFinish: boolean,
): Promise<void> {
  await offlineDb.puttDrafts.put({
    sessionId,
    attempts,
    elapsedSeconds,
    wantsFinish,
    updatedAt: Date.now(),
  });
}

export async function clearPuttDraft(sessionId: string): Promise<void> {
  await offlineDb.puttDrafts.delete(sessionId);
}

/**
 * Best-effort flush of every queued session draft that only needs a plain
 * save. A queued finish is deliberately skipped: finishing redirects to the
 * summary, which has to happen from a live, mounted session rather than a
 * background sweep. Runs on app load and on reconnect as a safety net for
 * sessions left mid-sync.
 */
export async function flushAllPuttDrafts(): Promise<void> {
  const drafts = await offlineDb.puttDrafts.toArray();
  for (const draft of drafts) {
    if (draft.wantsFinish) continue;
    try {
      await savePuttSession(
        draft.sessionId,
        draft.attempts,
        draft.elapsedSeconds,
      );
      await clearPuttDraft(draft.sessionId);
    } catch {
      // Still offline or still failing — leave it queued for the next attempt.
    }
  }
}
