// Static last-resort fallback for a navigation the service worker has no
// cached copy of at all (e.g. a direct/bookmarked link to a page that was
// never visited). The common case — tapping "+" for a new round while
// offline — is now caught before navigation even starts (see TabBar), so
// this page is intentionally minimal rather than trying to route the user
// somewhere from here.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-5xl">📡</span>
      <h1 className="text-2xl font-bold tracking-tight">
        You&rsquo;re offline
      </h1>
      <p className="text-muted">
        This page hasn&rsquo;t been loaded before, so it isn&rsquo;t
        available without a connection. Anything you&rsquo;ve already
        opened still works, and any round in progress is saved locally
        until you&rsquo;re back online.
      </p>
    </main>
  );
}
