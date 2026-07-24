import { BigButton } from "@/components/ui/big-button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3 text-center">
        <span className="text-6xl">⛳️</span>
        <h1 className="text-4xl font-bold tracking-tight">Gainsmaxxing</h1>
        <p className="text-lg text-muted">
          Track strokes gained shot-by-shot, right on the course.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <BigButton block disabled>
          Sign in — coming soon
        </BigButton>
        <p className="text-center text-sm text-muted">
          Project scaffolded. Auth &amp; round tracking are next.
        </p>
      </div>
    </main>
  );
}
