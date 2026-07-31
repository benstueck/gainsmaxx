# 13 — Wedgemaxx (wedge distance-control training)

**Status:** Phase 1 (scoring engine) done + tested; Phases 2–8 not started
**Depends on:** 05 (SG engine), 10 (offline infra), 12 (advanced stats patterns)
**Design:** [`../plans/02-wedgemaxx.md`](../plans/02-wedgemaxx.md) — read this first, especially
the scoring derivation. Don't re-derive the calibration; it's documented there with the reasoning
and the sanity checks against published tour dispersion data.

## Decisions confirmed with the user

| Question           | Decision                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| End-position model | Proximity floored at **1 yd** (no hole-outs); putt in feet within 30 yd, **fairway in yards beyond 30 yd**              |
| Score anchor       | **Scratch = 100 points at every target distance** (`σ_scratch = 1.5 × σ_tour`), calibrated on `E[sgRaw]`, 50 pts/stroke |
| Timer              | **Informational only** — pauses when you back out, stored, shown on summary + feed card                                 |
| Offline            | **Full offline support now** — reuse the existing Dexie draft-queue pattern; gotchas are known                          |
| Editing shots      | **Tap any previous row to edit** a mistyped carry; points recompute                                                     |
| Target generation  | Uniform random **whole yards**, **never repeating the immediately-preceding target**                                    |
| Profile stats      | **Yes** — Wedgemaxx block: sessions completed, career average points, best session                                      |

## Phase 1 — Scoring engine (`lib/wedge/`) — **done**

- [x] `lib/wedge/engine.ts`, pure (only imports the equally-pure `lib/sg`):
      `tourProximityYd`, `tourSigmaYd`, `tourDistanceErrorYd`, `wedgeShotSg`, `referenceSg`,
      `wedgeShotPoints`, `scoreShot`, `sessionSummary`, plus `nextTarget` (uniform whole yards,
      never repeating the previous target; takes an injectable `random` so tests are
      deterministic). `BASE_POINTS = 100` and `POINTS_PER_STROKE = 50` are named constants.
- [x] `lib/wedge/types.ts` + `lib/wedge/index.ts` public API, mirroring `lib/sg/`
- [x] 25 tests in `lib/wedge/engine.test.ts`, all green

**Deviation from plan:** `referenceSg` memoizes per whole yard rather than interpolating a coarse
grid — targets are always integers, and the whole suite (including ~60k simulated shots) runs in
80 ms, so the extra machinery wasn't warranted.

**Verified live output** (matches the plan's projections exactly):

| Miss  | 50 yd | 90 yd | 140 yd |
| ----- | ----- | ----- | ------ |
| 0 yd  | 123   | 128   | 135    |
| 5 yd  | 86    | 91    | 98     |
| 10 yd | 76    | 81    | 88     |
| 20 yd | 64    | 69    | 77     |
| 40 yd | 45    | 50    | 57     |

Derived tour distance error: 2.4 yd @50 → 5.0 yd @140. Scratch simulation averages 100.0 at 50,
90 and 140 (asserted in tests, seeded PRNG so it can't flake).

## Phase 2 — Schema

- [ ] `wedge_sessions` + `wedge_shots` in `lib/db/schema.ts` (columns per the design plan)
- [ ] `npm run db:generate`, then a companion **hand-written SQL migration** for RLS + per-user
      policies — Drizzle doesn't model RLS, same as `0001_supabase_rls.sql`
- [ ] Apply to the live project (`npm run db:migrate`) — **confirm with the user first**, it's the
      production database with real accounts
- [ ] `lib/db/wedge-queries.ts` — load sessions for the feed and a single session, recomputing
      points from stored `target`/`carry` (never store derived points)

## Phase 3 — Navigation restructure

- [ ] `components/shell/tab-bar.tsx`: middle tab becomes **Wedgemaxx**; keep Feed and Profile
- [ ] Move "start a round" to a **"+" in the Feed header** (top right)
- [ ] Route the new tab through `GuardedLink` consistently with the existing offline rules —
      the Wedgemaxx tab itself is a normal guarded navigation; **starting a new session** needs
      connectivity like starting a round does

## Phase 4 — Session feed + setup

- [ ] `app/(app)/wedgemaxx/page.tsx` — sessions newest-first, in-progress pinned as "Continue"
      with the same visual treatment as `FeedCard`
- [ ] `components/wedge/session-card.tsx` — date, balls, avg points, duration
- [ ] Setup screen: ball count (40), min (50), max (140), all editable, **defaults remembered
      from the last session**; validate `min < max`

## Phase 5 — Session screen (the core loop)

- [ ] `app/wedgemaxx/[id]/page.tsx` + `components/wedge/wedge-session.tsx`
- [ ] Elapsed timer (pauses on leave), "Ball X of N", large target yardage
- [ ] Carry input **autofocused with the keyboard up**; submit → score → next ball
- [ ] Previous shots as rows (target, carry, signed delta, proximity, points), **tap to edit**
- [ ] **⋯ menu**: **End session** (finish early, score over shots taken) and **Discard session**
      (delete, with `ConfirmDialog`) — reuse the round-session patterns, including the
      offline guard on Discard (it's a real server mutation)
- [ ] Debounced autosave, same shape as the round session

## Phase 6 — Summary

- [ ] `app/wedgemaxx/[id]/summary/page.tsx` — hero average points, balls, duration, best/worst,
      **average signed bias**
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
