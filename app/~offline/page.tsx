"use client";

import { useEffect, useState } from "react";
import { offlineDb } from "@/lib/offline/db";

// Still static at build time (only the client-side IndexedDB check is
// dynamic) so it lands in the build output and can be precached by the
// service worker as the navigation fallback for routes that were never
// visited (and so have no cached copy of their own) before the network
// went down.
export const dynamic = "force-static";

export default function OfflinePage() {
  const [roundId, setRoundId] = useState<string | null | undefined>(
    undefined,
  );

  useEffect(() => {
    offlineDb.roundDrafts
      .orderBy("updatedAt")
      .last()
      .then((draft) => setRoundId(draft?.roundId ?? null))
      .catch(() => setRoundId(null));
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-5xl">📡</span>
      <h1 className="text-2xl font-bold tracking-tight">
        You&rsquo;re offline
      </h1>
      {roundId ? (
        <>
          <p className="text-muted">
            This page hasn&rsquo;t been loaded before, so it isn&rsquo;t
            available without a connection — but you have an in-progress
            round saved locally.
          </p>
          {/* Plain anchor, not next/link: this page is only ever reached
              because a client-side transition already failed offline, so a
              soft navigation here would just fail the same way. A real
              browser navigation is what lets the service worker serve the
              round page from its own cache. */}
          <a
            href={`/round/${roundId}`}
            className="mt-2 flex h-16 w-full items-center justify-center rounded-xl bg-primary text-lg font-semibold text-white"
          >
            Resume round
          </a>
        </>
      ) : (
        <p className="text-muted">
          This page hasn&rsquo;t been loaded before, so it isn&rsquo;t
          available without a connection. Anything you&rsquo;ve already
          opened still works, and any round in progress is saved locally
          until you&rsquo;re back online.
        </p>
      )}
    </main>
  );
}
