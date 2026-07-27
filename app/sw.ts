/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import { Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

// defaultCache already includes Next.js App Router page/RSC caching (see
// PAGES_CACHE_NAME), so a previously-visited route — including an
// in-progress round — can reload from cache if the network is down. Every
// in-app navigation is guarded client-side before it starts (see
// GuardedLink), so this should be unreachable in normal use.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

// A fetch handler must always resolve to a Response — if every strategy's
// network attempt AND cache lookup both fail (no client-side guard caught
// it first, e.g. a bookmarked deep link with no cached copy), Workbox's
// router rejects instead, and Safari surfaces that as a raw
// "FetchEvent.respondWith received an error: no-response" failure rather
// than any kind of page. This is the last-resort catch that guarantees a
// real Response either way, without a dedicated app page or precache entry.
serwist.setCatchHandler(async ({ request }) => {
  if (request.destination === "document") {
    return new Response(
      '<!doctype html><meta charset=utf-8><meta name=viewport content=width=device-width,initial-scale=1><body style="font:16px system-ui;text-align:center;padding:4rem 1.5rem;color:#111">You&rsquo;re offline and this page hasn&rsquo;t loaded before.</body>',
      { status: 503, headers: { "Content-Type": "text/html" } },
    );
  }
  return Response.error();
});

serwist.addEventListeners();
