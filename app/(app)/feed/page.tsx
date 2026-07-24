export default function FeedPage() {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Your rounds</h1>
      <div className="mt-8 rounded-app border border-border bg-surface p-8 text-center text-muted">
        No rounds yet.
        <br />
        Tap the <span className="font-semibold text-primary">+</span> button to
        start tracking a round.
      </div>
    </main>
  );
}
