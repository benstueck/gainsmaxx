import { requireUser } from "@/lib/auth";
import { loadUserWedgeSessions } from "@/lib/db/wedge-queries";

/**
 * Wedgemaxx session feed. Phase 3 establishes the route so the new tab has a
 * real destination; Phase 4 adds the setup screen ("+"), styled session cards
 * and the in-progress "Continue" treatment.
 */
export default async function WedgemaxxPage() {
  const user = await requireUser();
  const sessions = await loadUserWedgeSessions(user.id);

  return (
    <main className="mx-auto w-full max-w-md px-5 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Wedgemaxx</h1>
      <p className="mt-1 text-sm text-muted">
        Wedge distance control, scored by strokes gained.
      </p>

      {sessions.length === 0 ? (
        <div className="mt-8 rounded-app border border-border bg-surface p-8 text-center text-muted">
          No sessions yet.
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="rounded-app border border-border p-4 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {new Date(s.startedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span className="font-bold tabular-nums">
                  {s.summary.ballsHit > 0
                    ? `${s.summary.averagePoints.toFixed(1)} pts`
                    : "—"}
                </span>
              </div>
              <div className="mt-1 text-muted">
                {s.summary.ballsHit}/{s.ballCount} balls · {s.minDistance}–
                {s.maxDistance} yd
                {s.status === "in_progress" && " · in progress"}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
