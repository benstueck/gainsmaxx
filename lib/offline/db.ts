import Dexie, { type EntityTable } from "dexie";
import type { HoleState } from "@/lib/round";
import type { WedgeShot } from "@/lib/wedge";
import type { PuttAttempt } from "@/lib/putt";

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

/**
 * A Puttmaxx session's local draft. Same contract as the other two: it only
 * exists while a sync has failed, and is deleted the moment one succeeds.
 *
 * Note it stores **completed attempts only**. A putt part-way through entry —
 * a miss whose comeback hasn't been recorded yet — is never persisted, and
 * that's deliberate: such a row would violate the `made ⇔ no error` check
 * constraint the database enforces. Losing a half-tapped putt on a reload
 * costs one re-entry; writing a contradictory one would corrupt the analytics
 * that constraint exists to protect.
 */
export interface PuttDraft {
  /** The session's server UUID — the primary key. */
  sessionId: string;
  attempts: PuttAttempt[];
  elapsedSeconds: number;
  /** Set when the user finished (or ended early) while queued. */
  wantsFinish: boolean;
  /** Local timestamp (ms) this draft was last written. */
  updatedAt: number;
}

export const offlineDb = new Dexie("gainsmaxxing") as Dexie & {
  roundDrafts: EntityTable<RoundDraft, "roundId">;
  wedgeDrafts: EntityTable<WedgeDraft, "sessionId">;
  puttDrafts: EntityTable<PuttDraft, "sessionId">;
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
// v3 is additive again, for the same reason: a phone carrying a queued round
// or wedge draft upgrades in place rather than resetting and losing it.
offlineDb.version(3).stores({
  roundDrafts: "roundId, updatedAt",
  wedgeDrafts: "sessionId, updatedAt",
  puttDrafts: "sessionId, updatedAt",
});
