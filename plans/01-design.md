# Design Plan — Strokes Gained Golf Tracker

> First design plan for the project. Canonical source of the app's intent and scope.
> Companion task checklists live in [`../tasks/`](../tasks/).

## Context

The user is a golfer who wants to track **strokes gained (SG)** shot-by-shot during a
round, on their phone, and analyze it afterward. Signal on courses is unreliable, so
on-course entry must work fully offline. The user will supply the raw PGA-Tour-derived
SG reference data (with per-handicap adjustments) later; the SG engine and data pipeline
are built to a documented schema and validated against a small synthetic fixture until
the real data lands.

Goal of MVP: reliably capture every shot of a round offline, compute accurate SG per
shot/category/round against a handicap-appropriate baseline, and show a per-round
breakdown. Build as a real multi-user app (accounts, per-user data isolation) but
optimized around the user as the primary user first.

## Decisions locked (from Q&A)

| Area              | Decision                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Offline           | **Offline-first PWA** — full round entry with zero signal; local store + sync                                                                                                                                |
| Shot input        | **Manual entry** — per shot: start lie + yardage, end lie + yardage, penalty/OB flags. No GPS.                                                                                                               |
| Round setup       | Start round → choose **9 or 18**; per hole → select **Par**; then log shots                                                                                                                                  |
| Stack             | **Supabase** (Postgres + Auth + RLS)                                                                                                                                                                         |
| Baseline          | **Per-user handicap**, set in NUX + editable in Settings. Raw data has levels **0/5/10/15/20/25 + Tour**; interpolate for handicaps in between. Per-round **baseline toggle** = dropdown of those 7 options. |
| "Adjust tracking" | **Edit past shots/rounds** (SG recalculated on save)                                                                                                                                                         |
| MVP analytics     | **Per-round breakdown** only (OTT/APP/ARG/Putting + Total). Trends / strengths / shot-review = later plan.                                                                                                   |
| Audience          | **Personal tool first** — real accounts, DB, RLS; heavier onboarding/social deferred.                                                                                                                        |

## Strokes Gained model (engine spec)

Per-shot value, classified by the shot's **starting** position:

> **SG(shot) = Exp(startLie, startDist, baseline) − Exp(endLie, endDist, baseline) − 1 − penaltyStrokes**

- `Exp(...)` = expected strokes to hole out. `Exp(end) = 0` when holed.
- **Categories:** OTT (tee shot on par 4/5), APP (par-3 tee shot + any non-tee shot > 30 yd from green edge),
  ARG (non-putt within 30 yd of green edge), Putting (on green, distance in **feet**).
  Derived: Tee-to-Green = OTT+APP+ARG; Total = all four.
- **Interpolation:** distance between benchmark rows → linear interpolate. Handicap between
  bracket levels (e.g. 12 → blend 10 & 15) → compute `Exp` from each bracketing table and
  linearly interpolate by handicap.
- **Chaining/validation:** shot N's end (lie + distance) auto-prefills shot N+1's start;
  warn on mismatch. Sum of a hole's shot SG = holeBenchmark(tee) − actualScore.
- **Penalty / OB (confirmed).** A single shot entry carries a flag that sets `penaltyStrokes`,
  and the formula above absorbs the cost. The two flags differ in what `end` means:
  - **Penalty** (water / lateral drop) → `penaltyStrokes = 1`. `end` = the **drop spot** (where
    the _next_ entry is played from; the re-hit is a separate entry).
    _Ex: 2nd shot from 178 fw into a lake, drop, next from 50 rough →_ one entry
    `Fairway 178 → Rough 50, Penalty`; `SG = Exp(fw,178) − Exp(rough,50) − 1 − 1` (2 strokes consumed).
  - **OOB** (stroke-and-distance) → `penaltyStrokes = 2`, and `end` = **where the re-hit shot
    finished** (the entry bundles the OB stroke + penalty + successful replay).
    _Ex: tee shot from 500 goes OB, re-tee lands 200 fw →_ one entry
    `Tee 500 → Fairway 200, OOB`; `SG = Exp(tee,500) − Exp(fw,200) − 1 − 2` (3 strokes consumed).

