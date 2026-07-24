# CLAUDE.md — Gainsmaxxing (Strokes Gained Golf Tracker)

Guidance for Claude Code (and humans) working in this repo. Keep this file current as the
project evolves — it's the fast path back into context at the start of a session.

## What this is

A **mobile-first, offline-first PWA** for tracking **strokes gained (SG)** shot-by-shot during
a golf round, with per-user accounts and a per-round SG breakdown. Built around one primary
user for now, but as a real multi-user app (accounts + per-user data isolation).

- Full design intent & scope: [`plans/01-design.md`](plans/01-design.md).
- Resumable task checklists: [`tasks/`](tasks/) (start at [`tasks/README.md`](tasks/README.md)).

## Status

**Milestones 1–2 landed (in code).** Next.js 16 app is scaffolded (light-only design system,
`BigButton`, Vitest, lint/build all green) and the Supabase data layer is written — Drizzle
schema, migrations (`lib/db/migrations/`, incl. RLS + policies + profile trigger), DB client,
and `@supabase/ssr` helpers + `proxy.ts`. **Supabase project is live and migrated** — tables,
RLS + per-user policies, and the signup trigger verified in the DB. Auth uses the new
`sb_publishable_…` key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). `.env.local` has URL + publishable
key + `DATABASE_URL` (pooler) + `DIRECT_URL`.

**Milestone 3 done (verified end-to-end):** email/password auth (server actions +
`/auth/confirm`), route protection via `(app)/layout.tsx` + `proxy.ts`, NUX (handicap) writing
`profiles`, and the 3-tab shell (Rounds / "+" / Profile). Email confirmation is **disabled** in
the Supabase project, so signup flows straight through to NUX (verified end-to-end).
**Milestone 5 done:** the pure SG engine lives in `lib/sg/` (`expectedStrokes`, `interpolate`,
`categorize`, `strokesGainedForShot`, `holeStrokesGained`, `handicapAdjustment`,
`roundStrokesGained`) with 20 Vitest tests green against the real benchmark data. Per-shot SG is
vs Tour; handicap baselines are applied at the round level. Public API: `import { … } from "@/lib/sg"`.
Next up: Milestone 6 (tracking session + shot entry). See `tasks/`.

**Reference data has landed.** Raw CSVs live in [`data/reference/`](data/reference/); the
normalized, ingestible JSON is [`data/benchmarks/v1/benchmarks.json`](data/benchmarks/v1/benchmarks.json)
(regenerate via `node scripts/ingest-benchmarks.mjs`). See
[`data/benchmarks/README.md`](data/benchmarks/README.md) for format, semantics, and three
open source-data anomalies awaiting user confirmation.

## Strokes Gained — domain model (read before touching `lib/sg/`)

Per-shot value, classified by the shot's **starting** position:

```
SG(shot) = Exp(startLie, startDist, baseline) − Exp(endLie, endDist, baseline) − 1 − penaltyStrokes
```

- `Exp(...)` = expected strokes to hole out from a lie + distance, for a baseline. `Exp(end)=0` when holed.
- **Categories** (by starting position):
  - **OTT** — tee shot on a par 4/5.
  - **APP** — par-3 tee shot, or any non-tee shot **> 30 yd** from the green edge.
  - **ARG** — any non-putt **within 30 yd** of the green edge.
  - **Putting** — on the green (distance measured in **feet**).
  - Derived: **Tee-to-Green = OTT+APP+ARG**, **Total = all four**.
- **Lies:** `tee, fairway, rough, sand, recovery, green` (finalize against the real data file).
- **Units:** full shots in **yards**, putts in **feet**. Meters deferred.
- **Baselines (round-level adjustment model — matches the actual data).** There is **one**
  per-shot expected-strokes table (**Tour**); per-shot SG is always computed vs Tour. Handicap
  levels `0/5/10/15/20/25` are **round-level category adjustments** (strokes lost per 18 vs Tour)
  that get **added back** to the aggregated per-category/total SG:
  `SG_vs_H(cat) = SG_vs_tour(cat) + adjustment_H(cat)`.
  - Interpolate `adjustment_H` between bracketing levels (e.g. 12 → blend 10 & 15); ×0.5 for 9 holes.
  - Long-game/putting distances are **linearly interpolated** between benchmark points, clamped at ends.
  - Round-summary **baseline toggle** = Tour + the 6 handicap levels. **Live per-shot SG is vs Tour**
    (handicap adjustment is only defined at the round/category level).
  - Full details: [`data/benchmarks/README.md`](data/benchmarks/README.md).
