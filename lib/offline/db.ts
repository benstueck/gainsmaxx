import Dexie, { type EntityTable } from "dexie";
import type { HoleState } from "@/lib/round";

/**
 * A round's local draft — only ever written to when a sync to Supabase has
 * failed (offline or a transient error). While a draft row exists for a
 * round, it is the source of truth for that round's state; it's deleted the
 * moment a sync succeeds. This keeps the store small and avoids ever having
 * to reconcile two long-lived copies of the same data.
 */
export interface RoundDraft {
  /** The round's server UUID — the primary key. */
  roundId: string;
  holes: HoleState[];
  /** Set when the user tapped Finish while this draft was queued. */
  wantsFinish: boolean;
  /** Local timestamp (ms) this draft was last written. */
  updatedAt: number;
}

export const offlineDb = new Dexie("gainsmaxxing") as Dexie & {
  roundDrafts: EntityTable<RoundDraft, "roundId">;
};

offlineDb.version(1).stores({
  roundDrafts: "roundId, updatedAt",
});
