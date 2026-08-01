import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadWedgeSession } from "@/lib/db/wedge-queries";
import { WedgeSessionSummaryView } from "@/components/wedge/session-summary";

export default async function WedgeSessionSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const loaded = await loadWedgeSession(id, user.id);
  if (!loaded) notFound();

  return (
    <WedgeSessionSummaryView
      sessionId={id}
      startedAt={loaded.session.startedAt.toISOString()}
      ballCount={loaded.session.ballCount}
      minDistance={loaded.session.minDistance}
      maxDistance={loaded.session.maxDistance}
      elapsedSeconds={loaded.session.elapsedSeconds}
      shots={loaded.shots}
    />
  );
}
