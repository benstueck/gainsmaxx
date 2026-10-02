import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadPuttSession } from "@/lib/db/putt-queries";
import { PuttSession } from "@/components/putt/putt-session";

export default async function PuttSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const user = await requireUser();

  const loaded = await loadPuttSession(id, user.id);
  if (!loaded) notFound();
  // A finished session opens to its summary unless explicitly editing —
  // the same ?edit=1 pattern the round session uses.
  if (loaded.session.status === "complete" && edit !== "1") {
    redirect(`/puttmaxx/${id}/summary`);
  }

  return (
    <PuttSession
      sessionId={id}
      puttCount={loaded.session.puttCount}
      minDistance={loaded.session.minDistance}
      maxDistance={loaded.session.maxDistance}
      putts={loaded.putts}
      initialAttempts={loaded.attempts}
      initialElapsedSeconds={loaded.session.elapsedSeconds}
    />
  );
}
