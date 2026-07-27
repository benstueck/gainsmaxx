// Required by the service worker config (Serwist needs a precached fallback
// URL for a navigation with zero cached copy — e.g. a direct/bookmarked
// link). Every in-app navigation is now guarded before it ever gets here
// (see TabBar), so in practice this should never be seen.
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
        available without a connection.
      </p>
    </main>
  );
}
