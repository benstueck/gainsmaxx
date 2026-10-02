"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GuardedLink } from "@/components/shell/guarded-link";
import { OfflineNoticeModal } from "@/components/shell/offline-notice-modal";
import { useOfflineGuard } from "@/lib/offline/use-offline-guard";
import { deletePuttSession } from "@/app/puttmaxx/actions";
import { formatDuration } from "@/lib/wedge";
import { scoreAttempt, summarizeSession } from "@/lib/putt";
import type { PuttAttempt } from "@/lib/putt";
import { BiasGauge } from "./bias-gauge";
import { MissMap } from "./miss-map";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

const fmtSg = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;

export function PuttSessionSummaryView({
  sessionId,
  startedAt,
  puttCount,
  minDistance,
  maxDistance,
  elapsedSeconds,
  attempts,
}: {
  sessionId: string;
  startedAt: string;
  puttCount: number;
  minDistance: number;
  maxDistance: number;
  elapsedSeconds: number;
  attempts: PuttAttempt[];
}) {
  const [deleting, startDelete] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const offlineGuard = useOfflineGuard();

  const s = summarizeSession(attempts);
  const date = new Date(startedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Puttmaxx</h1>
          <p className="text-sm text-muted">
            {date} · {s.attemptCount}/{puttCount} putts · {minDistance}–
            {maxDistance} ft
          </p>
        </div>
        <GuardedLink
          href="/puttmaxx"
          className="p-1 text-sm font-semibold text-primary"
        >
          Done
        </GuardedLink>
      </header>

      {s.attemptCount === 0 ? (
        <p className="rounded-app border border-border bg-surface p-8 text-center text-muted">
          No putts logged.
        </p>
      ) : (
        <>
          <section className="rounded-app border border-border p-4">
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-5xl font-bold tabular-nums",
                  s.totalSg >= 0 ? "text-positive" : "text-negative",
                )}
              >
                {fmtSg(s.totalSg)}
              </span>
              <span className="text-sm text-muted">total SG</span>
            </div>
            {/* The baseline is the entire meaning of the number, so it's
                stated rather than assumed. */}
            <p className="mt-1 text-sm text-muted">
              0.00 would be Tour-average putting over these distances.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
              <Stat
                label="MADE"
                value={`${s.firstPuttsMade}/${s.attemptCount} (${Math.round(s.makePercent * 100)}%)`}
              />
              <Stat
                label="PUTTS"
                value={`${s.onePutts}/${s.twoPutts}/${s.threePutts}`}
              />
              <Stat
                label="LEAVE"
                value={
                  s.averageComebackFt == null
                    ? "—"
                    : `${s.averageComebackFt.toFixed(1)} ft`
                }
              />
            </div>
            {elapsedSeconds > 0 && (
              <p className="mt-3 text-sm text-muted">
                Duration {formatDuration(elapsedSeconds)}
              </p>
            )}
          </section>

          <section className="rounded-app border border-border p-4">
            <h2 className="text-sm font-semibold text-muted">
              Where they finished
            </h2>
            <p className="mb-3 mt-0.5 text-xs text-muted">
              First putts only, so sessions stay comparable.
            </p>
            <MissMap cells={s.missMap} />
          </section>

          <section className="rounded-app border border-border p-4">
            <h2 className="text-sm font-semibold text-muted">Tendencies</h2>
            <BiasGauge
              title="Direction"
              detects="stroke — face & path"
              population="all putts, including comebacks"
              bias={s.directionBias}
              labels={["Left", "Right"] as const}
            />
            <BiasGauge
              title="Read"
              detects="under- / over-reading break"
              population="first putts that broke"
              bias={s.readBias}
              labels={["High", "Low"] as const}
            />
            <BiasGauge
              title="Speed"
              detects="pace control"
              population="all putts, including comebacks"
              bias={s.speedBias}
              labels={["Fast", "Slow"] as const}
            />

            {/* Where the measured read and the self-report disagree — the most
                actionable line in the summary when it fires. */}
            {s.unflaggedLowMisses > 0 && (
              <p className="mt-3 rounded-app bg-surface p-3 text-xs">
                <span className="font-semibold">
                  {s.unflaggedLowMisses} miss
                  {s.unflaggedLowMisses === 1 ? "" : "es"} on the low side
                </span>{" "}
                {s.unflaggedLowMisses === 1 ? "wasn't" : "weren't"} flagged as a
                misread. Missing low without noticing usually means the read,
                not the stroke.
              </p>
            )}
            {(s.misreadLineCount > 0 || s.misreadSpeedCount > 0) && (
              <p className="mt-2 text-xs text-muted">
                You flagged {s.misreadLineCount} line and {s.misreadSpeedCount}{" "}
                speed misread{s.misreadSpeedCount === 1 ? "" : "s"}.
              </p>
            )}
          </section>

          {s.bands.length > 1 && (
            <section className="rounded-app border border-border p-4">
              <h2 className="text-sm font-semibold text-muted">By distance</h2>
              <ul className="mt-2 flex flex-col">
                <li className="flex items-center justify-between border-b border-border py-1 text-xs font-medium text-muted">
                  <span className="flex-1">Range</span>
                  <span className="w-20 text-right">Made</span>
                  <span className="w-16 text-right">Avg SG</span>
                </li>
                {s.bands.map((b) => (
                  <li
                    key={b.label}
                    className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0"
                  >
                    <span className="flex-1">{b.label}</span>
                    <span className="w-20 text-right tabular-nums text-muted">
                      {b.made}/{b.attempts} ({Math.round(b.makePercent * 100)}%)
                    </span>
                    <span
                      className={cn(
                        "w-16 text-right font-semibold tabular-nums",
                        b.averageSg >= 0 ? "text-positive" : "text-negative",
                      )}
                    >
                      {fmtSg(b.averageSg)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-semibold text-muted">
              Every putt
            </h2>
            <ul className="flex flex-col">
              <li className="flex items-center justify-between border-b border-border py-1 text-xs font-medium text-muted">
                <span className="w-7">#</span>
                <span className="flex-1">Putt</span>
                <span className="w-24 text-right">Result</span>
                <span className="w-14 text-right">SG</span>
              </li>
              {attempts.map((a, i) => {
                const r = scoreAttempt(a);
                return (
                  <li
                    key={i}
                    className="flex items-center justify-between border-b border-border py-2 text-sm"
                  >
                    <span className="w-7 font-semibold tabular-nums">
                      {i + 1}
                    </span>
                    <span className="flex-1 tabular-nums">
                      {a.distanceFt} ft
                      <span className="ml-1 text-xs text-muted">
                        {a.breakDirection === "l2r"
                          ? "L→R"
                          : a.breakDirection === "r2l"
                            ? "R→L"
                            : "straight"}
                      </span>
                    </span>
                    <span className="w-24 text-right text-xs">
                      {a.made ? (
                        <span className="font-semibold text-positive">
                          Made
                        </span>
                      ) : (
                        <>
                          {r.puttsTaken}-putt
                          {a.lineError && (
                            <span className="text-muted"> {a.lineError}</span>
                          )}
                        </>
                      )}
                    </span>
                    <span
                      className={cn(
                        "w-14 text-right font-semibold tabular-nums",
                        r.holeSg >= 0 ? "text-positive" : "text-negative",
                      )}
                    >
                      {fmtSg(r.holeSg)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <div className="flex flex-col gap-2 pt-2">
        {/* Corrections reuse the entry loop rather than a second editor —
            the same ?edit=1 pattern the round summary uses. */}
        <GuardedLink
          href={`/puttmaxx/${sessionId}?edit=1`}
          className="flex min-h-tap items-center justify-center rounded-app border border-border bg-surface px-6 text-lg font-semibold"
        >
          Edit session
        </GuardedLink>
        <button
          type="button"
          onClick={() => offlineGuard.guard(() => setConfirmingDelete(true))}
          disabled={deleting}
          className="min-h-tap text-sm font-semibold text-negative disabled:opacity-40"
        >
          {deleting ? "Deleting…" : "Delete session"}
        </button>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this session?"
        description="This permanently removes the session and every putt in it. This can't be undone."
        confirmLabel="Delete session"
        destructive
        pending={deleting}
        onConfirm={() =>
          startDelete(() => {
            void deletePuttSession(sessionId);
          })
        }
        onCancel={() => setConfirmingDelete(false)}
      />
      <OfflineNoticeModal
        open={offlineGuard.blocked}
        onClose={offlineGuard.dismiss}
      />
    </main>
  );
}
