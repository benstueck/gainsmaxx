import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeedRound } from "@/lib/db/round-queries";
import type { SgCategory } from "@/lib/sg";
import { GuardedLink } from "@/components/shell/guarded-link";

const MINI: { key: SgCategory; label: string }[] = [
  { key: "ott", label: "OTT" },
  { key: "app", label: "APP" },
  { key: "arg", label: "ARG" },
  { key: "putt", label: "PUTT" },
];

const fmtSg = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
const fmtToPar = (v: number) => (v === 0 ? "E" : v > 0 ? `+${v}` : `${v}`);

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.min(50, (Math.abs(value) / max) * 50);
  const positive = value >= 0;
  return (
    <div className="relative h-1 w-full rounded-full bg-surface-2">
      <div
        className={cn(
          "absolute top-0 h-full rounded-full",
          positive ? "bg-positive" : "bg-negative",
        )}
        style={
          positive
            ? { left: "50%", width: `${pct}%` }
            : { right: "50%", width: `${pct}%` }
        }
      />
    </div>
  );
}

export function FeedCard({ round }: { round: FeedRound }) {
  const { summary } = round;
  const inProgress = round.status === "in_progress";
  const href = inProgress ? `/round/${round.id}` : `/round/${round.id}/summary`;
  const date = new Date(round.playedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const maxAbs = Math.max(
    0.5,
    ...MINI.map((m) => Math.abs(summary.byCategory[m.key])),
  );

  return (
    <GuardedLink
      href={href}
      // Continuing the in-progress round is always safe offline — it's the
      // exact page the round is already being tracked on, guaranteed
      // cached. A past round's summary might not be, so that one still
      // gets the offline check.
      skipGuard={inProgress}
      className={cn(
        "block rounded-app border p-4 active:bg-surface",
        inProgress ? "border-primary bg-primary/5" : "border-border",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {round.courseName || "Round"}
          </p>
          <p className="text-sm text-muted">
            {date} · {round.numHoles} holes
          </p>
        </div>
        {inProgress ? (
          <span className="flex shrink-0 items-center gap-1 font-semibold text-primary">
            Continue <ChevronRight size={18} />
          </span>
        ) : (
          <div className="shrink-0 text-right">
            <div
              className={cn(
                "text-xl font-bold tabular-nums",
                summary.total >= 0 ? "text-positive" : "text-negative",
              )}
            >
              {fmtSg(summary.total)}
            </div>
            <div className="text-xs text-muted">SG</div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted">
          {inProgress
            ? `${summary.holesPlayed}/${round.numHoles} holes · in progress`
            : `${summary.score} strokes · ${fmtToPar(summary.toPar)}`}
        </span>
      </div>

      {summary.holesPlayed > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {MINI.map((m) => (
            <div key={m.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-muted">
                  {m.label}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-semibold tabular-nums",
                    summary.byCategory[m.key] >= 0
                      ? "text-positive"
                      : "text-negative",
                  )}
                >
                  {fmtSg(summary.byCategory[m.key])}
                </span>
              </div>
              <MiniBar value={summary.byCategory[m.key]} max={maxAbs} />
            </div>
          ))}
        </div>
      )}
    </GuardedLink>
  );
}
