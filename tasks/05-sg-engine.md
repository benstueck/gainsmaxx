# 05 — SG engine + tests

**Status:** not started
**Depends on:** 04 (✅ real benchmark JSON + types now in repo — no synthetic fixture needed)

## Goal

The pure, dependency-free `lib/sg/` engine that computes strokes gained identically on client
and server, with thorough unit tests.

## Checklist

- [ ] `expectedStrokes(lie, distance, baselineLevel)` — table lookup + **linear distance interpolation**.
- [ ] `expectedStrokesForHandicap(lie, distance, handicap)` — interpolate between the two bracketing
      levels (e.g. 12 → blend 10 & 15); clamp below 0 / above 25; Tour is its own level.
- [ ] `categorize(shot, par)` → OTT | APP | ARG | Putting (par-3 tee = APP; ≤30 yd non-putt = ARG; green = Putting).
- [ ] `strokesGainedForShot(shot, baseline)` = `Exp(start) − Exp(end) − 1 − penaltyStrokes`; `Exp(end)=0` if holed.
      Handle **Penalty** (`penaltyStrokes=1`, end=drop) and **OOB** (`penaltyStrokes=2`, end=replay landing).
- [ ] `roundSummary(shots, baseline)` → per-category totals (OTT/APP/ARG/P) + Tee-to-Green + Total.
- [ ] Chaining validator: shot N end == shot N+1 start (warn on mismatch).
- [ ] Unit conversions (yards ↔ feet) handled at boundaries; green distances in feet.

## Tests (Vitest)

- [ ] Known start/end pairs → expected SG values (from fixture).
- [ ] Category assignment across all four categories + par-3 tee edge case + 30-yd boundary.
- [ ] Distance interpolation at row midpoints and exact rows.
- [ ] Handicap interpolation at bracket edges (0, 25), midpoints (12), and Tour.
- [ ] Penalty and OOB worked examples from the plan produce the documented SG.
- [ ] **Invariant:** `sum(shot SG on a hole) == holeBenchmark(tee) − actualScore`.

## Acceptance criteria

- All engine tests green against the synthetic fixture; engine imports no framework/IO code.
