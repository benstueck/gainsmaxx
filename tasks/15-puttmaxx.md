# 15 — Puttmaxx (practice-green putting training)

**Status:** Phase 1 done (engine, generator, params — 34 tests). Phases 2–8 pending.
**Depends on:** 05 (SG engine), 10 (offline infra), 13 (Wedgemaxx patterns to copy)
**Design:** [`../plans/03-puttmaxx.md`](../plans/03-puttmaxx.md) — read first.

## Decisions confirmed with the user

| Question     | Decision                                                                                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope        | **Practice green only** — tracking putts in a real round is out                                                                                                  |
| Putt spec    | **Distance + elevation + break** ("8 ft, uphill, left-to-right")                                                                                                 |
| Distances    | **Random, default 5–12 ft**, customizable at setup like Wedgemaxx                                                                                                |
| Missed putts | Log the miss, the **comeback distance**, then the comeback on the **same 3×3** — it's a putt, so it's a data point. Its break is derived if needed, never stored |
| Navigation   | **Four tabs** — Gainsmaxx · Wedgemaxx · Puttmaxx · Profile                                                                                                       |
| Scoring      | **Raw strokes gained** vs Tour — no invented points scale, the table gives it directly                                                                           |
| Bias model   | **Three gauges** — direction (absolute, stroke), read (high/low vs break), speed. A single absolute gauge cancels out read faults                                |
| Generator    | **Break directions balanced by construction** (shuffled deck), so a read fault can't masquerade as a stroke bias                                                 |
| Make %       | The `--%` field in The Stack's UI is unexplained; ignored                                                                                                        |

## Phase 1 — Engine (`lib/putt/`)

- [x] `generator.ts` — `nextPutt(min, max, previous, random)`: uniform whole feet, never repeating
      the previous _full spec_ (distance + elevation + break), mirroring `nextTarget`'s injectable
      `random` so tests are deterministic.
- [x] `engine.ts`: - `expectedPutts(feet)` — thin wrapper over `lib/sg`'s green table - `holeSg(attempt)` = `expectedPutts(target) − puttsTaken` - `firstPuttSg(attempt)` = `expectedPutts(target) − 1 − expectedPutts(comeback)` - `puttsTaken(attempt)` — 1 / 2 / 3, **derived, never stored**
- [x] `types.ts` — `PuttAttempt`, `PuttResult`, `PuttSessionSummary`. `speedError` and `lineError`
      are independently nullable: a pure line miss has correct speed.
- [x] `session-params.ts` — defaults and `validateSessionParams`. **Separate file**, because a
      `"use server"` module may only export async functions (the Wedgemaxx trap).
- [x] Tests: generator bounds + no-repeat, SG at known distances, 1/2/3-putt counting, and that a
      made putt yields `firstPuttSg === holeSg`.

**Verified output.** The scoring table the player will actually see:

| ft  | E[putts] | make % | made  | 2-putt | 3-putt |
| --- | -------- | ------ | ----- | ------ | ------ |
| 4   | 1.13     | 87%    | +0.13 | −0.87  | −1.87  |
| 8   | 1.50     | 50%    | +0.50 | −0.50  | −1.50  |
| 15  | 1.78     | 22%    | +0.78 | −0.22  | −1.22  |

An emergent property worth keeping: **the reward for holing rises with distance while the penalty
for two-putting falls.** Making a 15-footer is worth +0.78; two-putting from 4 ft costs −0.87. That
falls straight out of the Tour table with no tuning, and it's the right incentive — it means a
session can't be farmed by only taking easy putts.

First-putt SG behaves as designed: from 10 ft, every two-putt scores −0.39 on the hole, but the
first putt scores −0.39 leaving a tap-in and −0.89 leaving 8 ft.

A rolled 18-putt session comes out exactly `{l2r: 6, r2l: 6, straight: 6}` and
`{uphill: 6, downhill: 6, flat: 6}`, with no back-to-back distance repeats.

## Phase 2 — Analytics (`lib/putt/analytics.ts`)

- [ ] Miss map (3×3 counts + percentages), make %, putt distribution, average comeback distance
- [ ] **Every figure declares its population** — make % and the miss map over _first putts_ (so
      sessions stay comparable), bias over _all putts_ (where the sample-size win is). Comebacks
      are short and conditional on a miss, so pooling them silently would inflate make % and
      shrink the average miss.
- [ ] Distance-band breakdown, reusing the `distanceBreakdown` shape from `lib/wedge/`
- [ ] Misread tallies, line and speed held separate
- [ ] **`detectBias(misses)` with a significance gate** — returns a direction _and_ whether the
      sample supports calling it. With 10 misses, 6–4 is noise; reporting it as a bias would send
      the user to fix a problem they don't have. Below threshold the gauge renders
      "not enough data yet".
