import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadUserWedgeSessions } from "@/lib/db/wedge-queries";
import { GuardedLink } from "@/components/shell/guarded-link";
import { SessionCard } from "@/components/wedge/session-card";

export default async function WedgemaxxPage() {
  const user = await requireUser();
  const sessions = await loadUserWedgeSessions(user.id);

  const inProgress = sessions.filter((s) => s.status === "in_progress");
  const completed = sessions.filter((s) => s.status === "complete");

  return (
    <main className="mx-auto w-full max-w-md px-5 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Wedgemaxx</h1>
          <p className="mt-1 text-sm text-muted">
            Practice wedge distance control
          </p>
        </div>
        {/* Starting a session creates a server row, so this stays guarded —
            unlike resuming one, which works offline. */}
        <GuardedLink
          href="/wedgemaxx/new"
          aria-label="Start a session"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
        >
          <Plus size={26} strokeWidth={2.5} />
        </GuardedLink>
      </div>

      {sessions.length === 0 ? (
        <div className="mt-8 rounded-app border border-border bg-surface p-8 text-center text-muted">
          No sessions yet.
          <br />
          Tap <span className="font-semibold text-primary">+</span> above to
          start one.
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {inProgress.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
          {completed.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </main>
  );
}
