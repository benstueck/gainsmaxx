# 13 — Wedgemaxx (wedge distance-control training)

**Status:** Phases 1–6 done — playable end to end (create → log balls → mishits → edit → end
early / finish → summary). Remaining: offline (7), profile (8).
**Depends on:** 05 (SG engine), 10 (offline infra), 12 (advanced stats patterns)
**Design:** [`../plans/02-wedgemaxx.md`](../plans/02-wedgemaxx.md) — read this first, especially
the scoring derivation. Don't re-derive the calibration; it's documented there with the reasoning
and the sanity checks against published tour dispersion data.

## Decisions confirmed with the user

| Question           | Decision                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| End-position model | Proximity floored at **1 yd** (no hole-outs); putt in feet within 30 yd, **fairway in yards beyond 30 yd**                                                                           |
| Score anchor       | **PGA Tour average = 100 points at every target distance**, calibrated on `E[sgRaw]`, 50 pts/stroke. (Was scratch; retuned after real sessions showed breaking 100 was far too easy) |
| Entry input        | **Always-visible custom keypad**, never the OS keyboard — it covers the target yardage and stays open between balls                                                                  |
| Timer              | **Informational only** — pauses when you back out, stored, shown on summary + feed card                                                                                              |
| Offline            | **Full offline support now** — reuse the existing Dexie draft-queue pattern; gotchas are known                                                                                       |
| Editing shots      | **Tap any previous row to edit** a mistyped carry; points recompute                                                                                                                  |
| Target generation  | Uniform random **whole yards**, **never repeating the immediately-preceding target**                                                                                                 |
| Mishits            | One-tap **Mishit** button = zero progress = `SG −1` (~41 pts). Counts as a ball, excluded from bias/spread, tracked as its own mishit rate. `carry_distance = null` **is** the flag  |
| Profile stats      | **Yes** — Wedgemaxx block: sessions completed, career average points, best session                                                                                                   |

## Phase 1 — Scoring engine (`lib/wedge/`) — **done**

- [x] `lib/wedge/engine.ts`, pure (only imports the equally-pure `lib/sg`):
      `tourProximityYd`, `tourSigmaYd`, `tourDistanceErrorYd`, `wedgeShotSg`, `referenceSg`,
      `wedgeShotPoints`, `scoreShot`, `sessionSummary`, plus `nextTarget` (uniform whole yards,
      never repeating the previous target; takes an injectable `random` so tests are
      deterministic). `BASE_POINTS = 100` and `POINTS_PER_STROKE = 50` are named constants.
- [x] `lib/wedge/types.ts` + `lib/wedge/index.ts` public API, mirroring `lib/sg/`
- [x] Mishit support: `carryDistance: null` is the flag; `MISHIT_SG = −1` (zero progress);
      `sessionSummary` reports `ballsStruck`, `mishitCount`, `mishitRate` and keeps bias/spread
      over struck balls only
- [x] 33 tests in `lib/wedge/engine.test.ts`, all green

**Deviation from plan:** `referenceSg` memoizes per whole yard rather than interpolating a coarse
grid — targets are always integers, and the whole suite (including ~60k simulated shots) runs in
80 ms, so the extra machinery wasn't warranted.

**Verified live output** (tour anchor — retuned from scratch after real sessions, see the
"Scoring retune" note under Phase 4):

| Miss   | 50 yd | 90 yd | 140 yd |
| ------ | ----- | ----- | ------ |
| 0 yd   | 116   | 121   | 129    |
| 5 yd   | 79    | 84    | 92     |
| 10 yd  | 69    | 74    | 82     |
| 20 yd  | 58    | 62    | 70     |
| 40 yd  | 38    | 43    | 51     |
| Mishit | 36    | 34    | 35     |

