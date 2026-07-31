import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/db/queries";
import { loadUserRounds } from "@/lib/db/round-queries";
import { resolveBaseline } from "@/lib/baseline";
import { FeedCard } from "@/components/round/feed-card";
import { GuardedLink } from "@/components/shell/guarded-link";

export default async function FeedPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const handicap = profile?.handicap != null ? Number(profile.handicap) : null;
  const baseline = resolveBaseline(
    profile?.defaultBaseline ?? "handicap",
    handicap,
  );
  const rounds = await loadUserRounds(user.id, baseline);

  const inProgress = rounds.filter((r) => r.status === "in_progress");
  const completed = rounds.filter((r) => r.status === "complete");

  return (
    <main className="mx-auto w-full max-w-md px-5 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gainsmaxx</h1>
          <p className="mt-1 text-sm text-muted">
            Your rounds, scored by strokes gained.
          </p>
        </div>
        {/* Starting a round creates a server row, so this stays guarded —
            unlike resuming one, which works offline. */}
        <GuardedLink
          href="/round/new"
          aria-label="Start a round"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
        >
          <Plus size={26} strokeWidth={2.5} />
        </GuardedLink>
      </div>

      {rounds.length === 0 ? (
        <div className="mt-8 rounded-app border border-border bg-surface p-8 text-center text-muted">
          No rounds yet.
          <br />
          Tap <span className="font-semibold text-primary">+</span> above to
          start tracking a round.
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {inProgress.map((round) => (
            <FeedCard key={round.id} round={round} />
          ))}
          {completed.map((round) => (
            <FeedCard key={round.id} round={round} />
          ))}
        </div>
      )}
    </main>
  );
}
