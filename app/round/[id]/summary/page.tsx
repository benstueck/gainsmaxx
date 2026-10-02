import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/db/queries";
import { loadRound, roundHandicapSnapshot } from "@/lib/db/round-queries";
import { RoundSummary } from "@/components/round/round-summary";

export default async function RoundSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const loaded = await loadRound(id, user.id);
  if (!loaded) notFound();

  const profile = await getProfile(user.id);
  const currentHandicap =
    profile?.handicap != null ? Number(profile.handicap) : null;

  // The round is scored off the index it was PLAYED off, so changing your
  // handicap later can't rewrite history. Current handicap is only a fallback
  // for rounds created before one was set.
  const snapshot = roundHandicapSnapshot(loaded.round);
  const handicap = snapshot ?? currentHandicap;

  return (
    <RoundSummary
      roundId={id}
      status={loaded.round.status}
      numHoles={loaded.round.numHoles}
      courseName={loaded.round.courseName}
      playedAt={loaded.round.playedAt.toISOString()}
      handicap={handicap}
      hasSnapshot={snapshot != null}
      defaultBaseline={profile?.defaultBaseline ?? "handicap"}
      holes={loaded.holes}
    />
  );
}
