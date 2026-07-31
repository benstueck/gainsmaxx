# Gainsmaxx ⛳️

A mobile-first, **offline-first** PWA for golf performance: **strokes gained** tracking
shot-by-shot during a round, plus skill-training modes like **Wedgemaxx**. Next.js 16 + Supabase.

- **Design & scope:** [`plans/01-design.md`](plans/01-design.md)
- **Working context for contributors/agents:** [`CLAUDE.md`](CLAUDE.md)
- **Milestone checklists:** [`tasks/`](tasks/)

## Quickstart

```bash
npm install
cp .env.example .env.local   # fill in once you have a Supabase project (see below)
npm run dev                  # http://localhost:3000
```

The app runs without Supabase configured (you'll see the landing page); auth and data features
need the env vars below.

Common scripts: `npm run build`, `lint`, `typecheck`, `test`, `format`, `ingest:benchmarks`,
`db:generate`, `db:migrate`, `db:studio`.

## Supabase setup (one-time)

This creates the database the app talks to. You do steps 1–2 (they need your login); the rest is
scripted.

1. **Create a project** at [supabase.com/dashboard](https://supabase.com/dashboard) → New project.
   Save the database password.
2. **Copy credentials into `.env.local`:**
   - _Project Settings → API Keys_ → `NEXT_PUBLIC_SUPABASE_URL` and
     `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the new `sb_publishable_…` key; if your project only
     shows a legacy `anon` JWT key, use that value in the same variable).
   - _Project Settings → Database → Connection string_ →
     - `DATABASE_URL` = the **Transaction pooler** URI (port `6543`), used at runtime.
     - `DIRECT_URL` = the **Session** URI (port `5432`), used for migrations.
3. **Apply the schema + security:**
   ```bash
   npm run db:migrate
   ```
   This runs [`lib/db/migrations/`](lib/db/migrations/): table creation, then the Supabase
   migration that wires `auth.users` foreign keys, enables **row-level security** with per-user
   policies, and adds the trigger that auto-creates a `profiles` row on signup.
4. **Verify:** `npm run db:studio` (or the Supabase Table Editor) should show `profiles`,
   `rounds`, `holes`, `shots`, all with RLS enabled.

## Strokes-gained reference data

Raw CSVs live in [`data/reference/`](data/reference/); the engine consumes the normalized
[`data/benchmarks/v1/benchmarks.json`](data/benchmarks/v1/benchmarks.json). Regenerate with
`npm run ingest:benchmarks`. Format, semantics, and applied data corrections:
[`data/benchmarks/README.md`](data/benchmarks/README.md).

## Project layout

```
app/               Next.js App Router
components/ui/      Light-only design primitives (BigButton, …)
lib/sg/            Pure strokes-gained engine + benchmark types (Milestone 5)
lib/db/            Drizzle schema, client, migrations (incl. RLS)
lib/supabase/      @supabase/ssr server/browser/session helpers
proxy.ts           Session refresh (Next 16 "proxy" = former middleware)
data/              Reference CSVs + generated benchmark JSON
scripts/           ingest-benchmarks.mjs
plans/ tasks/      Design plans and resumable milestone checklists
```
