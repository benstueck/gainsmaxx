# Tasks

Milestone checklists that taskify [`../plans/01-design.md`](../plans/01-design.md). One file per
milestone, ordered. Each has a **Status**, **Depends on**, a **Checklist**, and **Acceptance
criteria**. Work top-down; keep checkboxes and the status line honest so any session can resume.

**Status legend:** `not started` · `in progress` · `blocked` · `done`

| #   | Task                                                             | Status      | Notes                                                                 |
| --- | ---------------------------------------------------------------- | ----------- | --------------------------------------------------------------------- |
| 01  | [Repo bootstrap](01-repo-bootstrap.md)                           | done        | Next.js 16 + Tailwind v4, light-only design system, Vitest — app runs |
| 02  | [Supabase, schema & RLS](02-supabase-schema-rls.md)              | done        | Migrations applied to live project; tables + RLS + trigger verified   |
| 03  | [Auth, NUX & app shell](03-auth-nux-shell.md)                    | done        | Email auth, NUX (handicap), 3-tab shell — verified end-to-end         |
| 04  | [SG reference-data pipeline](04-sg-reference-data.md)            | done        | Real data ingested + corrected → `data/benchmarks/v1/benchmarks.json` |
| 05  | [SG engine + tests](05-sg-engine.md)                             | done        | Pure `lib/sg/`, 20 tests green vs real data                           |
| 06  | [Tracking session & shot-entry UX](06-tracking-session-entry.md) | done        | Full entry loop + live SG + autosave — verified end-to-end            |
| 07  | [Round summary + baseline toggle](07-round-summary.md)           | not started | Per-round breakdown                                                   |
| 08  | [Feed & edit past rounds](08-feed-and-editing.md)                | not started | Cards, continue-in-progress, edit + recompute                         |
| 09  | [Profile stats & settings](09-profile-settings.md)               | not started | Career averages, handicap/units/baseline, logout                      |
| 10  | [Offline-first & PWA](10-offline-pwa.md)                         | not started | Serwist SW, Dexie, sync layer                                         |
| 11  | [QA & deploy](11-qa-deploy.md)                                   | not started | Verification + Vercel                                                 |

## Blocked-on-user

- **None blocking.** Supabase project is live and migrated. Optional: add the pooled
  `DATABASE_URL` (Transaction pooler :6543) to `.env.local` for production-grade runtime queries;
  dev falls back to `DIRECT_URL`.
- Handicap SHORT/PUTT values are research-based approximations (see `data/benchmarks/README.md`);
  swap in authoritative numbers if obtained. Non-blocking.

## Notes for future sessions

- Read [`../CLAUDE.md`](../CLAUDE.md) first for the domain model + stack.
- The SG invariant `sum(shot SG) == holeBenchmark − actualScore` is the backbone test.
- Don't commit/push unless the user asks.
