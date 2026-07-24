# 02 — Supabase, schema & RLS

**Status:** done — migrations applied to the live Supabase project and verified
**Depends on:** 01

## Goal

Provision Supabase and define the database schema with Drizzle + migrations, plus row-level
security so each user only ever touches their own data.

## Checklist

- [x] **Supabase project created; `.env.local` set** (URL + publishable key + `DIRECT_URL`).
      New projects issue a `sb_publishable_…` key — code + `.env.example` use
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- [x] Add **Drizzle ORM** + drizzle-kit; `lib/db/index.ts` lazy pooled client (`prepare:false`).
- [x] Define schema in `lib/db/schema.ts`:
  - [x] `profiles` (1:1 `auth.users`): `handicap` numeric, `units`, `default_baseline`, timestamps.
  - [x] `rounds`: `user_id`, `client_uuid` (unique per user), `played_at`, `num_holes` (9|18 check),
        `course_name?`, `baseline_snapshot`, `status`, timestamps.
  - [x] `holes`: `round_id`, `hole_number`, `par` (checks + unique).
  - [x] `shots`: `hole_id`, `shot_number`, start/end lie+distance, `is_holed`, `penalty_strokes`
        (0–2 check), `is_ob`, `sg_category`, `sg_value`, timestamps.
        _(No `distance_unit` column — unit is derived from lie: green=feet, else yards.)_
- [x] Enums: `lie`, `round_status`, `sg_category`. _(No distance-unit/baseline enums — see above /
      baseline is a text pref.)_
- [x] **RLS** on every table with per-user policies (`0001_supabase_rls.sql`), joined for holes/shots.
- [x] Trigger `on_auth_user_created` → auto-inserts a `profiles` row on signup.
- [x] Migrations generated (`0000` tables, `0001` auth-FK + RLS + trigger); `db:*` scripts added.
- [x] `@supabase/ssr` helpers (`lib/supabase/{server,client,middleware}.ts`) + `proxy.ts`.

## Acceptance criteria

- [x] `npm run db:migrate` applied cleanly; verified 4 tables with RLS enabled, per-user policies
      (profiles 3; rounds/holes/shots 1 each), the `on_auth_user_created` trigger, and enums.
- [ ] Manual check with two real users: A cannot read/write B's rows (verify after auth lands in Task 03).
- [x] `client_uuid` uniqueness (unique on `user_id, client_uuid`) prevents duplicate rounds on re-sync.
- [x] Typecheck/lint/build green with the schema + client code.
