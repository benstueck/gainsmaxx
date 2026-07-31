# 13 — Wedgemaxx (wedge distance-control training)

**Status:** Phases 1–2 (scoring engine, schema) done; Phases 3–8 not started
**Depends on:** 05 (SG engine), 10 (offline infra), 12 (advanced stats patterns)
**Design:** [`../plans/02-wedgemaxx.md`](../plans/02-wedgemaxx.md) — read this first, especially
the scoring derivation. Don't re-derive the calibration; it's documented there with the reasoning
and the sanity checks against published tour dispersion data.

## Decisions confirmed with the user

| Question           | Decision                                                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| End-position model | Proximity floored at **1 yd** (no hole-outs); putt in feet within 30 yd, **fairway in yards beyond 30 yd**                                                                          |
| Score anchor       | **Scratch = 100 points at every target distance** (`σ_scratch = 1.5 × σ_tour`), calibrated on `E[sgRaw]`, 50 pts/stroke                                                             |
| Timer              | **Informational only** — pauses when you back out, stored, shown on summary + feed card                                                                                             |
| Offline            | **Full offline support now** — reuse the existing Dexie draft-queue pattern; gotchas are known                                                                                      |
| Editing shots      | **Tap any previous row to edit** a mistyped carry; points recompute                                                                                                                 |
| Target generation  | Uniform random **whole yards**, **never repeating the immediately-preceding target**                                                                                                |
| Mishits            | One-tap **Mishit** button = zero progress = `SG −1` (~41 pts). Counts as a ball, excluded from bias/spread, tracked as its own mishit rate. `carry_distance = null` **is** the flag |
| Profile stats      | **Yes** — Wedgemaxx block: sessions completed, career average points, best session                                                                                                  |

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
- [ ] **Mishit** button beside the input — one tap, no number needed, advances to the next ball
- [ ] Previous shots as rows (target, carry, signed delta, proximity, points), **tap to edit**
- [ ] **⋯ menu**: **End session** (finish early, score over shots taken) and **Discard session**
      (delete, with `ConfirmDialog`) — reuse the round-session patterns, including the
      offline guard on Discard (it's a real server mutation)
- [ ] Debounced autosave, same shape as the round session

## Phase 6 — Summary

- [ ] `app/wedgemaxx/[id]/summary/page.tsx` — hero average points, balls, duration, best/worst,
      **average signed bias**, **mishit rate**
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
