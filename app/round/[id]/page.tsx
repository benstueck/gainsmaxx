import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/db/queries";
import { loadRound } from "@/lib/db/round-queries";
import { RoundSession } from "@/components/round/round-session";

export default async function RoundPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const user = await requireUser();

  const loaded = await loadRound(id, user.id);
  if (!loaded) notFound();
  // A finished round opens as its summary unless explicitly editing.
  if (loaded.round.status === "complete" && edit !== "1") {
    redirect(`/round/${id}/summary`);
  }

  const profile = await getProfile(user.id);
  const handicap = profile?.handicap != null ? Number(profile.handicap) : null;

  return (
    <RoundSession
      roundId={id}
      numHoles={loaded.round.numHoles}
      handicap={handicap}
      initialHoles={loaded.holes}
    />
  );
}
