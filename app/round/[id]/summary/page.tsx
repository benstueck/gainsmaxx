import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/db/queries";
import { loadRound } from "@/lib/db/round-queries";
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
  const handicap = profile?.handicap != null ? Number(profile.handicap) : null;

  return (
    <RoundSummary
      roundId={id}
      status={loaded.round.status}
      numHoles={loaded.round.numHoles}
      courseName={loaded.round.courseName}
      playedAt={loaded.round.playedAt.toISOString()}
      handicap={handicap}
      defaultBaseline={profile?.defaultBaseline ?? "handicap"}
      holes={loaded.holes}
    />
  );
}
