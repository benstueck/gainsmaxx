import { requireUser } from "@/lib/auth";
import { lastPuttSessionParams } from "@/lib/db/putt-queries";
import { NewSessionForm } from "@/components/putt/new-session-form";
import {
  DEFAULT_MAX_DISTANCE_FT,
  DEFAULT_MIN_DISTANCE_FT,
  DEFAULT_PUTT_COUNT,
} from "@/lib/putt";

export default async function NewPuttSessionPage() {
  const user = await requireUser();
  const last = await lastPuttSessionParams(user.id);

  return (
    <main className="mx-auto w-full max-w-md px-5 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Start a session</h1>
      <p className="mt-1 text-muted">
        Scored in strokes gained — 0.00 is Tour average.
      </p>
      <div className="mt-6">
        <NewSessionForm
          defaultPuttCount={last?.puttCount ?? DEFAULT_PUTT_COUNT}
          defaultMinDistance={last?.minDistance ?? DEFAULT_MIN_DISTANCE_FT}
          defaultMaxDistance={last?.maxDistance ?? DEFAULT_MAX_DISTANCE_FT}
        />
      </div>
    </main>
  );
}
