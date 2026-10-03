"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X, MoreVertical, WifiOff, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { BigButton } from "@/components/ui/big-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GuardedLink } from "@/components/shell/guarded-link";
import { OfflineNoticeModal } from "@/components/shell/offline-notice-modal";
import { useOfflineGuard } from "@/lib/offline/use-offline-guard";
import { isRedirectError } from "@/lib/offline/redirect-error";
import {
  clearPuttDraft,
  getPuttDraft,
  putPuttDraft,
} from "@/lib/offline/putt-sync";
import { NumericKeypad } from "@/components/round/numeric-keypad";
import { PuttGrid, type GridChoice } from "./putt-grid";
import {
  deletePuttSession,
  finishPuttSession,
  savePuttSession,
} from "@/app/puttmaxx/actions";
import { formatClock } from "@/lib/wedge";
import {
  rollSession,
  scoreAttempt,
  seededRandom,
  summarizeSession,
} from "@/lib/putt";
import type { PuttAttempt, PuttSpec } from "@/lib/putt";

const ELEVATION_LABEL = {
  uphill: "Uphill",
  downhill: "Downhill",
  flat: "Flat",
} as const;
const BREAK_LABEL = {
  l2r: "Left → Right",
  r2l: "Right → Left",
  straight: "Straight",
} as const;

/** Entry proceeds in three steps; a made putt skips the last two. */
type Phase = "first" | "comebackDistance" | "comebackResult";