Engine lives in a pure, dependency-free TS module (`lib/sg/`) so it runs identically
client-side (offline) and server-side (authoritative recompute). Fully unit-tested.

## Architecture / stack

- **Next.js 15 (App Router) + TypeScript + React 19**; server actions for mutations.
- **Tailwind CSS + shadcn/ui**, mobile-first (thumb-reachable shot entry, large tap targets).
- **Supabase**: Postgres, Auth (email/password + optionally Google OAuth), **RLS** so a user
  only sees their own rows.
- **Drizzle ORM** as schema + migration source of truth against Supabase Postgres; RLS
  policies defined alongside as defense-in-depth.
- **Offline-first:** `Serwist` service worker (PWA manifest, installable, cached app shell +
  benchmark JSON) + **Dexie (IndexedDB)** local store for rounds/shots. A sync layer queues
  local mutations and pushes on reconnect; last-write-wins keyed by a client-generated
  `client_uuid` + `updated_at` (conflicts rare in a single-user tool).
- **Deploy:** Vercel + Supabase cloud.

## Data model (Postgres, via Drizzle)

- `profiles` (1:1 with `auth.users`): `handicap` (numeric), `units` (yd/ft default; m later),
  `default_baseline`, timestamps.
- `rounds`: `user_id`, `client_uuid`, `played_at`, `num_holes` (9/18), `course_name` (optional),
  `baseline_snapshot` (handicap at play time), `status` (in_progress/complete), timestamps.
- `holes`: `round_id`, `hole_number`, `par`.
- `shots`: `hole_id`, `shot_number`, `start_lie`, `start_distance`, `end_lie`, `end_distance`,
  `distance_unit`, `penalty_strokes`, `is_ob`, `is_holed`, `sg_category` (derived),
  `sg_value` (computed, recomputable), timestamps.
- **Reference data** = versioned static JSON in `/data/benchmarks/` (read-only, cached by SW
  for offline). Not a hot DB table. An ingestion script transforms the user's raw file into
  this normalized JSON.

## App UX & information architecture

**Design constraints (on-course, one-handed, in sunlight, often walking):**

- **Light mode only.** High-contrast: near-black text on white, bold color accents; avoid
  low-contrast grays that wash out in sun. No dark theme.
- **Big targets everywhere** — primary touch targets ≥ 64px, generous spacing, thumb-zone
  (bottom) placement for the actions used repeatedly. Forgiving hit areas; clear pressed states.
- **Entry is the product.** Optimize the shot loop for the fewest, most reliable taps.

**Unauthenticated:** sign up / sign in only.

**Authenticated shell — a 3-tab bottom bar:**

1. **Feed (left)** — rounds newest-first. Each card: date, optional course, 9/18, total score,
   **Total SG** vs the user's baseline (small category mini-bars OTT/APP/ARG/P). Any
   **in-progress round pinned at top as "Continue round."** Tap a card → round summary.
2. **"+" (center)** — starts a new round → immediately enters the tracking session.
3. **Profile (right)** — lightweight high-level stats (rounds played, career avg Total SG and
   per-category averages), then settings (handicap, username, email, change password, units,
   default baseline) and **log out**.

**NUX (first sign-in):** set handicap + units, then land on the Feed.

## Shot-entry design (the core loop)

Guiding principle: **the only thing a user should routinely enter is where the ball ended up.**
Everything else is prefilled or defaulted.

**Start a round →** pick **9 or 18** (+ optional course name) → go straight to Hole 1.

**Per hole:**

- Header shows **Hole X of N** + a big **Par 3 / 4 / 5** selector (three large buttons).
- **Shot 1 start is pre-set to `Tee`**; the user enters the hole length as shot 1's start
  yardage (once). Every later shot's **start auto-carries from the previous shot's end**, so it
  is never re-entered.
- A running shot list (each row: `startLie dist → endLie dist`, plus its SG once data exists),
  with running score + running hole SG at top.

**Entering one shot (the repeated action) — target ~3–4 taps:**

1. **End lie** — a row of big buttons: `Fairway · Rough · Sand · Recovery · Green`. Picking
   **Green** switches the distance unit to **feet** and puts the hole into putting mode.