- [ ] Tests, including explicitly that a 6–4 split at n=10 is **not** reported as a bias and that a
      lopsided split at a healthy n **is**.

## Phase 3 — Schema

- [ ] `putt_sessions` + `putt_attempts` in `lib/db/schema.ts` (shapes in the design plan). Reuse
      `roundStatusEnum`. New enums for elevation, break, speed error, line error.
- [ ] Pre-rolled `putts jsonb not null default '[]'` — same reasoning as Wedgemaxx `targets`.
- [ ] Generated migration + hand-written RLS migration (FK to `auth.users`, per-user policies,
      attempts owned transitively via the session) registered in `meta/_journal.json`.
- [ ] Apply to the live project and **verify in the DB**: tables present, `relrowsecurity = true`,
      policies active.
- [ ] `lib/db/putt-queries.ts` — load one session, load all for a user (bounded query count),
      last-session params for prefilling setup.

## Phase 4 — Navigation + session feed + setup

- [ ] Fourth tab in `components/shell/tab-bar.tsx`
- [ ] `/puttmaxx` list: sessions newest-first, in-progress pinned as "Continue", empty state
- [ ] Setup screen: putt count, distance range, "call slope & break" toggle, defaults remembered
- [ ] Creating a session is server-backed, so the "+" stays a `GuardedLink`, and `/puttmaxx/new`
      goes in `lib/offline/routes.ts` as blocked offline

## Phase 5 — Entry loop

- [ ] `h-dvh` (a **definite** height — `min-h-*` does not resolve, as proven in Wedgemaxx), grid
      pinned, history scrolling independently
- [ ] The 3×3 grid, large touch targets; two independent misread toggles
- [ ] Miss follow-up: comeback distance (quick-tap buckets, not a keypad — coarse is fine since
      hole SG doesn't depend on it) then the **same 3×3** for the comeback. Same three taps a
      yes/no would have cost, roughly double the data.
- [ ] Pre-rolled `putts[index]` with a legacy fallback for sessions created before pre-rolling
- [ ] Elapsed timer counting active-only seconds (`visibilitychange`), tap-to-edit a previous putt,
      ⋯ menu with End session / Discard session
- [ ] Optional: **express mode** (made/missed only), off by default

## Phase 6 — Summary

- [ ] Total SG headline, with "0.00 = Tour average" stated inline — the baseline is the whole
      meaning of the number
- [ ] Putt distribution, make %, average comeback
- [ ] Miss map as a heatmap; the three bias gauges honouring the significance gate, each labelled
      with the fault it detects and the population it drew from — showing a bias pooled from more
      putts than the miss map is only honest if the label says so
- [ ] Misread counts; per-distance-band table
- [ ] Every-putt list, tap to correct

## Phase 7 — Offline-first

- [ ] Dexie **v3** adding `puttDrafts` (keep v1 and v2 declared so installs upgrade rather than
      reset). DB name stays `"gainsmaxxing"`.
- [ ] `lib/offline/putt-sync.ts` mirroring `wedge-sync.ts`; flush on load and on reconnect
- [ ] Local-first `attemptSave` / `attemptFinish`. **The redirect-success path must clear the
      draft** — skipping that was the Milestone 10 bug and it recurred in Wedgemaxx.
- [ ] Add `/puttmaxx` to the warmed shell routes in `lib/offline/warm-cache.ts`
- [ ] Verify on a real phone: full offline session, offline finish, force-quit + relaunch recovery

## Phase 8 — Profile

- [ ] Puttmaxx block: sessions, career SG per putt, make %, best session — **weighted per putt**,
      the same reasoning as `wedgeCareerStats` weighting per ball

## Acceptance criteria

- [ ] A made putt from 8 ft scores **+0.50** SG; a 2-putt **−0.50**; a 3-putt **−1.50**.
- [ ] Session SG of 0.00 corresponds to Tour-average putting over those distances.
- [ ] First-putt SG distinguishes a miss leaving a tap-in from one running 6 ft past.
- [ ] A 6–4 left/right split is **not** reported as a bias.
- [ ] A consistent under-read shows on the **read** gauge and leaves the **direction** gauge
      neutral — the two faults don't contaminate each other.
- [ ] A generated session has balanced break directions, so a read fault can't masquerade as a
      stroke bias.
- [ ] Comeback putts contribute to bias detection; make % and the miss map remain first-putt-only,
      and the UI says which population each number uses.
- [ ] A session survives going offline mid-way and syncs on reconnect.
- [ ] Puttmaxx data is per-user isolated (RLS verified in the DB, not just app-level scoping).
