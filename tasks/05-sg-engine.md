# 05 — SG engine + tests

**Status:** done — 20 engine tests green against the real benchmark data
**Depends on:** 04 (✅ real benchmark JSON + types in repo)

## Goal

The pure, dependency-free `lib/sg/` engine that computes strokes gained identically on client
and server, with thorough unit tests.

## What landed (`lib/sg/`)

- `data.ts` — statically imports the bundled `benchmarks.json` (works offline, no IO).
- `benchmarks.types.ts` — `LongGameLie` vs `Lie` (adds `green`), table + adjustment shapes.
- `types.ts` — `ShotInput`, `HoleInput`, `Baseline` (`"tour" | number`), summary types.
- `engine.ts` — the functions below. `index.ts` — public API re-exports.

## Checklist

- [x] `interpolate(points, x)` — linear, clamped at both ends (no extrapolation).
- [x] `expectedStrokes(lie, distance)` — Tour table lookup; green uses feet, else yards.
      _(Per-shot SG is always vs Tour — the data has one per-shot table; handicap is round-level.)_
- [x] `categorize(startLie, distanceYd, par)` → OTT | APP | ARG | Putt (par-3 tee = APP;
      ≤ 30 yд non-putt = ARG; green = Putt). `ARG_MAX_YARDS` exported.
- [x] `strokesGainedForShot(shot, par)` = `Exp(start) − Exp(end) − 1 − penaltyStrokes`;
      `Exp(end)=0` when holed. Penalty (1) and OOB (2) handled via `penaltyStrokes`.
- [x] `holeStrokesGained(shots, par)` → per-category SG + score (entries + penalty strokes).
- [x] `handicapAdjustment(handicap)` — interpolate the round-level category adjustments between
      the 0/5/10/15/20/25 brackets; clamp outside.
- [x] `roundStrokesGained(holes, baseline)` → per-category + Tee-to-Green + Total + score/toPar.
      `"tour"` = raw; a handicap adds back the adjustment scaled by `holesPlayed/18`.
- [x] Unit convention (green=feet, else yards) handled in `expectedStrokes`.
- [ ] Start/end chaining **warning** deferred to the entry layer (Task 06), where mismatches
      are user-facing; the engine's telescoping invariant is covered by tests.

## Tests (Vitest) — all green

- [x] `interpolate`: exact points, midpoints, clamping.
- [x] `expectedStrokes`: exact table values, distance interpolation, clamp below/above range.
- [x] `categorize`: all four categories, par-3 tee, 30-yд boundary (30 vs 31).
- [x] Made-putt gains; **Penalty** and **OOB** plan examples produce the documented SG.
- [x] Handicap interpolation at brackets (0, 25), midpoint (12), and clamps.
- [x] **Invariant:** `sum(shot SG on a hole) == expectedStrokes(tee) − score`.
- [x] Round baseline: `"tour"` unadjusted; handicap adds scaled adjustment; empty holes ignored.

## Acceptance criteria

- [x] All engine tests green against the real data; `lib/sg/` imports no framework/IO code
      (only a static JSON import).