2. **End distance** — a **large custom numeric keypad** in the thumb zone (not the OS keyboard),
   with a big confirm. (Keypad over stepper because full-shot yardages span 1–550.)
3. Optional **Penalty** / **OOB** toggle on the same sheet (semantics per the SG model above).
4. A prominent **"Holed"** button ends the shot as holed (end = in the hole) and closes the hole —
   available for putts _and_ chip-ins from any lie.

**Putting sub-mode:** once a shot ends on the Green, subsequent shots are putts — entry collapses
to feet-only distance + **Holed**, start carried each time. Approach shots that finish on the green
capture their end distance directly in **feet**.

**Safety / speed affordances:**

- **Undo last shot** always one tap away; every shot row is tappable to **edit** (SG recomputes).
- **Auto-advance** focus: lie → distance → ready for next; **Next hole** resets to Tee.
- Sensible prefills so the common case (fairway/rough → number) is fastest.

## Screens

1. **Auth** — sign up / sign in.
2. **NUX** — handicap + units.
3. **Feed tab** — rounds list + continue-in-progress.
4. **New round** — 9/18 + optional course name (from "+" tab).
5. **Tracking session (per hole)** — par selector, running shot list + running SG, shot-entry
   sheet as specified above.
6. **Round summary** — per-category SG + Total, hole-by-hole score, **baseline toggle** dropdown.
7. **Profile tab** — high-level stats + settings + logout.
8. **Edit round/shots** — reuse entry UI on a saved round; recompute SG on save.

## Reference data the user will supply (target format)

The engine expects, per baseline level (`0,5,10,15,20,25,tour`):

- **Long game:** `(lie ∈ {tee,fairway,rough,sand,recovery}, distanceYd) → expectedStrokes`
- **Putting:** `(distanceFt) → expectedStrokes` (green)

We'll finalize lie taxonomy + units against the actual raw file and write the ingestion
script to match. A synthetic fixture stands in until then.

## MVP scope vs deferred

**In:** offline round capture, SG engine + interpolation, per-round breakdown w/ baseline
toggle, edit past rounds, auth + settings, PWA install.
**Deferred (future plans):** trends over time, strengths/weaknesses by distance bucket,
shot-by-shot review UI, quick/simplified tracking modes, category override/mulligans,
social/sharing, meters, GPS, real course database.

## Milestones → [`../tasks/`](../tasks/)

Each is a task file with a checklist so sessions can resume:

1. Repo bootstrap — CLAUDE.md, `./plans/`, `./tasks/`, Next.js + TS + Tailwind + shadcn,
   **light-only** theme tokens + big-target design primitives, lint/format.
2. Supabase + Drizzle schema + migrations + RLS.
3. Auth + NUX + **3-tab app shell** (Feed / "+" / Profile).
4. SG reference-data pipeline (ingestion script, JSON format, synthetic fixture).
5. SG engine + unit tests (expectedStrokes, interpolation, categorize, per-shot/round).
6. **Tracking session + shot-entry UX** (par selector, prefill/auto-carry, custom numeric
   keypad, lie buttons, putting sub-mode, Holed, Undo, edit) — the highest-care milestone.
7. Round summary + baseline toggle + per-round breakdown.
8. Feed cards + continue-in-progress; edit past rounds/shots (recompute).
9. Profile high-level stats + settings.
10. Offline-first (PWA/SW manifest, Dexie store, sync engine, cached benchmarks).
11. QA + deploy to Vercel.

## Verification

- **Engine:** unit tests on the synthetic fixture — known start/end pairs produce expected
  SG; category assignment correct across OTT/APP/ARG/P; distance + handicap interpolation
  correct at bracket edges and midpoints; hole SG sum = benchmark − score.
- **Offline:** DevTools offline → complete a full 18-hole round → reconnect → confirm sync to
  Supabase with no data loss; reload as installed PWA offline and confirm app shell + SG work.
- **End-to-end:** create account → NUX → play a round → summary matches a hand-computed SG on
  a small sample → edit a shot → SG recomputes → data isolated per user (RLS).
- **Mobile:** verify one-handed shot entry flow on a phone-sized viewport.
