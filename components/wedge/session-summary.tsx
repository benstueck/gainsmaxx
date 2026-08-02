"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GuardedLink } from "@/components/shell/guarded-link";
import { OfflineNoticeModal } from "@/components/shell/offline-notice-modal";
import { useOfflineGuard } from "@/lib/offline/use-offline-guard";
import { deleteWedgeSession } from "@/app/wedgemaxx/actions";
import {
  distanceBreakdown,
  formatDuration,
  scoreShot,
  sessionSummary,
} from "@/lib/wedge";
import type { WedgeShot } from "@/lib/wedge";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

export function WedgeSessionSummaryView({
  sessionId,
  startedAt,
  ballCount,
  minDistance,
  maxDistance,
  elapsedSeconds,
  shots,
}: {
  sessionId: string;
  startedAt: string;
  ballCount: number;
  minDistance: number;
  maxDistance: number;
  elapsedSeconds: number;
  shots: WedgeShot[];
}) {
  const [deleting, startDelete] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const offlineGuard = useOfflineGuard();

  const summary = sessionSummary(shots);
  const bands = distanceBreakdown(shots);
  const date = new Date(startedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Negative means short, positive long.
  const bias = summary.averageBiasYd;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Wedgemaxx</h1>
          <p className="text-sm text-muted">
            {date} · {summary.ballsHit}/{ballCount} balls · {minDistance}–
            {maxDistance} yd
          </p>
        </div>
        <GuardedLink
          href="/wedgemaxx"
          className="p-1 text-sm font-semibold text-primary"
        >
          Done
        </GuardedLink>
      </header>

      {summary.ballsHit === 0 ? (
        <p className="rounded-app border border-border bg-surface p-8 text-center text-muted">
          No balls logged.
        </p>
      ) : (
        <>
          <section className="rounded-app border border-border p-4">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold tabular-nums">
                {summary.averagePoints.toFixed(1)}
              </span>
              <span className="text-sm text-muted">avg points</span>
            </div>
            <p className="mt-1 text-sm text-muted">
              100 = PGA Tour average distance control.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
              {/* Signed and compact so the three stats stay on one line each. */}
              <Stat
                label="BIAS"
                value={`${bias >= 0 ? "+" : "−"}${Math.abs(bias).toFixed(1)} yd`}
              />
              <Stat
                label="SPREAD"
                value={`${summary.averageAbsErrorYd.toFixed(1)} yd`}
              />
              <Stat
                label="MISHITS"
                value={
                  summary.mishitCount === 0
                    ? "0"
                    : `${summary.mishitCount} (${Math.round(summary.mishitRate * 100)}%)`
                }
              />
            </div>
            {elapsedSeconds > 0 && (
              <p className="mt-3 text-sm text-muted">
                Duration {formatDuration(elapsedSeconds)}
              </p>
            )}
          </section>

          {/* Per-distance scoring. Replaced a fixed sentence about bias that
              read identically on every summary and so told you nothing; these
              numbers differ session to session and actually locate a problem. */}
          {bands.length > 1 && (
            <section className="rounded-app border border-border p-4">
              <h2 className="text-sm font-semibold text-muted">By distance</h2>
              <ul className="mt-2 flex flex-col">
                <li className="flex items-center justify-between border-b border-border py-1 text-xs font-medium text-muted">
                  <span className="flex-1">Target</span>
                  <span className="w-14 text-right">Avg pts</span>
                  <span className="w-16 text-right">Bias</span>
                  <span className="w-12 text-right">Balls</span>
                </li>
                {bands.map((band) => (
                  <li
                    key={band.label}
                    className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0"
                  >
                    <span className="flex-1">{band.label}</span>
                    <span
                      className={cn(
                        "w-14 text-right font-semibold tabular-nums",
                        band.averagePoints >= 100
                          ? "text-positive"
                          : "text-foreground",
                      )}
                    >
                      {band.averagePoints.toFixed(0)}
                    </span>
                    <span className="w-16 text-right tabular-nums text-muted">
                      {band.biasYd == null
                        ? "—"
                        : `${band.biasYd >= 0 ? "+" : "−"}${Math.abs(band.biasYd).toFixed(1)}`}
                    </span>
                    <span className="w-12 text-right tabular-nums text-muted">
                      {band.ballsHit}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-semibold text-muted">
              Every ball
            </h2>
            <ul className="flex flex-col">
              <li className="flex items-center justify-between border-b border-border py-1 text-xs font-medium text-muted">
                <span className="w-8">#</span>
                <span className="flex-1">Target → Carry</span>
                <span className="w-14 text-right">Points</span>
              </li>
              {shots.map((shot, i) => {
                const r = scoreShot(shot);
                return (
                  <li
                    key={i}
                    className="flex items-center justify-between border-b border-border py-2 text-sm"
                  >
                    <span className="w-8 font-semibold tabular-nums">
                      {i + 1}
                    </span>
                    <span className="flex-1 tabular-nums">
                      {r.targetDistance} yd{" "}
                      <span className="text-muted">→</span>{" "}
                      {r.isMishit ? (
                        <span className="font-semibold text-negative">
                          Mishit
                        </span>
                      ) : (
                        <>
                          {r.carryDistance} yd
                          <span className="ml-1 text-xs font-semibold text-muted">
                            ({r.deltaYd! > 0 ? "+" : ""}
                            {r.deltaYd})
                          </span>
                        </>
                      )}
                    </span>
                    <span
                      className={cn(
                        "w-14 text-right font-semibold tabular-nums",
                        r.points >= 100 ? "text-positive" : "text-foreground",
                      )}
                    >
                      {r.points.toFixed(0)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <div className="pt-2">
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
        description="This permanently removes the session and every ball in it. This can't be undone."
        confirmLabel="Delete session"
        destructive
        pending={deleting}
        onConfirm={() =>
          startDelete(() => {
            void deleteWedgeSession(sessionId);
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
