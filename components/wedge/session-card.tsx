import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { GuardedLink } from "@/components/shell/guarded-link";
import { formatDuration } from "@/lib/wedge";
import type { FeedWedgeSession } from "@/lib/db/wedge-queries";

const fmtBias = (v: number) =>
  `${v >= 0 ? "+" : ""}${v.toFixed(1)} yd${v < 0 ? " short" : v > 0 ? " long" : ""}`;

export function SessionCard({ session }: { session: FeedWedgeSession }) {
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
          ? `/wedgemaxx/${session.id}`
          : `/wedgemaxx/${session.id}/summary`
      }
      className={cn(
        "block rounded-app border p-4 active:bg-surface",
        inProgress ? "border-primary bg-primary/5" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{date}</p>
          <p className="text-sm text-muted">
            {summary.ballsHit}/{session.ballCount} balls · {session.minDistance}
            –{session.maxDistance} yd
          </p>
        </div>
        {inProgress ? (
          <span className="flex shrink-0 items-center gap-1 font-semibold text-primary">
            Continue <ChevronRight size={18} />
          </span>
        ) : (
          <div className="shrink-0 text-right">
            <div className="text-xl font-bold tabular-nums">
              {summary.ballsHit > 0 ? summary.averagePoints.toFixed(1) : "—"}
            </div>
            <div className="text-xs text-muted">avg pts</div>
          </div>
        )}
      </div>

      {summary.ballsStruck > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
          <span className="text-muted">
            Bias{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {fmtBias(summary.averageBiasYd)}
            </span>
          </span>
          {summary.mishitCount > 0 && (
            <span className="text-muted">
              Mishits{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {summary.mishitCount}
              </span>
            </span>
          )}
          {session.elapsedSeconds > 0 && (
            <span className="text-muted tabular-nums">
              {formatDuration(session.elapsedSeconds)}
            </span>
          )}
        </div>
      )}
    </GuardedLink>
  );
}
