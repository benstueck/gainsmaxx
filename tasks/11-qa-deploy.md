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
- [x] Deployed to **Vercel** (originally `bens-projects-3790fb25/gainsmaxxing`, renamed to
      `gainsmaxx` when the app was rebranded — see the rebrand entry below) via CLI; all four env
      vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`,
      `DIRECT_URL`) set for Production. Originally live at gainsmaxxing.benstueck.com /
      gainsmaxxing.vercel.app; now **https://gainsmaxx.benstueck.com**. GitHub repo connected for
      auto-deploy-on-push to `main`.
- [x] Verify PWA install + offline on the deployed URL from a real phone — found and fixed a
      real bug (below); needs a re-test after the fix.
- [ ] Update `CLAUDE.md` (status, deploy notes, live URL).

### Bugs found during real-device offline testing, and the final design

Real-device testing (force-quitting the installed PWA mid-round while offline, then reopening it
or navigating around) surfaced a whole class of the same bug from different entry points: any
in-app link to a dynamic, authenticated page (Profile, a past round's summary, "+", "Exit round",
etc.) that didn't happen to have a cached copy for that offline session would hit Serwist's
document-fallback page — which lives outside the `(app)` layout, so it has **no tab bar and no
way to navigate anywhere**. Patching the fallback page itself (a smarter "resume" button, Dexie
checks) kept breaking in new ways because it was solving the wrong problem: the fallback page is
inherently a dead end by construction, so the fix has to prevent ever landing on it, not make it
nicer once you're there.

**Final design:** a shared `useOfflineGuard` hook (`lib/offline/use-offline-guard.ts`) + two
components — `GuardedLink` (`components/shell/guarded-link.tsx`, wraps `next/link`) and
`OfflineNoticeModal` (`components/shell/offline-notice-modal.tsx`). Every in-app navigation link
to a dynamic page now goes through `GuardedLink` instead of a bare `Link`: `TabBar` (all three
tabs), `FeedCard` (every round card), `round-summary.tsx` ("Done", "Continue round"/"Edit round"),
and `round-session.tsx` ("Exit round"). Each checks `navigator.onLine` before letting the
navigation proceed; offline, it shows the same small modal and the user stays exactly where they
were — nothing to get stuck on. `round-summary.tsx`'s "Delete round" button (a server action, not
a navigation) is guarded the same way via the hook's `guard()` wrapper.

The custom `/~offline` fallback page, `additionalPrecacheEntries`, and `fallbacks` config in
`app/sw.ts` were removed entirely — every reachable navigation is now blocked before it starts,
so there's nothing left for a fallback page to catch. An unguarded edge case (e.g. a bookmarked
deep link) just falls through to the browser's own native offline error.

Also fixed in the same pass: `components/pwa/register-service-worker.tsx` now calls
`flushAllDrafts()` on mount and on every `online` event — previously dead code (defined in
`lib/offline/round-sync.ts`, never called anywhere), so a queued draft for a round the user didn't
happen to reopen would never sync.

Needs a final re-test on the phone: force-quit mid-round while offline, then try every tab and a
past round's card while still offline — none should ever leave you stuck.

### Rebrand: Gainsmaxxing → Gainsmaxx

The app is expanding beyond round-by-round SG tracking to a broader golf-performance platform,
starting with **Wedgemaxx** (a wedge-distance-control practice mode — see
`tasks/13-wedgemaxx.md` once that plan lands). Renamed to drop the "-ing" and match that
convention:

- User-facing: app title/metadata (`app/layout.tsx`), PWA manifest name/short_name, the login
  page heading, `README.md`, `CLAUDE.md`.
- **Not** renamed: the Dexie offline-database name (`lib/offline/db.ts`, still literally
  `"gainsmaxxing"`) — it's an internal identifier never shown to a user, and renaming it would
  orphan any already-queued local offline draft on someone's phone (a new DB name means the old
  one's data is simply never opened again). Cosmetic rename wasn't worth that risk.
- GitHub repo renamed `benstueck/gainsmaxxing` → `benstueck/gainsmaxx` (GitHub auto-redirects the
  old URL). Vercel project renamed to match. New custom domain
  **https://gainsmaxx.benstueck.com**; the old `gainsmaxxing.benstueck.com` CNAME can be pointed
  at the same project if you want it to keep resolving, or removed.
- Local clone directory is still `~/Projects/gainsmaxxing` on disk — rename it yourself with
  `mv ~/Projects/gainsmaxxing ~/Projects/gainsmaxx` whenever's convenient; git doesn't care about
  the folder name, only the remote URL.
- Not changed: the Supabase project's internal display name and its Auth **Site URL** /
  **Redirect URLs** — worth updating in the Supabase dashboard for consistency, though nothing in
  the app currently depends on them (no email-confirmation or forgot-password-email flow uses a
  redirect URL today).

## Acceptance criteria

- [ ] The deployed PWA supports a full offline round with correct SG and per-user data isolation.