Derived tour distance error: 2.4 yd @50 → 5.0 yd @140. **Tour** simulation averages 100.0 at 50,
90 and 140 (asserted in tests, seeded PRNG so it can't flake); scratch lands ~93.

## Phase 2 — Schema — **done**

- [x] `wedge_sessions` + `wedge_shots` in `lib/db/schema.ts`. `carry_distance` is **nullable** —
      null _is_ the mishit flag. Reuses `roundStatusEnum` (identical in_progress/complete state
      machine; a duplicate enum type would just be a second source of truth).
- [x] `0003_outstanding_wolf_cub.sql` (generated) + hand-written `0004_wedge_rls.sql` for the
      `auth.users` FK, RLS, and per-user policies (sessions owned via `user_id`, shots
      transitively via the parent session), registered in `meta/_journal.json`
- [x] Applied to the live project and **verified in the DB**: both tables present,
      `carry_distance` nullable, `relrowsecurity = true` on both, both policies active
- [x] `lib/db/wedge-queries.ts` — `loadWedgeSession`, `loadUserWedgeSessions` (2 queries total
      regardless of session count), `lastWedgeSessionParams` for prefilling setup. Points are
      always derived, never read from a stored column.

**Round-trip smoke test** (run inside a rolled-back transaction, nothing persisted): a 4-ball
session with one mishit stored and re-read correctly — mishit persisted as NULL, summary came
back `avg 88.1 pts | bias −2.3 yd | struck 3 | mishits 1 (25%)`, with the bias correctly
averaging only the three struck balls. Constraints verified to reject `min > max`, a negative
carry, and a duplicate shot number.

## Phase 3 — Navigation restructure — **done**

- [x] `components/shell/tab-bar.tsx`: middle tab is now **Wedgemaxx** (`Target` icon). The
      primary/FAB variant is gone — all three slots are now destinations rather than one being
      an action, so they render uniformly.
- [x] "Start a round" moved to a **"+" in the Feed header**, kept as a `GuardedLink` because it
      creates a server row (unlike _resuming_ a round, which works offline)
- [x] `app/(app)/wedgemaxx/page.tsx` — a real destination so the new tab can't dead-end. Lists
      sessions with a proper empty state; Phase 4 adds the setup "+" and styled cards.
- [x] Feed empty-state copy updated ("Tap + **above**") — it used to point at the tab bar

**Offline-guard behaviour preserved exactly:** every tab is still a `GuardedLink` with
`skipGuard={active}`. The one deliberate asymmetry is that the Feed "+" is _not_ skipGuarded —
starting a round needs connectivity. When on `/round/new` no tab matches, so all three guard
normally, which is correct.

**Verified:** `/wedgemaxx` redirects to `/login` when signed out (route exists and is
auth-protected, not a 404), no console errors, build registers the route.
**Not verified:** the authenticated tab bar itself — no test-account credentials this session.

Also fixed a rebrand loose end: the login tagline still read "track your strokes gained".

## Phase 4 — Session feed + setup — **done** (plus the core entry loop)

- [x] `app/(app)/wedgemaxx/page.tsx` — sessions newest-first, in-progress pinned as "Continue",
      matching `FeedCard`'s treatment; "+" in the header (guarded — creating a session needs the
      server)
- [x] `components/wedge/session-card.tsx` — date, balls, avg points, bias, mishits, duration
- [x] Setup screen with ball count / min / max, **defaults remembered from the last session**
- [x] `app/wedgemaxx/actions.ts` — create / save / finish / delete
- [x] **Entry loop built early** (`app/wedgemaxx/[id]/page.tsx` +
      `components/wedge/wedge-session.tsx`): autofocused carry input, Mishit button, live shot
      list, running average. Pulled forward from Phase 5 because the "+" would otherwise create a
      session and land on a 404. Finish redirects to the list (Phase 6 will point it at a summary).

### Scoring retune + keypad, after the first real range use

Two things the user hit immediately that only real use surfaces:

- **Breaking 100 was far too easy** (they averaged 114.8). The scratch anchor was too generous, so
  the reference moved to **PGA Tour average** (`REFERENCE_DISPERSION_MULTIPLIER` 1.5 → 1). Because
  points are derived and never stored, every historical session re-scored automatically — a
  completed session went 86.0 → 79.2 with no migration.
- **The OS keyboard was the wrong input.** It shifted the viewport so the target yardage was cut
  off, and stayed open across balls so the next target was invisible. Replaced with the
  always-visible `NumericKeypad` already used by round tracking.

**Two real bugs found by verifying in the browser — neither caught by tsc or eslint:**

1. **`"use server"` files may only export async functions.** `actions.ts` exported `MIN_BALLS`,
   `MAX_BALLS` and a synchronous `validateSessionParams`, which broke the whole route at runtime
   (blank page). Moved to `lib/wedge/session-params.ts`, which also lets the client form and the
   server action share one definition of "valid".
2. **The entry dock floated mid-screen instead of pinning to the bottom.** `min-h-full` resolves
   to `min-height: 100%`, but `body`'s `height` property is `auto` (it only sets `min-height`), and
   percentage heights only resolve against a _definite_ parent height — so the container collapsed
   to content height (330px in an 812px viewport) and `flex-1` had nothing to distribute. Fixed
   with `min-h-dvh`. **Note:** `components/round/round-session.tsx` has the same `min-h-full` and
   the same latent bug; it just isn't visible because a round's content fills the screen. Left
   alone deliberately rather than touching working code mid-phase.

