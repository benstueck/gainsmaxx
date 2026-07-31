import { requireUser } from "@/lib/auth";
import { lastWedgeSessionParams } from "@/lib/db/wedge-queries";
import { NewSessionForm } from "@/components/wedge/new-session-form";
import {
  DEFAULT_BALL_COUNT,
  DEFAULT_MAX_DISTANCE,
  DEFAULT_MIN_DISTANCE,
} from "@/lib/wedge";

export default async function NewWedgeSessionPage() {
  const user = await requireUser();
  const last = await lastWedgeSessionParams(user.id);

  return (
    <main className="mx-auto w-full max-w-md px-5 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Start a session</h1>
      <p className="mt-1 text-muted">Dial in your wedge distance control.</p>
      <div className="mt-6">
        <NewSessionForm
          defaultBallCount={last?.ballCount ?? DEFAULT_BALL_COUNT}
          defaultMinDistance={last?.minDistance ?? DEFAULT_MIN_DISTANCE}
          defaultMaxDistance={last?.maxDistance ?? DEFAULT_MAX_DISTANCE}
        />
      </div>
    </main>
  );
}
