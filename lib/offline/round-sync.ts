import { offlineDb } from "./db";
import type { HoleState } from "@/lib/round";
import { saveRound } from "@/app/round/actions";

/**
 * A round's local draft — only ever written to when a sync to Supabase has
 * failed (offline or a transient error). While a draft row exists for a
 * round, it's the resilience backstop: it's deleted the moment a sync
 * succeeds, so the store never grows into a second long-lived copy of
 * everything that needs reconciling.
 */
export async function getDraft(roundId: string) {
  return offlineDb.roundDrafts.get(roundId);
}

export async function putDraft(
  roundId: string,
  holes: HoleState[],
  wantsFinish: boolean,
): Promise<void> {
  await offlineDb.roundDrafts.put({
    roundId,
    holes,
    wantsFinish,
    updatedAt: Date.now(),
  });
}

export async function clearDraft(roundId: string): Promise<void> {
  await offlineDb.roundDrafts.delete(roundId);
}

/**
 * Best-effort flush of every queued draft that only needs a plain save (never
 * a queued Finish — that must be retried from a live, mounted session so its
 * redirect on success actually navigates the right tab). Meant to run once
 * on app load as a safety net for rounds left mid-sync by a previous tab.
 */
export async function flushAllDrafts(): Promise<void> {
  const drafts = await offlineDb.roundDrafts.toArray();
  for (const draft of drafts) {
    if (draft.wantsFinish) continue;
    try {
      await saveRound(draft.roundId, draft.holes);
      await clearDraft(draft.roundId);
    } catch {
      // Still offline or still failing — leave it queued for the next attempt.
    }
  }
}
