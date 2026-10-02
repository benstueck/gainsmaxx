import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadPuttSession } from "@/lib/db/putt-queries";
import { PuttSessionSummaryView } from "@/components/putt/session-summary";

export default async function PuttSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const loaded = await loadPuttSession(id, user.id);
  if (!loaded) notFound();

  return (
    <PuttSessionSummaryView
      sessionId={id}
      startedAt={loaded.session.startedAt.toISOString()}
      puttCount={loaded.session.puttCount}
      minDistance={loaded.session.minDistance}
      maxDistance={loaded.session.maxDistance}
      elapsedSeconds={loaded.session.elapsedSeconds}
      attempts={loaded.attempts}
    />
  );
}
