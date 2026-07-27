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
// GuardedLink), so there's no custom offline fallback page here — an
// unguarded navigation with no cached copy (e.g. a bookmarked deep link)
// just falls through to the browser's own offline error.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
