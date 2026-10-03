import { cn } from "@/lib/utils";
import { GuardedLink } from "@/components/shell/guarded-link";
import { formatDuration } from "@/lib/wedge";
import { TendencySnapshot } from "./tendency-rows";
import type { FeedPuttSession } from "@/lib/db/putt-queries";

const fmtSg = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;

export function SessionCard({ session }: { session: FeedPuttSession }) {
  const { summary } = session;
  const inProgress = session.status === "in_progress";
  const date = new Date(session.startedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <GuardedLink
      href={
        inProgress
          ? `/puttmaxx/${session.id}`
          : `/puttmaxx/${session.id}/summary`
      }
      className={cn(
        "block rounded-app border p-4 active:bg-surface",
        inProgress ? "border-primary bg-primary/5" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{date}</p>
          <p className="mt-0.5 text-sm text-muted">
            {summary.attemptCount}/{session.puttCount} putts ·{" "}
            {session.minDistance}–{session.maxDistance} ft
          </p>
        </div>
        {inProgress ? (
          <span className="shrink-0 text-sm font-semibold text-primary">
            Continue
          </span>
        ) : (
          <div className="shrink-0 text-right">
            <div
              className={cn(
                "text-2xl font-bold tabular-nums",
                summary.totalSg >= 0 ? "text-positive" : "text-negative",
              )}
            >
              {fmtSg(summary.totalSg)}
            </div>
            <div className="text-xs text-muted">SG</div>
          </div>
        )}
      </div>

      {summary.attemptCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2 text-xs text-muted">
          <span>
            Made{" "}
            <span className="font-semibold text-foreground">
              {summary.firstPuttsMade}/{summary.attemptCount}
            </span>{" "}
            ({Math.round(summary.makePercent * 100)}%)
          </span>
          {summary.threePutts > 0 && (
            <span>
              3-putts{" "}
              <span className="font-semibold text-negative">
                {summary.threePutts}
              </span>
            </span>
          )}
          {session.elapsedSeconds > 0 && (
            <span>{formatDuration(session.elapsedSeconds)}</span>
          )}
          {/* Strongest leans at a glance — the reason to open the session. */}
          <TendencySnapshot
            direction={summary.directionBias}
            read={summary.readBias}
            speed={summary.speedBias}
          />
        </div>
      )}
    </GuardedLink>
  );
}
