# 15 — Puttmaxx (practice-green putting training)

**Status:** Phases 1–4 done (engine, analytics, schema, navigation + setup). 5–8 pending.
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

- [x] Miss map (3×3 counts + percentages), make %, putt distribution, average comeback distance
- [x] **Every figure declares its population** — make % and the miss map over _first putts_ (so
      sessions stay comparable), bias over _all putts_ (where the sample-size win is). Comebacks
      are short and conditional on a miss, so pooling them silently would inflate make % and
      shrink the average miss.
- [x] Distance-band breakdown, reusing the `distanceBreakdown` shape from `lib/wedge/`
- [x] Misread tallies, line and speed held separate
- [x] **`detectBias(misses)` with a significance gate** — returns a direction _and_ whether the
      sample supports calling it. With 10 misses, 6–4 is noise; reporting it as a bias would send
      the user to fix a problem they don't have. Below threshold the gauge renders
      "not enough data yet".
- [x] Tests, including explicitly that a 6–4 split at n=10 is **not** reported as a bias and that a
      lopsided split at a healthy n **is**.

**Verified on simulated players** (18 putts, 5–12 ft, seeded):

| Simulated fault   | Direction gauge      | Read gauge             |
| ----------------- | -------------------- | ---------------------- |
| None              | 9–13 _(not called)_  | 3–4 _(not called)_     |
| **Under-reads**   | 10–12 _(not called)_ | **0–7 → LOW, p=0.016** |
| **Pulls it left** | 15–7 _(not called)_  | 4–3 _(not called)_     |

Row 2 is the design working: the fault lands on the right gauge and the wrong gauge stays quiet.
Row 1 shows the gate holding — a clean player is told nothing.

**Row 3 was the useful surprise.** A player pulling _every_ first putt wasn't called, because the
simulated comeback misses were random and diluted the pooled sample. That's the opposite of the
argument for pooling comebacks (that a 3 ft putt barely breaks, so it isolates face angle). The
counter-argument is equally plausible: misses from 3 ft are rare and idiosyncratic — lip-outs,
carelessness — and therefore closer to noise.

Simulation can't settle it, because the answer depends on how a real player actually putts. So
`firstPuttDirectionBias` is computed alongside the pooled one. If they agree, pooling is safe and
the extra sample is free; if they persistently disagree, comebacks are diluting and the headline
should switch. Real sessions get to decide.

## Phase 3 — Schema

- [x] `putt_sessions` + `putt_attempts` in `lib/db/schema.ts` (shapes in the design plan). Reuse
      `roundStatusEnum`. New enums for elevation, break, speed error, line error.
- [x] Pre-rolled `putts jsonb not null default '[]'` — same reasoning as Wedgemaxx `targets`.
- [x] Generated migration + hand-written RLS migration (FK to `auth.users`, per-user policies,
      attempts owned transitively via the session) registered in `meta/_journal.json`.
- [x] Apply to the live project and **verify in the DB**: tables present, `relrowsecurity = true`,
      policies active.
- [x] `lib/db/putt-queries.ts` — load one session, load all for a user (bounded query count),
      last-session params for prefilling setup.

**Migrations:** `0006_big_sleepwalker.sql` (generated) + hand-written `0007_putt_rls.sql`,
registered in `meta/_journal.json`. Applied to the live project.

**Verified in the DB**, not just from the migration's success message: both tables present with
`relrowsecurity = true`, both policies active, the `auth.users` FK present, and all four check
constraints on `putt_attempts`.

**Constraints verified to bite, each in its own savepoint:**

| Rejected                        | By                                      |
| ------------------------------- | --------------------------------------- |
| made putt carrying a line error | `putt_attempts_made_consistency_check`  |
| miss with no error recorded     | `putt_attempts_made_consistency_check`  |
| made putt carrying a comeback   | `putt_attempts_comeback_presence_check` |
| duplicate putt number           | `putt_attempts_session_putt_number_key` |
| negative comeback distance      | `putt_attempts_comeback_distance_check` |
| min > max distance              | `putt_sessions_distance_check`          |
| putt count of zero              | `putt_sessions_count_check`             |

Savepoints matter here: the first run looked like a clean sweep, but the opening failure had
aborted the transaction, so every later "rejection" was Postgres refusing an aborted command
rather than a constraint firing. Only one of the seven was actually proven. The rerun isolates each
check and names the constraint that caught it, and asserts a **valid** miss is still accepted — so
the checks can't be passing by rejecting everything.

The `made ⇔ no error` invariant is now enforced in the database, not just documented on the type,
which is what lets the analytics trust it rather than defend against contradictory rows.

**`parsePutts` lives in `lib/putt/parse.ts`, not the query layer.** `jsonb` guarantees valid JSON
and nothing about shape, so the boundary needs a real parser — and it needs tests, which
`lib/db/putt-queries.ts` can't have because `server-only` won't load under vitest. Same lesson, and
the same fix, as `parseHandicapSnapshot` in `lib/baseline.ts`. A malformed entry drops rather than
failing the whole sequence: one corrupt putt shouldn't cost the player the other seventeen.

## Phase 4 — Navigation + session feed + setup

- [x] Fourth tab in `components/shell/tab-bar.tsx`
- [x] `/puttmaxx` list: sessions newest-first, in-progress pinned as "Continue", empty state
- [x] Setup screen: putt count, distance range, "call slope & break" toggle, defaults remembered
- [x] Creating a session is server-backed, so the "+" stays a `GuardedLink`, and `/puttmaxx/new`
      goes in `lib/offline/routes.ts` as blocked offline

**Deviation — `call_slope_break` and `express_mode` dropped from v1.** Both appear in the design
plan's data model, and neither was built. The slope/break toggle was my own idea to soften the
friction of hunting for a matching putt on a limited practice green, not something asked for — and
the user explicitly chose distance + slope + break. Express mode was marked optional from the
start. Building settings nobody has asked for ahead of using the thing is how a setup screen turns
into a control panel; both are a defaulted nullable column and a checkbox away if real sessions
show they're wanted.

**The setup screen states the consequence of the range**, since it's the one setting that changes
what a session can tell you: _"A Tour pro holes about 77% from 5 ft and 32% from 12 ft."_ Going too
short adds "nearly all makes, which leaves too few misses to read a tendency from"; past ~15 ft it
warns the drill becomes lag putting. Both verified live at 3–25 ft.

**Verified in the browser:** four tabs fit without wrapping at phone width; a created session
stored 18 pre-rolled putts balanced exactly `{l2r: 6, r2l: 6, straight: 6}` and
`{uphill: 6, downhill: 6, flat: 6}`, all in range with no back-to-back repeats; the card reads
`0/18 putts · 5–12 ft · Continue`.

**Offline, against a production build with the server stopped:** the Puttmaxx tab loads from cache,
and **+ is blocked by the modal even though `/puttmaxx/new` was cached** by an earlier direct
visit. That's the blocked-route list doing its job — being cached answers _can_ we render it, not
_should_ we go there.

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
