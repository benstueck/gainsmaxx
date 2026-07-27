# 11 — QA & deploy

**Status:** QA done — verified end-to-end; deploy not yet started
**Depends on:** all prior

## Goal

End-to-end verification and production deploy.

## QA — done

- [x] Engine tests green (21 tests incl. the SG invariant, vs real reference data).
- [x] End-to-end pass (fresh accounts, dev server): sign up → NUX → play a round → summary
      matches the in-session live SG exactly → **edit a shot → SG recomputes** → verified
      persisted correctly in Supabase.
- [x] Offline scenario — already exhaustively verified in Milestone 10 (full 18-hole offline
      round, offline Finish, reload-recovers-a-draft).
- [x] RLS / per-user isolation: User B got a **404** on User A's round via direct URL; User B's
      Feed was empty. (RLS itself — not just app-level `userId` scoping — was verified enabled
      with per-user policies back in Task 02; this pass re-confirmed no leakage through the app.)
- [x] Mobile viewport pass — exercised throughout at 375×812 across this and prior milestones.
- [ ] Full accessibility audit — explicitly **out of scope** per user direction. One real bug
      found incidentally during the functional pass (below) was fixed since it also affected
      correctness, not just a11y; no further a11y work was done.

### Bug found and fixed during this pass

**Editing an earlier (non-holed) shot after the hole is already complete was silently broken.**
Tapping the shot correctly highlighted the row (`draft.editing` was set), but the entry dock kept
showing the "Hole complete" summary card instead of the edit form, because the dock's ternary
only checked `complete`, not whether an edit was in progress. Separately, even the underlying
`addShot`/`holeOut` reducer cases would have no-op'd on save: they gated on `nextStart(hole)`,
which returns `null` once _any_ shot in the hole is holed, regardless of which shot is being
edited.

Fixed by:

- `lib/round.ts`: added `startForIndex(hole, index)` — chains from Tee through the _preceding_
  shots only, so it works for an arbitrary shot index even after the hole is complete.
- `components/round/round-session.tsx`: the entry dock now shows the edit form whenever
  `state.draft.editing != null`, regardless of `complete`; `addShot`/`holeOut`/the render's
  `start` all use `startForIndex` when editing, `nextStart` otherwise.

Verified live: edited hole 1's tee shot (150→180 yd) after the hole was already holed out —
the edit form appeared, saved correctly, shot 2 re-chained its start to the new distance, hole
total SG stayed internally consistent (+0.99), and the change persisted to Supabase exactly as
shown on screen.

## Deploy — mostly done

- [x] Decided: reuse the existing Supabase project as production.
- [x] Deployed to **Vercel** (`bens-projects-3790fb25/gainsmaxxing`) via CLI; all four env vars
      (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`,
      `DIRECT_URL`) set for Production. Live at **https://gainsmaxxing.benstueck.com** (custom
      domain, CNAME verified, valid TLS) and https://gainsmaxxing.vercel.app. GitHub repo
      connected for auto-deploy-on-push to `main`.
- [x] Verify PWA install + offline on the deployed URL from a real phone — found and fixed a
      real bug (below); needs a re-test after the fix.
- [ ] Update `CLAUDE.md` (status, deploy notes, live URL).

### Bug found and fixed during real-device offline testing

**Force-quitting the installed PWA while offline mid-round, then reopening it, landed on a dead
"you're offline" page with no way back into the in-progress round.** Root cause: the PWA manifest's
`start_url` is `/feed`, and iOS relaunches an installed home-screen app at `start_url`, not at
whatever page was last open. The service worker's runtime cache only holds pages that were
actually *visited* over the network — so if `/feed` was never loaded in that session (e.g. the
user went straight from login into "+" → new round), it has no cached copy, the offline
navigation fails, and Serwist's `fallbacks` config serves the static `/~offline` page — which,
before this fix, was a dead end even though the in-progress round's own page (visited before
going offline) was sitting right there in the cache.

Fixed by:

- `components/pwa/register-service-worker.tsx`: now also calls `flushAllDrafts()` once on mount
  and again on every `online` event — this was previously dead code (defined in
  `lib/offline/round-sync.ts`, never called anywhere), so a draft queued for a round the user
  didn't reopen would never sync until they happened to revisit that exact round page.
- `app/~offline/page.tsx`: no longer a purely static dead end — on load it checks the local
  Dexie `roundDrafts` table (still precached/static at build time; only the client-side check is
  dynamic) and, if a draft exists, shows a **"Resume round"** link straight to `/round/{roundId}`,
  which loads from the SW cache since that page was genuinely visited before going offline.

Re-verified on a real iPhone: force-quit-while-offline now correctly relaunches into Feed (which
was cached from normal use) and the in-progress round reopens fine from there.

**Follow-up bug found in the same pass, then redesigned rather than patched further:** tapping
the "+" tab while offline (starting a round needs a DB round to be created, so it can't work
offline) landed on `/~offline`, whose "Resume round" button turned out to be the wrong shape for
the problem entirely — the user already can (and does) resume an in-progress round from the Feed,
so routing them through a fallback page to get back to the same place was redundant, and it kept
breaking in new ways (a `next/link` inside an already-broken client-side navigation context
doing nothing on tap). Redesigned instead: `components/shell/tab-bar.tsx` now checks
`navigator.onLine` before letting the "+" tab navigate at all, and shows a small in-app modal
("Starting a new round needs a connection...") instead of navigating when offline — the user
never leaves Feed (or wherever they were), so there's nothing to recover from. `/~offline` is
back to being a plain static dead-end page, kept only as a last resort for a direct/bookmarked
link to a page with no cached copy at all; the common path no longer reaches it.

## Acceptance criteria

- [ ] The deployed PWA supports a full offline round with correct SG and per-user data isolation.
