"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { DivergingBar } from "@/components/ui/diverging-bar";
import { deleteRound, updateRoundHandicap } from "@/app/round/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BigButton } from "@/components/ui/big-button";
import { Input } from "@/components/ui/input";
import { GuardedLink } from "@/components/shell/guarded-link";
import { OfflineNoticeModal } from "@/components/shell/offline-notice-modal";
import { useOfflineGuard } from "@/lib/offline/use-offline-guard";
import { baselineOptions } from "@/lib/baseline";
import { holeShotInputs, isHoleComplete, type HoleState } from "@/lib/round";
import {
  holeStrokesGained,
  roundStrokesGained,
  type SgCategory,
} from "@/lib/sg";
import { computeBucketTotals, roundFirGir } from "@/lib/round-stats";
import { AdvancedStatsSection } from "@/components/stats/advanced-stats";

const CATEGORY_LABEL: Record<SgCategory, string> = {
  ott: "Off the tee",
  app: "Approach",
  arg: "Around green",
  putt: "Putting",
};
const CATEGORY_ORDER: SgCategory[] = ["ott", "app", "arg", "putt"];

const fmtSg = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
const fmtToPar = (v: number) => (v === 0 ? "E" : v > 0 ? `+${v}` : `${v}`);
const fmtPct = (made: number, attempted: number) =>
  attempted === 0
    ? "—"
    : `${made}/${attempted} (${Math.round((made / attempted) * 100)}%)`;

/** Diverging bar: green right of the zero midpoint for gained, red left for lost. */
function SgBar({ value, max }: { value: number; max: number }) {
  return (
    <DivergingBar
      tilt={max === 0 ? 0 : value / max}
      fillClassName={value >= 0 ? "bg-positive" : "bg-negative"}
    />
  );
}

