# Tasks

Milestone checklists that taskify the design plans in [`../plans/`](../plans/). One file per
milestone, ordered. Each has a **Status**, **Depends on**, a **Checklist**, and **Acceptance
criteria**. Work top-down; keep checkboxes and the status line honest so any session can resume.

**Status legend:** `not started` · `in progress` · `blocked` · `done`

| #   | Task                                                                  | Status      | Notes                                                                                |
| --- | --------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| 01  | [Repo bootstrap](01-repo-bootstrap.md)                                | done        | Next.js 16 + Tailwind v4, light-only design system, Vitest — app runs                |
| 02  | [Supabase, schema & RLS](02-supabase-schema-rls.md)                   | done        | Migrations applied to live project; tables + RLS + trigger verified                  |
| 03  | [Auth, NUX & app shell](03-auth-nux-shell.md)                         | done        | Email auth, NUX (handicap), 3-tab shell — verified end-to-end                        |
| 04  | [SG reference-data pipeline](04-sg-reference-data.md)                 | done        | Real data ingested + corrected → `data/benchmarks/v1/benchmarks.json`                |
| 05  | [SG engine + tests](05-sg-engine.md)                                  | done        | Pure `lib/sg/`, 20 tests green vs real data                                          |
| 06  | [Tracking session & shot-entry UX](06-tracking-session-entry.md)      | done        | Full entry loop + live SG + autosave — verified end-to-end                           |
| 07  | [Round summary + baseline toggle](07-round-summary.md)                | done        | Category breakdown + baseline toggle — verified live                                 |
| 08  | [Feed & edit past rounds](08-feed-and-editing.md)                     | done        | Cards, continue-in-progress, edit + delete — verified end-to-end                     |
| 09  | [Profile stats & settings](09-profile-settings.md)                    | done        | Career averages + editable settings — verified end-to-end                            |
| 10  | [Offline-first & PWA](10-offline-pwa.md)                              | done        | Serwist (Turbopack) + Dexie sync — verified full offline round + finish              |
| 11  | [QA & deploy](11-qa-deploy.md)                                        | in progress | Deployed live to gainsmaxx.benstueck.com; final on-phone offline re-test outstanding |
| 12  | [Advanced stats (distance breakdown + FIR/GIR)](12-advanced-stats.md) | in progress | Implemented + unit tested; not yet verified in the browser                           |
| 13  | [Wedgemaxx](13-wedgemaxx.md)                                          | in progress | Phases 1-7 done (entry loop, edit, timer, summary, offline). Profile stats remain    |

## Blocked-on-user

- Handicap SHORT/PUTT values are research-based approximations (see `data/benchmarks/README.md`);
  swap in authoritative numbers if obtained. Non-blocking.

## Notes for future sessions

- Read [`../CLAUDE.md`](../CLAUDE.md) first for the domain model + stack.
- The SG invariant `sum(shot SG) == holeBenchmark − actualScore` is the backbone test.
- Don't commit/push unless the user asks.
