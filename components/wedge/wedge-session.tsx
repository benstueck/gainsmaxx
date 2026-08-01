"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X, Flag, MoreVertical, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { BigButton } from "@/components/ui/big-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NumericKeypad } from "@/components/round/numeric-keypad";
import { GuardedLink } from "@/components/shell/guarded-link";
import { OfflineNoticeModal } from "@/components/shell/offline-notice-modal";
import { useOfflineGuard } from "@/lib/offline/use-offline-guard";
import {
  deleteWedgeSession,
  finishWedgeSession,
  saveWedgeSession,
} from "@/app/wedgemaxx/actions";
import {
  formatClock,
  nextTarget,
  scoreShot,
  sessionSummary,
} from "@/lib/wedge";
import type { WedgeShot } from "@/lib/wedge";
import {
  clearWedgeDraft,
  getWedgeDraft,
  putWedgeDraft,
} from "@/lib/offline/wedge-sync";

/** Next.js encodes a successful redirect() as a thrown "NEXT_REDIRECT" digest
 *  rather than a normal return — distinguish that from a real sync failure. */
function isRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export function WedgeSession({
  sessionId,
  ballCount,
  minDistance,
  maxDistance,
  initialShots,
  initialElapsedSeconds,
  targets,
}: {
  sessionId: string;
  ballCount: number;
  minDistance: number;
  maxDistance: number;
  initialShots: WedgeShot[];
  initialElapsedSeconds: number;
  /** Pre-rolled at session creation. Empty for sessions created before that
   *  existed, which fall back to rolling one at a time. */
  targets: number[];
}) {
  const [shots, setShots] = useState<WedgeShot[]>(initialShots);
  const [carry, setCarry] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [discarding, startDiscard] = useTransition();
  const [syncStatus, setSyncStatus] = useState<"synced" | "saving" | "offline">(
    "synced",
  );
  const offlineGuard = useOfflineGuard();

  // Legacy fallback only: sessions created before targets were pre-rolled
  // still generate one at a time, so a reload re-rolls the pending yardage.
  // Sessions created now read straight from the stored sequence and are
  // stable across reloads and relaunches.
  const [fallbackTarget, setFallbackTarget] = useState(() =>
    nextTarget(
      minDistance,
      maxDistance,
      initialShots.at(-1)?.targetDistance ?? null,
    ),
  );

  // Elapsed time counts ACTIVE seconds only. It advances by real wall-clock
  // deltas rather than assuming the interval fired on time (background tabs
  // get throttled), and stops entirely while the tab is hidden — backgrounding
  // the app at the range shouldn't inflate the session duration.
  const [elapsed, setElapsed] = useState(initialElapsedSeconds);
  const elapsedRef = useRef(initialElapsedSeconds);
  useEffect(() => {
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === "visible") {
        const delta = Math.round((now - last) / 1000);
        if (delta > 0) {
          setElapsed((e) => {
            elapsedRef.current = e + delta;
            return elapsedRef.current;
          });
        }
      }
      last = now;
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const target = targets[shots.length] ?? fallbackTarget;
  const summary = sessionSummary(shots);
  const allBallsHit = shots.length >= ballCount;
  const ballNumber = Math.min(shots.length + 1, ballCount);
  const isEditing = editing != null;
  const editedShot = isEditing ? shots[editing] : null;

  // Local-first save: try Supabase, and if that fails (offline or a transient
  // error) queue the state in IndexedDB rather than losing it.
  async function attemptSave(nextShots: WedgeShot[]): Promise<boolean> {
    setSyncStatus("saving");
    try {
      await saveWedgeSession(sessionId, nextShots, elapsedRef.current);
      await clearWedgeDraft(sessionId);
      setSyncStatus("synced");
      return true;
    } catch {
      await putWedgeDraft(sessionId, nextShots, elapsedRef.current, false);
      setSyncStatus("offline");
      return false;
    }
  }

  function persist(updated: WedgeShot[]) {
    void attemptSave(updated);
  }

  function record(carryDistance: number | null) {
    if (allBallsHit) return;
    const updated = [...shots, { targetDistance: target, carryDistance }];
    setShots(updated);
    setCarry("");
    // Only advance the fallback when this session has no stored sequence.
    if (targets[updated.length] == null) {
      setFallbackTarget(nextTarget(minDistance, maxDistance, target));
    }
    persist(updated);
  }

  function startEdit(index: number) {
    setEditing(index);
    const s = shots[index];
    setCarry(s.carryDistance != null ? String(s.carryDistance) : "");
  }

  function cancelEdit() {
    setEditing(null);
    setCarry("");
  }

  function saveEdit(carryDistance: number | null) {
    if (editing == null) return;
    const updated = shots.map((s, i) =>
      i === editing ? { ...s, carryDistance } : s,
    );
    setShots(updated);
    setEditing(null);
    setCarry("");
    persist(updated);
  }

  // Same idea for finishing — a queued finish is retried from a live, mounted
  // session until it reaches the server, at which point its redirect to the
  // summary fires normally.
  async function attemptFinish(nextShots: WedgeShot[]): Promise<boolean> {
    await putWedgeDraft(sessionId, nextShots, elapsedRef.current, true);
    try {
      await finishWedgeSession(sessionId, nextShots, elapsedRef.current);
      await clearWedgeDraft(sessionId);
      setSyncStatus("synced");
      return true;
    } catch (err) {
      if (isRedirectError(err)) {
        // finishWedgeSession succeeded — Next just encodes that as a thrown
        // redirect, so the two lines above never ran. Clearing here matters:
        // skipping it is exactly the bug that left stale drafts behind in the
        // round flow.
        await clearWedgeDraft(sessionId);
        setSyncStatus("synced");
        throw err;
      }
      setSyncStatus("offline");
      return false;
    }
  }

  async function onFinish() {
    setFinishing(true);
    const ok = await attemptFinish(shots);
    // On success the redirect already threw; only a queued finish lands here.
    if (!ok) setFinishing(false);
  }

  // On mount, a leftover local draft (from a sync that never succeeded — e.g.
  // the page reloaded while offline) takes priority over the server's copy:
  // it's strictly newer, since it only exists because a push already failed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const draft = await getWedgeDraft(sessionId);
      if (cancelled || !draft) return;
      setShots(draft.shots);
      setElapsed(draft.elapsedSeconds);
      elapsedRef.current = draft.elapsedSeconds;
      if (draft.wantsFinish) await attemptFinish(draft.shots);
      else await attemptSave(draft.shots);
    })();
    return () => {
      cancelled = true;
    };
    // Runs once per mounted session (sessionId is stable for its lifetime).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retry whatever's queued the moment connectivity returns.
  useEffect(() => {
    async function retry() {
      const draft = await getWedgeDraft(sessionId);
      if (!draft) return;
      if (draft.wantsFinish) await attemptFinish(draft.shots);
      else await attemptSave(draft.shots);
    }
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // h-dvh (a DEFINITE height), not min-h-full or min-h-dvh. Flexbox only
  // shrinks children when the container has a definite size — with a
  // min-height the container just grows to fit a long shot list, dragging the
  // keypad off the bottom of the screen.
  return (
    <>
      <div className="flex h-dvh flex-col">
        <header className="relative flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          {/* Exiting is safe offline: everything entered is already saved. */}
          <GuardedLink
            href="/wedgemaxx"
            aria-label="Exit session"
            skipGuard
            className="p-2 text-muted"
          >
            <X size={24} />
          </GuardedLink>
          <div className="text-center">
            <div className="text-sm font-semibold">
              Ball {ballNumber} of {ballCount}
            </div>
            <div className="text-xs text-muted tabular-nums">
              {syncStatus === "offline" ? (
                <span className="inline-flex items-center gap-1 font-semibold text-negative">
                  <WifiOff size={12} /> Saved locally
                </span>
              ) : (
                <>
                  {formatClock(elapsed)}
                  {summary.ballsHit > 0 &&
                    ` · Avg ${summary.averagePoints.toFixed(1)}`}
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Session options"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="p-2 text-muted"
          >
            <MoreVertical size={22} />
          </button>

          {menuOpen && (
            <>
              {/* Backdrop closes the menu on any outside tap. */}
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-3 top-14 z-20 w-48 overflow-hidden rounded-app border border-border bg-background shadow-lg">
                <button
                  type="button"
                  className="flex min-h-tap w-full items-center px-4 text-left text-sm font-semibold"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmingEnd(true);
                  }}
                >
                  End session
                </button>
                <button
                  type="button"
                  className="flex min-h-tap w-full items-center border-t border-border px-4 text-left text-sm font-semibold text-negative"
                  onClick={() => {
                    setMenuOpen(false);
                    offlineGuard.guard(() => setConfirmingDiscard(true));
                  }}
                >
                  Discard session
                </button>
              </div>
            </>
          )}
        </header>

        {allBallsHit && !isEditing ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-lg font-semibold">All {ballCount} balls hit</p>
            <p className="text-6xl font-bold tabular-nums">
              {summary.averagePoints.toFixed(1)}
            </p>
            <p className="text-sm text-muted">average points</p>
          </div>
        ) : (
          <>
            {/* Target — stays visible at all times, which is the whole reason
                this uses a custom keypad instead of the OS keyboard. */}
            <div className="shrink-0 py-5 text-center">
              <div className="text-sm font-medium text-muted">
                {isEditing ? `Editing ball ${editing! + 1}` : "Hit it"}
              </div>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-6xl font-bold tabular-nums">
                  {isEditing ? editedShot!.targetDistance : target}
                </span>
                <span className="text-xl font-semibold text-muted">yds</span>
              </div>
            </div>

            {/* Shot list scrolls internally so the keypad never moves. */}
            <div className="flex-1 overflow-y-auto border-t border-border px-4">
              <ul className="flex flex-col">
                {shots
                  .map((s, i) => ({ result: scoreShot(s), index: i }))
                  .reverse()
                  .map(({ result, index }) => (
                    <li key={index}>
                      <button
                        type="button"
                        onClick={() => startEdit(index)}
                        className={cn(
                          "flex w-full items-center justify-between border-b border-border py-2 text-left text-sm active:bg-surface",
                          editing === index && "bg-primary/5 font-semibold",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-5 text-xs font-bold text-muted tabular-nums">
                            {index + 1}
                          </span>
                          <span className="tabular-nums">
                            {result.targetDistance}
                          </span>
                          <span className="text-muted">→</span>
                          {result.isMishit ? (
                            <span className="font-semibold text-negative">
                              Mishit
                            </span>
                          ) : (
                            <span className="tabular-nums">
                              {result.carryDistance}
                              <span className="ml-1 text-xs font-semibold text-muted">
                                ({result.deltaYd! > 0 ? "+" : ""}
                                {result.deltaYd})
                              </span>
                            </span>
                          )}
                        </span>
                        <span className="tabular-nums">
                          {result.points.toFixed(0)}
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          </>
        )}

        {/* Entry dock */}
        <div className="shrink-0 border-t border-border bg-background px-4 pb-safe pt-3">
          {allBallsHit && !isEditing ? (
            <div className="flex flex-col gap-2 pb-3">
              {syncStatus === "offline" && (
                <p className="flex items-center justify-center gap-1 text-center text-sm font-medium text-negative">
                  <WifiOff size={14} /> Offline — will finish syncing once
                  you&rsquo;re back online.
                </p>
              )}
              <BigButton block onClick={onFinish} disabled={finishing}>
                <Flag size={20} /> {finishing ? "Finishing…" : "Finish session"}
              </BigButton>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pb-3">
              <div className="flex items-baseline justify-center gap-2">
                <span
                  className={cn(
                    "text-4xl font-bold tabular-nums",
                    carry ? "text-foreground" : "text-muted/40",
                  )}
                >
                  {carry || "—"}
                </span>
                <span className="text-sm font-semibold text-muted">
                  yds carried
                </span>
              </div>

              <NumericKeypad
                onDigit={(d) =>
                  setCarry((cur) =>
                    cur.length >= 3 ? cur : cur === "0" ? d : cur + d,
                  )
                }
                onBackspace={() => setCarry((cur) => cur.slice(0, -1))}
              />

              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <BigButton variant="secondary" onClick={cancelEdit}>
                      Cancel
                    </BigButton>
                    <BigButton
                      variant="secondary"
                      onClick={() => saveEdit(null)}
                    >
                      Mishit
                    </BigButton>
                    <BigButton
                      block
                      disabled={!carry}
                      onClick={() => saveEdit(Number(carry))}
                    >
                      Save
                    </BigButton>
                  </>
                ) : (
                  <>
                    <BigButton variant="secondary" onClick={() => record(null)}>
                      Mishit
                    </BigButton>
                    <BigButton
                      block
                      disabled={!carry}
                      onClick={() => record(Number(carry))}
                    >
                      Log ball
                    </BigButton>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmingEnd}
        title="End session early?"
        description={`You've hit ${summary.ballsHit} of ${ballCount} balls. It'll be scored over the balls you've actually hit.`}
        confirmLabel="End session"
        pending={finishing}
        onConfirm={() => {
          setConfirmingEnd(false);
          void onFinish();
        }}
        onCancel={() => setConfirmingEnd(false)}
      />
      <ConfirmDialog
        open={confirmingDiscard}
        title="Discard this session?"
        description="This permanently removes the session and every ball in it. This can't be undone."
        confirmLabel="Discard session"
        destructive
        pending={discarding}
        onConfirm={() =>
          startDiscard(() => {
            void deleteWedgeSession(sessionId);
          })
        }
        onCancel={() => setConfirmingDiscard(false)}
      />
      <OfflineNoticeModal
        open={offlineGuard.blocked}
        onClose={offlineGuard.dismiss}
      />
    </>
  );
}
