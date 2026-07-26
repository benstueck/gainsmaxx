import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/db/queries";
import { loadUserRounds } from "@/lib/db/round-queries";
import { FeedCard } from "@/components/round/feed-card";

export default async function FeedPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const handicap = profile?.handicap != null ? Number(profile.handicap) : null;
  const rounds = await loadUserRounds(user.id, handicap ?? "tour");

  const inProgress = rounds.filter((r) => r.status === "in_progress");
  const completed = rounds.filter((r) => r.status === "complete");

  return (
    <main className="mx-auto w-full max-w-md px-5 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Your rounds</h1>

      {rounds.length === 0 ? (
        <div className="mt-8 rounded-app border border-border bg-surface p-8 text-center text-muted">
          No rounds yet.
          <br />
          Tap the <span className="font-semibold text-primary">+</span> button
          to start tracking a round.
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