export function RoundSummary({
  roundId,
  status,
  numHoles,
  courseName,
  playedAt,
  handicap,
  hasSnapshot,
  defaultBaseline,
  holes,
}: {
  roundId: string;
  status: "in_progress" | "complete";
  numHoles: number;
  courseName: string | null;
  playedAt: string;
  /** The index this round was played off (falls back to the current one). */
  handicap: number | null;
  /** False when this round predates having a handicap set, so the number shown
   *  is a fallback rather than a real snapshot. */
  hasSnapshot: boolean;
  defaultBaseline: string;
  holes: HoleState[];
}) {
  const options = baselineOptions(handicap, "Played off");
  const initialValue = options.some((o) => o.value === defaultBaseline)
    ? defaultBaseline
    : options[0].value;
  const [selectedValue, setSelectedValue] = useState(initialValue);
  const [deleting, startDelete] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editingHandicap, setEditingHandicap] = useState(false);
  const [handicapDraft, setHandicapDraft] = useState(
    handicap != null ? handicap.toFixed(1) : "",
  );
  const [savingHandicap, startSaveHandicap] = useTransition();
  const offlineGuard = useOfflineGuard();

  function onSaveHandicap() {
    const trimmed = handicapDraft.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value != null && (!Number.isFinite(value) || value < 0 || value > 54)) {
      return;
    }
    startSaveHandicap(() => {
      void updateRoundHandicap(roundId, value);
      setEditingHandicap(false);
    });
  }

  function onConfirmDelete() {
    startDelete(() => {
      void deleteRound(roundId);
    });
  }
  const baseline =
    options.find((o) => o.value === selectedValue)?.baseline ?? "tour";

  const playedHoles = holes.filter((h) => h.shots.length > 0);

  // The React Compiler memoizes this automatically.
  const round = roundStrokesGained(
    holes.map((h) => ({ par: h.par, shots: holeShotInputs(h) })),
    baseline,
  );

  const maxAbs = Math.max(
    0.5,
    ...CATEGORY_ORDER.map((c) => Math.abs(round.byCategory[c])),
  );

  const firGir = roundFirGir(holes);
  const bucketTotals = computeBucketTotals([holes]);

  const date = new Date(playedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Hole-by-hole rows with a running cumulative to-par (through completed holes).
  const holeRows = holes
    .filter((h) => h.shots.length > 0)
    .reduce<
      {
        hole: HoleState;
        hs: ReturnType<typeof holeStrokesGained>;
        done: boolean;
        cumToPar: number;
      }[]
    >((rows, h) => {
      const hs = holeStrokesGained(holeShotInputs(h), h.par);
      const done = isHoleComplete(h);
      const prev = rows[rows.length - 1];
      const cumToPar = done
        ? (prev?.cumToPar ?? 0) + (hs.score - h.par)
        : (prev?.cumToPar ?? 0);
      return [...rows, { hole: h, hs, done, cumToPar }];
    }, []);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {courseName || "Round"}
          </h1>
          <p className="text-sm text-muted">
            {date} · {round.holesPlayed}/{numHoles} holes
            {status === "in_progress" && " · in progress"}
          </p>
        </div>
        <GuardedLink
          href="/feed"
          className="p-1 text-sm font-semibold text-primary"
        >
          Done
        </GuardedLink>
      </header>

      {playedHoles.length === 0 ? (
        <p className="rounded-app border border-border bg-surface p-8 text-center text-muted">
          No shots logged yet.
        </p>
      ) : (
        <>
          {/* Hero total + baseline toggle */}
          <section className="rounded-app border border-border p-4">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-muted">
                Strokes gained vs
              </span>
              <select
                value={selectedValue}
                onChange={(e) => setSelectedValue(e.target.value)}
                className="h-10 rounded-app border border-border bg-background px-2 text-sm font-semibold"
              >
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3 flex items-baseline gap-2">
              <span
                className={cn(
                  "text-5xl font-bold tabular-nums",
                  round.total >= 0 ? "text-positive" : "text-negative",
                )}
              >
                {fmtSg(round.total)}
              </span>
              <span className="text-sm text-muted">total SG</span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {round.score} strokes · {fmtToPar(round.toPar)} to par
            </p>
            <div className="mt-3 flex gap-4 border-t border-border pt-3 text-sm">
              <div>
                <span className="text-muted">Fairways </span>
                <span className="font-semibold tabular-nums">
                  {fmtPct(firGir.fir.made, firGir.fir.attempted)}
                </span>
              </div>
              <div>
                <span className="text-muted">Greens </span>
                <span className="font-semibold tabular-nums">
                  {fmtPct(firGir.gir.made, firGir.gir.attempted)}
                </span>
              </div>
            </div>
          </section>

          {/* Category breakdown */}
          <section className="flex flex-col gap-3 rounded-app border border-border p-4">
            {CATEGORY_ORDER.map((c) => (
              <div key={c} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm font-medium">
                  {CATEGORY_LABEL[c]}
                </span>
                <SgBar value={round.byCategory[c]} max={maxAbs} />
                <span
                  className={cn(
                    "w-14 shrink-0 text-right text-sm font-semibold tabular-nums",
                    round.byCategory[c] >= 0
                      ? "text-positive"
                      : "text-negative",
                  )}
                >
                  {fmtSg(round.byCategory[c])}
                </span>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-border pt-3 text-sm font-semibold">
              <span>Tee to green</span>
              <span
                className={cn(
                  "tabular-nums",
                  round.teeToGreen >= 0 ? "text-positive" : "text-negative",
                )}
              >
                {fmtSg(round.teeToGreen)}
              </span>
            </div>
          </section>

          <AdvancedStatsSection buckets={bucketTotals} valueLabel="Total SG" />

          {/* Hole by hole */}
          <section>
            <h2 className="mb-2 text-sm font-semibold text-muted">
              Hole by hole
            </h2>
            <ul className="flex flex-col">
              <li className="flex items-center justify-between border-b border-border py-1 text-xs font-medium text-muted">
                <span className="w-10">Hole</span>
                <span className="w-10 text-center">Par</span>
                <span className="w-16 text-center">Score</span>
                <span className="w-16 text-right">SG</span>
              </li>
              {holeRows.map(({ hole: h, hs, done, cumToPar }) => (
                <li
                  key={h.holeNumber}
                  className="flex items-center justify-between border-b border-border py-2 text-sm"
                >
                  <span className="w-10 font-semibold">{h.holeNumber}</span>
                  <span className="w-10 text-center text-muted">{h.par}</span>
                  <span className="w-16 text-center tabular-nums">
                    {done ? (
                      <>
                        {hs.score}{" "}
                        <span className="text-muted">
                          ({fmtToPar(cumToPar)})
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "w-16 text-right font-semibold tabular-nums",
                      hs.total >= 0 ? "text-positive" : "text-negative",
                    )}
                  >
                    {fmtSg(hs.total)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              Per-hole SG is shown vs the PGA Tour baseline.
            </p>
          </section>
        </>
      )}

      <div className="flex flex-col gap-2 pt-2">
        {status === "in_progress" ? (
          <GuardedLink
            href={`/round/${roundId}`}
            className="flex min-h-tap items-center justify-center rounded-app bg-primary px-6 text-lg font-semibold text-primary-foreground"
          >
            Continue round
          </GuardedLink>
        ) : (
          <GuardedLink
            href={`/round/${roundId}?edit=1`}
            className="flex min-h-tap items-center justify-center rounded-app border border-border bg-surface px-6 text-lg font-semibold"
          >
            Edit round
          </GuardedLink>
        )}
        {/* Secondary actions, paired. The index lives here rather than the
            header: it's reference detail you occasionally correct, not a
            headline number — the baseline selector already states it up top. */}
        <div className="flex items-stretch">
          <button
            type="button"
            onClick={() => offlineGuard.guard(() => setEditingHandicap(true))}
            className="min-h-tap flex-1 text-sm font-semibold text-muted"
          >
            {handicap == null
              ? "Set index"
              : `${handicap.toFixed(1)} index${hasSnapshot ? "" : " (not recorded)"}`}
          </button>
          <div className="my-2 w-px shrink-0 bg-border" aria-hidden="true" />
          <button
            type="button"
            onClick={() => offlineGuard.guard(() => setConfirmingDelete(true))}
            disabled={deleting}
            className="min-h-tap flex-1 text-sm font-semibold text-negative disabled:opacity-40"
          >
            {deleting ? "Deleting…" : "Delete round"}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this round?"
        description="This permanently removes the round and every shot in it. This can't be undone."
        confirmLabel="Delete round"
        destructive
        pending={deleting}
        onConfirm={onConfirmDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
      {/* Correcting the index this round was played off. Matches
          ConfirmDialog's shell so the two modals feel like one system. */}
      {editingHandicap && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="handicap-dialog-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center"
          onClick={() => setEditingHandicap(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-app bg-background p-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:rounded-app sm:pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="handicap-dialog-title" className="text-lg font-bold">
              Handicap for this round
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              The index you played off. Changes this round&rsquo;s strokes
              gained only — it won&rsquo;t touch your current index or any other
              round.
            </p>
            <Input
              type="text"
              inputMode="decimal"
              value={handicapDraft}
              autoFocus
              onChange={(e) => setHandicapDraft(e.target.value)}
              placeholder="e.g. 12.5"
              aria-label="Handicap index for this round"
              className="mt-4"
            />
            <div className="mt-6 flex flex-col gap-3">
              <BigButton
                block
                disabled={savingHandicap}
                onClick={onSaveHandicap}
              >
                {savingHandicap ? "Saving…" : "Save"}
              </BigButton>
              <BigButton
                variant="secondary"
                block
                disabled={savingHandicap}
                onClick={() => {
                  setHandicapDraft(handicap != null ? handicap.toFixed(1) : "");
                  setEditingHandicap(false);
                }}
              >
                Cancel
              </BigButton>
            </div>
          </div>
        </div>
      )}
      <OfflineNoticeModal
        open={offlineGuard.blocked}
        onClose={offlineGuard.dismiss}
      />
    </main>
  );
}
