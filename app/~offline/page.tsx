// Static so it lands in the build output and can be precached by the service
// worker as the navigation fallback for routes that were never visited (and
// so never got their own cached copy) before the network went down.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-5xl">📡</span>
      <h1 className="text-2xl font-bold tracking-tight">
        You&rsquo;re offline
      </h1>
      <p className="text-muted">
        This page hasn&rsquo;t been loaded before, so it isn&rsquo;t available
        without a connection. Anything you&rsquo;ve already opened — including
        an in-progress round — still works, and your entries are saved locally
        until you&rsquo;re back online.
      </p>
    </main>
  );
}
