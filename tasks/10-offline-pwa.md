# 10 — Offline-first & PWA

**Status:** done — verified end-to-end (real Dexie/sync retries; PWA infra verified via a
production build since the SW is disabled in `next dev`)
**Depends on:** 06

## Goal

Make the whole round-capture experience work with **zero signal** and sync when reconnected —
the non-negotiable on-course requirement.

## Scope decision (read this before touching this milestone again)

Signal drops **mid-round**, not before you ever open the app — you start tracking with at least
some signal (parking lot, clubhouse), and the network dies once you're out on the course. That's
what's actually implemented and tested. Starting a **brand-new** round still requires a live
`createRound` call. This matches the task's own acceptance criteria ("DevTools offline →
complete a round → reconnect") and kept the change to the existing server-component architecture
minimal instead of a full client-rendered-everything rewrite.

## What landed

**PWA**
- `next.config.ts` + `app/serwist/[path]/route.ts` (`@serwist/turbopack`, **not** `@serwist/next`
  — the latter is webpack-only and hard-errors under Next 16's default Turbopack builder for both
  dev and build). The route bundles `app/sw.ts` with esbuild at request time and serves it with
  `Service-Worker-Allowed: /` so it can control the whole app despite living at `/serwist/sw.js`.
- `app/sw.ts` — `Serwist` + `@serwist/turbopack/worker`'s `defaultCache` (Next App Router page/RSC
  caching baked in) plus a `/~offline` fallback (`app/~offline/page.tsx`, static, explicitly
  precached via `additionalPrecacheEntries` in the route) for routes never visited before going
  offline.
- `components/pwa/register-service-worker.tsx` — manual `navigator.serviceWorker.register(
  "/serwist/sw.js", { scope: "/" })`; `@serwist/turbopack` doesn't auto-inject registration like
  `@serwist/next` did, and the explicit `scope: "/"` is required (the SW's own directory is the
  default scope; the response header only *permits* widening it, doesn't do so automatically).
- `public/manifest.webmanifest` + `scripts/gen-pwa-icons.mjs` (dependency-free 192/512 PNG
  placeholders — swap for real branded icons later) + `metadata.manifest`/`icons` in `app/layout.tsx`.
- `tsconfig.worker.json` (separate `lib: ["esnext","webworker"]` project) since `app/sw.ts` needs
  worker globals the main DOM-flavored tsconfig doesn't have; wired into `npm run typecheck`.

**Local-first sync**
- `lib/offline/db.ts` — Dexie table `roundDrafts` keyed by `roundId`. A draft only exists when a
  sync has *failed*; it's deleted the moment one succeeds, so there's never a second long-lived
  copy to reconcile.
- `lib/offline/round-sync.ts` — `getDraft`/`putDraft`/`clearDraft` + `flushAllDrafts` (safety net
  for plain-save drafts left over from another tab; a queued Finish is deliberately excluded —
  it's only retried from a live, mounted session so its redirect actually navigates the right tab).
- `components/round/round-session.tsx`:
  - `attemptSave`/`attemptFinish` — try the existing `saveRound`/`finishRound` server actions;
    on failure, queue in Dexie and flip the UI to an offline state instead of throwing away data.
  - Mount effect: a leftover draft (reload while offline, or app killed mid-sync) wins over the
    server-provided `initialHoles` and is immediately retried.
  - Debounced autosave now goes through `attemptSave` instead of a bare fire-and-forget call.
  - `online` event listener retries whatever's queued (save or finish) the moment connectivity
    returns.
  - Header shows **"Offline — saved locally"** / **"Saving…"** in place of the live SG line while
    not synced; a queued Finish shows its own banner and keeps the Finish button live for a
    manual retry.
  - `isRedirectError` — Next encodes a successful `redirect()` as a thrown `NEXT_REDIRECT` digest,
    not a normal return; both `attemptFinish` branches must clear the draft on this path (a real
    bug caught in testing: only the non-throwing branch cleared it, leaving a stale draft behind
    forever after every successful offline finish).

## Checklist

- [x] Serwist service worker + web manifest; installable (verified: manifest fetches 200 with
      correct icons/theme; SW registers at scope `/` and activates).
- [x] Precache app shell — 33 entries / ~870 KiB verified in `Cache Storage` after activation.
      Benchmark JSON needs no separate caching: it's statically imported into the JS bundle, so
      it's covered by precaching the bundle itself — SG computes offline with zero extra work.
- [x] Dexie local store for the in-progress round; the tracking session is local-first for
      **already-loaded** sessions (see scope decision above).
- [x] Client-generated `client_uuid` — already existed from Task 02; reused as-is (round creation
      itself isn't yet offline-capable, so no new idempotency surface was introduced here).
- [x] Sync layer: queue local mutations, flush on reconnect. (Last-write-wins wasn't needed in the
      way originally scoped — there's only ever one writer, the currently-open tab, since a draft
      is a queue-of-one per round, not a merge of two divergent copies.)
- [x] Online/offline + pending-sync indicators in the UI (header text + Finish-button banner).
- [ ] Reconciliation on app open (pull server changes not yet local) — not built; low priority for
      a personal single-device tool. `flushAllDrafts` exists as a hook point if multi-device ever
      matters.

## Acceptance criteria — all verified live (production build, `window.fetch` patched to reject
to simulate offline, since this sandbox has no true network-level offline toggle)

- [x] **Offline → complete a full 18-hole round → reconnect → all data syncs, no loss.** Played
      18 holes (tee shot holed each time) with `fetch` rejecting throughout; header showed
      "Offline — saved locally" the whole time; reconnected via a synthetic `online` event →
      autosave retried and cleared the draft. Confirmed via direct DB query: round `in_progress`
      with hole 1's 3 shots and correct SG (+0.99) already present mid-round.
- [x] **Finish while offline queues and completes on reconnect.** Tapped Finish offline → stayed
      on the session screen with the "will finish syncing" banner (no premature/broken
      navigation) → DB confirmed still `in_progress` → dispatched `online` → **automatically
      navigated to the summary** with no manual re-tap. DB confirmed `status: complete`, all 18
      holes present. Exactly one row for the round (idempotency intact).
- [x] **Reload while offline recovers unsynced progress.** Set a hole's tee length while offline,
      confirmed the Dexie draft existed, then did a full page reload (not just a soft nav) —
      the session correctly restored "Tee shot from 422 yd" from the local draft instead of the
      stale/empty server state.
- [x] **Installed PWA shell**: manifest + 192/512 icons load; SW registers at root scope and
      precaches 33 entries after a production build (`next dev` intentionally doesn't run the SW
      — Turbopack dev and the esbuild-bundled route don't fight, but there's no reason to pay the
      cache-churn cost every HMR reload; verify PWA behavior via `npm run build && npm run start`).

## Notes for next time

- **Don't test this under `next dev`.** The SW route works there too, but there's no reason to —
  do a real `npm run build && npm run start` pass instead, in a fresh incognito-equivalent
  profile/tab (multiple tabs on the same origin race each other's SW install/activate lifecycle
  and will produce confusing intermediate states).
- If you ever see a stale chunk hash being served after a rebuild, check for an **orphaned
  `next-server` process** still bound to port 3000 from a previous `npm run start` — `pkill -f
  "next start"` does not match the actual `next-server` process name. Use `lsof -i :3000` and
  kill the PID directly.
- The two source-data-adjacent scope items intentionally deferred: offline **round creation** and
  **cross-device reconciliation**. Revisit only if a real usage pattern demands them.
