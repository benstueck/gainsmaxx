import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadWedgeSession } from "@/lib/db/wedge-queries";
import { WedgeSession } from "@/components/wedge/wedge-session";

export default async function WedgeSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const loaded = await loadWedgeSession(id, user.id);
  if (!loaded) notFound();
  // A finished session has nothing to enter. Phase 6 gives it a dedicated
  // summary page; until then the list card already shows its numbers.
  if (loaded.session.status === "complete") redirect("/wedgemaxx");

  return (
    <WedgeSession
      sessionId={id}
      ballCount={loaded.session.ballCount}
      minDistance={loaded.session.minDistance}
      maxDistance={loaded.session.maxDistance}
      initialShots={loaded.shots}
    />
  );
}
