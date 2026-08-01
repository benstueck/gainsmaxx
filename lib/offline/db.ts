import Dexie, { type EntityTable } from "dexie";
import type { HoleState } from "@/lib/round";
import type { WedgeShot } from "@/lib/wedge";

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

// Deliberately kept as "gainsmaxxing" through the Gainsmaxx rebrand — an
// internal identifier never shown to a user, and renaming it would orphan
// any already-queued local offline draft on someone's phone (a new IndexedDB
// name means the old one's data is simply never opened again).
/** A Wedgemaxx session's local draft. Same contract as RoundDraft: it only
 *  exists while a sync has failed, and is deleted the moment one succeeds. */
export interface WedgeDraft {
  /** The session's server UUID — the primary key. */
  sessionId: string;
  shots: WedgeShot[];
  elapsedSeconds: number;
  /** Set when the user finished (or ended early) while queued. */
  wantsFinish: boolean;
  /** Local timestamp (ms) this draft was last written. */
  updatedAt: number;
}

export const offlineDb = new Dexie("gainsmaxxing") as Dexie & {
  roundDrafts: EntityTable<RoundDraft, "roundId">;
  wedgeDrafts: EntityTable<WedgeDraft, "sessionId">;
};

// v1 is kept declared so existing installs upgrade rather than reset — v2 is
// purely additive (a new table), so any round draft already queued on
// someone's phone survives the upgrade untouched.
offlineDb.version(1).stores({
  roundDrafts: "roundId, updatedAt",
});
offlineDb.version(2).stores({
  roundDrafts: "roundId, updatedAt",
  wedgeDrafts: "sessionId, updatedAt",
});
