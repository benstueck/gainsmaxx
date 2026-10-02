"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { BigButton } from "@/components/ui/big-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GuardedLink } from "@/components/shell/guarded-link";
import { OfflineNoticeModal } from "@/components/shell/offline-notice-modal";
import { useOfflineGuard } from "@/lib/offline/use-offline-guard";
import { NumericKeypad } from "@/components/round/numeric-keypad";
import { PuttGrid, type GridChoice } from "./putt-grid";
import {
  deletePuttSession,
  finishPuttSession,
  savePuttSession,
} from "@/app/puttmaxx/actions";
import { formatClock } from "@/lib/wedge";
import { rollSession, scoreAttempt, summarizeSession } from "@/lib/putt";
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
  const offlineGuard = useOfflineGuard();

  /**
   * Sessions created before the sequence was pre-rolled (or with a corrupt
   * jsonb entry) have gaps. Roll a stand-in once so the spec can't change
   * under the player mid-putt.
   */
  const [fallback] = useState<PuttSpec[]>(() =>
    rollSession(puttCount, minDistance, maxDistance),
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

  function persist(next: PuttAttempt[]) {
    setAttempts(next);
    void savePuttSession(sessionId, next, elapsedRef.current).catch(() => {
      // Phase 7 queues this to IndexedDB; for now a failed autosave is
      // recovered by the next successful one, since every save is a full
      // replace rather than an append.
    });
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

  function onFinish() {
    setFinishing(true);
    void finishPuttSession(sessionId, attempts, elapsedRef.current).catch(() =>
      setFinishing(false),
    );
  }

  const headerNote =
    phase === "comebackDistance"
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
              {formatClock(elapsed)}
              {attempts.length > 0 &&
                ` · ${summary.totalSg >= 0 ? "+" : ""}${summary.totalSg.toFixed(2)} SG`}
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
                    offlineGuard.guard(() => setConfirmingEnd(true));
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
          {phase === "first" && editing == null && (
            <div className="mt-3 flex items-center justify-center gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={misreadLine}
                  onChange={(e) => setMisreadLine(e.target.checked)}
                  className="h-5 w-5 accent-primary"
                />
                Misread line
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={misreadSpeed}
                  onChange={(e) => setMisreadSpeed(e.target.checked)}
                  className="h-5 w-5 accent-primary"
                />
                Misread speed
              </label>
            </div>
          )}
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
    </>
  );
}