export function PuttSession({
  sessionId,
  puttCount,
  minDistance,
  maxDistance,
  putts,
  initialAttempts,
  initialElapsedSeconds,
}: {
  sessionId: string;
  puttCount: number;
  minDistance: number;
  maxDistance: number;
  putts: PuttSpec[];
  initialAttempts: PuttAttempt[];
  initialElapsedSeconds: number;
}) {
  const [attempts, setAttempts] = useState<PuttAttempt[]>(initialAttempts);
  const [phase, setPhase] = useState<Phase>("first");
  const [draft, setDraft] = useState<GridChoice | null>(null);
  const [comebackFt, setComebackFt] = useState<number | null>(null);
  const [comebackDraft, setComebackDraft] = useState("");
  const [misreadLine, setMisreadLine] = useState(false);
  const [misreadSpeed, setMisreadSpeed] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [discarding, startDiscard] = useTransition();
  const [finishing, setFinishing] = useState(false);
  const [queuedFinish, setQueuedFinish] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"synced" | "offline">("synced");
  const offlineGuard = useOfflineGuard();

  /**
   * Sessions created before the sequence was pre-rolled (or with a corrupt
   * jsonb entry) have gaps. Roll a stand-in once so the spec can't change
   * under the player mid-putt.
   *
   * Seeded from the session id, NOT Math.random(): this runs during render, on
   * both the server and the client, and an unseeded roll gives each a
   * different putt — a hydration mismatch that React recovers from by
   * discarding the server tree, so the player can be shown one putt and handed
   * another.
   */
  const [fallback] = useState<PuttSpec[]>(() =>
    rollSession(puttCount, minDistance, maxDistance, seededRandom(sessionId)),
  );

  // Elapsed counts ACTIVE seconds only: it advances by real wall-clock deltas
  // rather than trusting the interval to fire on time (background tabs get
  // throttled), and stops while hidden — pocketing the phone between putts
  // shouldn't inflate the session duration.
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

  const index = editing ?? attempts.length;
  const spec = putts[index] ?? fallback[index] ?? fallback[0];
  const done = attempts.length >= puttCount;
  const puttNumber = Math.min(index + 1, puttCount);
  const summary = summarizeSession(attempts);

  // Local-first: try Supabase, and if that fails (offline or a transient
  // error) queue the state in IndexedDB rather than losing it.
  async function attemptSave(next: PuttAttempt[]): Promise<boolean> {
    try {
      await savePuttSession(sessionId, next, elapsedRef.current);
      await clearPuttDraft(sessionId);
      setSyncStatus("synced");
      return true;
    } catch {
      await putPuttDraft(sessionId, next, elapsedRef.current, false);
      setSyncStatus("offline");
      return false;
    }
  }

  function persist(next: PuttAttempt[]) {
    setAttempts(next);
    void attemptSave(next);
  }

  /**
   * Finishing, with the trap that has now bitten twice.
   *
   * `finishPuttSession` redirects, and Next encodes a *successful* redirect as
   * a thrown digest — so the two lines after the await never run on success.
   * The redirect branch must therefore clear the draft itself; skipping it is
   * exactly the bug that left stale drafts queued forever in the round flow,
   * and again in Wedgemaxx.
   *
   * The draft is written BEFORE the attempt, so a finish that never reaches
   * the server survives a force-quit as a queued finish.
   */
  async function attemptFinish(next: PuttAttempt[]): Promise<boolean> {
    await putPuttDraft(sessionId, next, elapsedRef.current, true);
    try {
      await finishPuttSession(sessionId, next, elapsedRef.current);
      await clearPuttDraft(sessionId);
      setSyncStatus("synced");
      return true;
    } catch (err) {
      if (isRedirectError(err)) {
        await clearPuttDraft(sessionId);
        setSyncStatus("synced");
        throw err;
      }
      setSyncStatus("offline");
      return false;
    }
  }

  function resetEntry() {
    setPhase("first");
    setDraft(null);
    setComebackFt(null);
    setComebackDraft("");
    setMisreadLine(false);
    setMisreadSpeed(false);
    setEditing(null);
  }

  function commit(attempt: PuttAttempt) {
    const next = attempts.slice();
    if (editing != null) next[editing] = attempt;
    else next.push(attempt);
    persist(next);
    resetEntry();
  }

  function onFirstPutt(choice: GridChoice) {
    if (choice.made) {
      commit({
        ...spec,
        made: true,
        speedError: null,
        lineError: null,
        misreadLine,
        misreadSpeed,
        comebackDistanceFt: null,
        comebackMade: null,
        comebackSpeedError: null,
        comebackLineError: null,
      });
      return;
    }
    setDraft(choice);
    setPhase("comebackDistance");
  }

  function onComebackResult(choice: GridChoice) {
    if (!draft || comebackFt == null) return;
    commit({
      ...spec,
      made: false,
      speedError: draft.speedError,
      lineError: draft.lineError,
      misreadLine,
      misreadSpeed,
      comebackDistanceFt: comebackFt,
      comebackMade: choice.made,
      comebackSpeedError: choice.speedError,
      comebackLineError: choice.lineError,
    });
  }

  async function onFinish() {
    setFinishing(true);
    const ok = await attemptFinish(attempts);
    // On success the redirect already threw; only a queued finish lands here.
    // Say so explicitly: the session IS finished as far as the player is
    // concerned, and silently staying on the entry screen reads as the button
    // having done nothing.
    if (!ok) {
      setFinishing(false);
      setQueuedFinish(true);
    }
  }

  // On mount, a leftover local draft (from a sync that never succeeded — the
  // page reloaded while offline, say) takes priority over the server's copy:
  // it's strictly newer, since it only exists because a push already failed.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const draft = await getPuttDraft(sessionId);
      if (cancelled || !draft) return;
      setAttempts(draft.attempts);
      setElapsed(draft.elapsedSeconds);
      elapsedRef.current = draft.elapsedSeconds;
      if (draft.wantsFinish) await attemptFinish(draft.attempts);
      else await attemptSave(draft.attempts);
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
      const draft = await getPuttDraft(sessionId);
      if (!draft) return;
      if (draft.wantsFinish) await attemptFinish(draft.attempts);
      else await attemptSave(draft.attempts);
    }
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const headerNote =
    done && editing == null
      ? // Every putt is in. The spec here would be a stand-in past the end of
        // the sequence, so calling a putt that isn't coming would be nonsense.
        `All ${puttCount} putts logged`
      : phase === "comebackDistance"
        ? "How far was the comeback?"
        : phase === "comebackResult"
          ? `Comeback from ${comebackFt} ft`
          : `${spec.distanceFt} ft · ${ELEVATION_LABEL[spec.elevation]} · ${BREAK_LABEL[spec.breakDirection]}`;

  return (
    <>
      {/* h-dvh — a DEFINITE height. A percentage or min-h-* never resolves
          here, so the dock drifts mid-screen and the history pushes it off the
          bottom once the list grows. Learned the hard way in Wedgemaxx. */}
      <div className="flex h-dvh flex-col">
        <header className="relative flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          {/* Exiting is safe offline: everything entered is already saved. */}
          <GuardedLink
            href="/puttmaxx"
            aria-label="Exit session"
            className="p-2 text-muted"
          >
            <X size={24} />
          </GuardedLink>
          <div className="text-center">
            <div className="text-sm font-semibold">
              {editing != null
                ? `Editing putt ${puttNumber}`
                : `Putt ${puttNumber} of ${puttCount}`}
            </div>
            <div className="text-xs tabular-nums text-muted">
              {syncStatus === "offline" ? (
                <span className="inline-flex items-center gap-1 font-semibold text-negative">
                  <WifiOff size={12} /> Saved locally
                </span>
              ) : (
                <>
                  {formatClock(elapsed)}
                  {attempts.length > 0 &&
                    ` · ${summary.totalSg >= 0 ? "+" : ""}${summary.totalSg.toFixed(2)} SG`}
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
                    // Deliberately NOT offline-guarded. Finishing on a green
                    // with no signal is the central offline case: attemptFinish
                    // queues it and retries on reconnect. Guarding this would
                    // make the queued-finish path unreachable — Discard below
                    // stays guarded because a delete has nothing to queue.
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

        {/* The called putt. Biggest thing on screen — it's what you act on. */}
        <div className="shrink-0 px-4 py-5 text-center">
          <p
            className={cn(
              "font-bold leading-tight",
              phase === "first" ? "text-2xl" : "text-xl text-muted",
            )}
          >
            {headerNote}
          </p>
        </div>

        {/* History scrolls; the dock below never moves. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <ul className="flex flex-col-reverse">
            {attempts.map((a, i) => {
              const r = scoreAttempt(a);
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(i);
                      setPhase("first");
                      setDraft(null);
                      setComebackFt(null);
                      setComebackDraft("");
                      setMisreadLine(a.misreadLine);
                      setMisreadSpeed(a.misreadSpeed);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between border-b border-border py-2 text-left text-sm",
                      editing === i && "bg-surface",
                    )}
                  >
                    <span className="w-7 shrink-0 font-semibold tabular-nums text-muted">
                      {i + 1}
                    </span>
                    <span className="flex-1 tabular-nums">
                      {a.distanceFt} ft{" "}
                      <span className="text-muted">
                        {a.made
                          ? "· made"
                          : `· ${r.puttsTaken}-putt${a.lineError ? ` (${a.lineError})` : ""}`}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "w-16 text-right font-semibold tabular-nums",
                        r.holeSg >= 0 ? "text-positive" : "text-negative",
                      )}
                    >
                      {r.holeSg >= 0 ? "+" : ""}
                      {r.holeSg.toFixed(2)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Dock. Matches the round and wedge sessions: same keypad, same
            value-above-keys layout, same bottom padding. */}
        <div className="shrink-0 border-t border-border bg-background px-4 pb-safe pt-3">
          {done && editing == null ? (
            <div className="pb-3">
              <BigButton block disabled={finishing} onClick={onFinish}>
                {finishing ? "Finishing…" : "Finish session"}
              </BigButton>
            </div>
          ) : phase === "comebackDistance" ? (
            <div className="flex flex-col gap-3 pb-3">
              <div className="flex items-baseline justify-center gap-2">
                <span
                  className={cn(
                    "text-4xl font-bold tabular-nums",
                    comebackDraft ? "text-foreground" : "text-muted/40",
                  )}
                >
                  {comebackDraft || "—"}
                </span>
                <span className="text-sm font-semibold text-muted">
                  feet back
                </span>
              </div>

              <NumericKeypad
                onDigit={(d) =>
                  setComebackDraft((cur) =>
                    cur.length >= 2 ? cur : cur === "0" ? d : cur + d,
                  )
                }
                onBackspace={() => setComebackDraft((cur) => cur.slice(0, -1))}
              />

              <div className="flex gap-2">
                <BigButton variant="secondary" onClick={resetEntry}>
                  Cancel
                </BigButton>
                <BigButton
                  block
                  disabled={!comebackDraft || Number(comebackDraft) <= 0}
                  onClick={() => {
                    setComebackFt(Number(comebackDraft));
                    setPhase("comebackResult");
                  }}
                >
                  Next
                </BigButton>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pb-3">
              {/* An annotation on the outcome, not an outcome itself, so it
                  reads as a different class of control from the grid: a
                  compact pill row rather than another slab. Dashed and hollow
                  when unset, filled when set, so "did I flag this?" is legible
                  at a glance without reading the label. */}
              {phase === "first" && (
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">
                    Misread?
                  </span>
                  {(
                    [
                      ["Line", misreadLine, setMisreadLine],
                      ["Speed", misreadSpeed, setMisreadSpeed],
                    ] as const
                  ).map(([label, on, set]) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      aria-label={`Misread ${label.toLowerCase()}`}
                      onClick={() => set((v) => !v)}
                      className={cn(
                        "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border text-sm font-semibold active:scale-95",
                        on
                          ? // Deliberately not the primary green: that reads as
                            // "Made!" one row below, and a misread isn't a win.
                            "border-foreground bg-foreground text-background"
                          : "border-dashed border-border text-muted",
                      )}
                    >
                      {on && <Check size={15} strokeWidth={3} />}
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <PuttGrid
                onChoose={phase === "first" ? onFirstPutt : onComebackResult}
              />
              {(phase !== "first" || editing != null) && (
                <BigButton variant="secondary" block onClick={resetEntry}>
                  Cancel
                </BigButton>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmingEnd}
        title="End session early?"
        description={`Scores the ${attempts.length} putt${attempts.length === 1 ? "" : "s"} you've hit so far.`}
        confirmLabel="End session"
        pending={finishing}
        onConfirm={() => {
          setConfirmingEnd(false);
          onFinish();
        }}
        onCancel={() => setConfirmingEnd(false)}
      />
      <ConfirmDialog
        open={confirmingDiscard}
        title="Discard this session?"
        description="This permanently removes the session and every putt in it. This can't be undone."
        confirmLabel="Discard session"
        destructive
        pending={discarding}
        onConfirm={() =>
          startDiscard(() => {
            void deletePuttSession(sessionId);
          })
        }
        onCancel={() => setConfirmingDiscard(false)}
      />
      <OfflineNoticeModal
        open={offlineGuard.blocked}
        onClose={offlineGuard.dismiss}
      />
      {/* Not a refusal — the finish is saved and queued, so the copy says so
          rather than reusing the default "that needs a connection". */}
      <OfflineNoticeModal
        open={queuedFinish}
        onClose={() => setQueuedFinish(false)}
        title="Saved, finishing when you&rsquo;re back online"
        description="Every putt is stored on this phone. The session will finish and its summary will open as soon as you have a connection, even if you close the app."
        closeLabel="Got it"
      />
    </>
  );
}