- **Penalty / OB** (one shot entry per event; the formula absorbs the cost):
  - **Penalty** (water/lateral) → `penaltyStrokes = 1`, `end` = the drop spot (re-hit is a separate entry).
  - **OOB** (stroke-and-distance) → `penaltyStrokes = 2`, `end` = where the re-hit finished (entry bundles OB + penalty + replay).
- **Invariant:** for a hole, `sum(shot SG) == holeBenchmark(from tee) − actualScore`. Use this in tests.

The engine (`lib/sg/`) must be **pure and dependency-free** so it runs identically on the client
(offline) and server (authoritative recompute).

## Stack

- **Next.js 16 (App Router) + TypeScript + React 19**, server actions for mutations.
  (Note: Next 16 renamed the `middleware` convention to `proxy` — session refresh lives in `proxy.ts`.)
- **Tailwind CSS + shadcn/ui**, mobile-first. **Light mode only** (on-course, sunlight).
- **Supabase** — Postgres + Auth (email/password, optional Google) + **RLS** (per-user isolation).
- **Drizzle ORM** — schema + migration source of truth; RLS policies alongside as defense-in-depth.
- **Offline-first** — `Serwist` service worker (PWA/installable, cached shell + benchmark JSON)
  - **Dexie (IndexedDB)** local store; a sync layer queues local mutations and pushes on
    reconnect (last-write-wins keyed by `client_uuid` + `updated_at`).
- **Deploy** — Vercel + Supabase cloud.

## Data model (Postgres via Drizzle)

`profiles` (1:1 with `auth.users`), `rounds`, `holes`, `shots`. Reference SG data is versioned
static JSON in `data/benchmarks/` (not a hot table). See `plans/01-design.md` for columns.

## UX principles (the entry loop is the product)

- **Only routinely enter where the ball ended up** — start position auto-carries from the
  previous shot's end. Target **~3–4 taps per shot**.
- **≥ 64px touch targets**, thumb-zone placement, a **custom numeric keypad** (not the OS one)
  for distances, big **lie buttons**, a **putting sub-mode** (feet-only + Holed), always-available
  **Undo**, and tap-any-row-to-edit.
- Authenticated shell = **3-tab bottom bar**: Feed (rounds) / "+" (new round) / Profile.

## Repo layout (target, as it gets built)

```
app/            Next.js App Router routes (auth, feed, round session, profile)
components/      UI (shadcn-based, light-only design primitives)
lib/sg/          Pure SG engine (expected strokes, interpolation, categorize, per-shot/round)
lib/db/          Drizzle schema, client, queries
lib/offline/     Dexie store + sync layer
data/benchmarks/ Versioned SG reference JSON (from ingestion script)
scripts/         Reference-data ingestion + one-off tooling
data/            Raw reference data drop zone (user-supplied)
plans/           Design plans (this project's source of intent)
tasks/           Milestone checklists (resumable across sessions)
```

## Conventions

- TypeScript strict. Keep `lib/sg/` free of framework/IO imports so it stays testable and shareable.
- Match surrounding code style; co-locate tests with the code they cover.
- **Commit/push only when the user asks.** Update the relevant `tasks/NN-*.md` checkboxes as
  work completes so a future session can resume cleanly.
- Financial/none — this app stores no payment data.

## Commands

```bash
npm run dev              # Next dev server (Turbopack) on :3000
npm run build            # production build
npm run lint             # eslint
npm run typecheck        # tsc --noEmit
npm run test             # vitest run (Vitest 3 — pinned; v4/rolldown had native-binary issues)
npm run format           # prettier --write .
npm run ingest:benchmarks  # regenerate data/benchmarks/v1/benchmarks.json from data/reference/*.csv
npm run db:generate      # generate a migration from lib/db/schema.ts (offline)
npm run db:migrate       # apply migrations to the DB (needs DIRECT_URL)
npm run db:studio        # drizzle studio
```

Env: copy `.env.example` → `.env.local`. Without Supabase env vars the app still runs (the
`proxy.ts` session step no-ops); DB-backed features need them.

## Workflow: plans & tasks

- **`plans/`** holds design plans (numbered). This is the "why/what."
- **`tasks/`** holds the "how," one file per milestone, each a checklist with acceptance
  criteria + status. When starting a session, read `tasks/README.md`, find the first unfinished
  task, and continue. Keep checkboxes and the status line honest.
