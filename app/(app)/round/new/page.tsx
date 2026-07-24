import { NewRoundForm } from "@/components/round/new-round-form";

export default function NewRoundPage() {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Start a round</h1>
      <p className="mt-1 text-muted">
        Log each shot to track your strokes gained.
      </p>
      <div className="mt-6">
        <NewRoundForm />
      </div>
    </main>
  );
}
