# 04 — SG reference-data pipeline

**Status:** mostly done (data landed; ingestion + normalized JSON in repo). Remaining: engine
wiring (Task 05) + confirm source-data anomalies with user.
**Depends on:** 01 (for the app to import it at build time)

## Goal

Define the normalized benchmark JSON the engine consumes, an ingestion script that transforms
the user's raw reference files into it, and get the real data into the repo.

## What the real data actually is (differs from the original plan assumption)

One per-shot **Tour** expected-strokes table + **round-level handicap adjustments** — not a full
expected-strokes table per handicap. See [`../data/benchmarks/README.md`](../data/benchmarks/README.md).

## Checklist

- [x] Raw CSVs added to [`../data/reference/`](../data/reference/) (`long-game.csv`,
      `putting.csv`, `handicap-adjustments.csv`).
- [x] Normalized JSON schema defined + emitted to
      [`../data/benchmarks/v1/benchmarks.json`](../data/benchmarks/v1/benchmarks.json):
  - [x] `tour.longGame` — per-lie sorted `[distanceYd, expectedStrokes]` (`tee/fairway/rough/sand/recovery`).
  - [x] `tour.putting.green` — sorted `[distanceFt, expectedStrokes]`.
  - [x] `handicapAdjustments.levels` — per-round strokes-lost-vs-tour by category for `0/5/10/15/20/25`.
- [x] TypeScript types: [`../lib/sg/benchmarks.types.ts`](../lib/sg/benchmarks.types.ts).
- [x] Ingestion script: [`../scripts/ingest-benchmarks.mjs`](../scripts/ingest-benchmarks.mjs)
      (plain Node ESM; `node scripts/ingest-benchmarks.mjs`). Faithful — preserves anomalies.
- [x] Format + semantics documented in `data/benchmarks/README.md`.
- [x] **3 source-data anomalies corrected** (rough@230→3.58; fairway@520–600 re-derived; handicap
      SHORT/PUTT re-derived). Provenance in `data/benchmarks/README.md`. NOTE: the SHORT/PUTT
      handicap values are research-based **approximations** — swap in authoritative numbers if available.
- [ ] Add validation to the script (monotonicity warnings, sorted distances) — optional hardening.
- [ ] Wire the JSON into the app build + service-worker precache (with Task 05 / Task 10).

## Acceptance criteria

- Engine can load `benchmarks.json` and read Tour tables + handicap adjustments. ✅ (shape ready)
- Re-running ingestion reproduces the JSON deterministically. ✅