**Verified end to end in the browser** on a 3-ball session: targets random and never repeating,
`87→82 (−5) = 91 pts`, a mishit scoring 41, an exact carry scoring **126 (no hole-out cliff)`,
session average 86.0, finish redirecting to the list, and the card showing `bias −2.5 yd short`with the mishit correctly excluded. Confirmed against the DB: status`complete`, shots in order,
**mishit persisted as NULL**.

## Phase 5 — Session screen (remaining pieces)

- [x] `app/wedgemaxx/[id]/page.tsx` + `components/wedge/wedge-session.tsx` (done in Phase 4)
- [x] "Ball X of N", large target yardage (done in Phase 4)
- [x] Carry input **autofocused**; submit → score → next ball (done in Phase 4)
- [x] **Mishit** button beside the input (done in Phase 4)
- [x] Previous shots as rows, newest first (done in Phase 4)
- [x] **Elapsed timer** — counts active seconds only: advances by real wall-clock deltas (a
      throttled background interval would otherwise under-count) and stops entirely while the tab
      is hidden, so backgrounding the app at the range doesn't inflate the duration. Persisted
      with every save/finish and shown on the summary + list card.
- [x] **Tap a row to edit** a mistyped carry — the target display switches to that ball, the
      keypad prefills its carry, and the dock offers Cancel / Mishit / Save. Points recompute.
- [x] **⋯ menu**: **End session** (finish early, confirms and scores over the balls actually hit)
      and **Discard session** (confirms, offline-guarded — it's a real server delete)
- [x] **Pending target is now stable across reloads.** The whole yardage sequence is rolled once
      at session creation and stored on `wedge_sessions.targets` (migration `0005`, applied to
      prod). Previously it lived only in client state, so a refresh — or the force-quit/relaunch
      that offline testing depends on — handed back a different number, which was also mildly
      exploitable. Stored as a list rather than derived from a seed so the yardages can't shift
      if the RNG changes. Sessions created before the column fall back to the old
      roll-one-at-a-time path, so nothing in flight broke.

      Verified: generated sequences are whole yards in range with no adjacent repeats, and the
          `integer[]` roundtrips through Drizzle identically (as numbers, not strings).

**Known limitation:** elapsed time is only persisted when a ball is logged or the session
finishes. Exiting via the X without logging anything loses the seconds since the last save.

**Not visually verified** — the browser session's auth cookie went stale partway through and I
can't sign in myself. typecheck / lint / build / 82 tests are green, and the layout fix below was
verified against the real compiled CSS, but the timer, row-editing and ⋯ menu need a click-through.

- [ ] **⋯ menu**: **End session** (finish early, score over shots taken) and **Discard session**
      (delete, with `ConfirmDialog`) — reuse the round-session patterns, including the
      offline guard on Discard (it's a real server mutation)
- [ ] Debounced autosave, same shape as the round session

## Phase 6 — Summary — **done**

- [x] `app/wedgemaxx/[id]/summary/page.tsx` + `components/wedge/session-summary.tsx` — hero
      average points, bias / spread / mishit-rate stats, a plain-English read on the bias, an
      every-ball table (points ≥100 highlighted), and Delete session (offline-guarded)
- [x] Routing wired so a finished session actually opens it: the session-list card links to
      `/summary` when complete, `finishWedgeSession` redirects there, and `/wedgemaxx/[id]`
      redirects complete sessions there instead of bouncing to the list
- [ ] Optional stretch: per-distance-bucket breakdown (short/mid/long), mirroring Advanced Stats

## Phase 7 — Offline

- [ ] Dexie **version 2** migration adding `wedgeDrafts` — must not disturb existing
      `roundDrafts` data (see the note in `lib/offline/db.ts` about not orphaning local drafts)
- [ ] `lib/offline/wedge-sync.ts` mirroring `round-sync.ts`; wire `flushAllDrafts` to cover both
- [ ] Verify on a real phone: full offline session, offline End Session, force-quit + relaunch
      recovery — the exact scenarios that surfaced real bugs in Milestone 10/11

## Phase 8 — Profile

- [ ] Wedgemaxx block on `app/(app)/profile/page.tsx`: sessions completed, career average points,
      best session

## Acceptance criteria

- [ ] A scratch-level distance-control simulation averages ~100 at 50, 90, and 140 yards.
- [ ] Points are monotonic in error, never negative, and have no cliff at an exact carry.
- [ ] A session survives going offline mid-way, and syncs on reconnect.
- [ ] Editing an earlier shot recomputes the session average correctly.
- [ ] Ending early scores only the balls actually hit.
- [ ] Wedgemaxx data is per-user isolated (RLS verified, not just app-level scoping).

## Notes

- The engine must stay pure so it runs identically offline and server-side — the same discipline
  that made `lib/sg/` easy to trust and test.
- Points are **always derived**, never stored, so retuning `POINTS_PER_STROKE` or the calibration
  re-scores history consistently.
