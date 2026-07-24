# SG benchmark data

Normalized strokes-gained reference data consumed by the SG engine (`lib/sg/`) and precached
for offline use. Generated from the raw CSVs in [`../reference/`](../reference/) by
[`../../scripts/ingest-benchmarks.mjs`](../../scripts/ingest-benchmarks.mjs).

**Regenerate after editing any raw CSV:**

```bash
node scripts/ingest-benchmarks.mjs
```

Current output: [`v1/benchmarks.json`](v1/benchmarks.json). Types: [`../../lib/sg/benchmarks.types.ts`](../../lib/sg/benchmarks.types.ts).

## What the data means

There is **one per-shot expected-strokes table (the PGA Tour baseline)** plus **round-level
handicap adjustments**:

- **`tour.longGame`** — expected strokes to hole out by lie (`tee/fairway/rough/sand/recovery`)
  and distance (**yards**). Each lie is a sorted `[distance, expectedStrokes]` list; lies only
  cover the distances present in the source (TEE and RECOVERY start at 100 yd). The engine
  linearly **interpolates** between points and clamps outside the range.
- **`tour.putting.green`** — expected putts by distance (**feet**), same `[distance, value]` shape.
- **`handicapAdjustments.levels`** — strokes **lost per 18-hole round vs the Tour baseline**, by
  category, for handicaps `0/5/10/15/20/25`. Source columns map as
  `TEE→ott, APPROACH→app, SHORT→arg, PUTT→putt`.

## How the engine uses it (round-level adjustment model)

Per-shot SG is always computed against the **Tour** table:

```
SG(shot) = Exp_tour(start) − Exp_tour(end) − 1 − penaltyStrokes
```

The chosen **baseline** only changes the aggregated per-category / total numbers:

- **Tour** → no adjustment (raw SG vs Tour; large negatives for amateurs).
- **Handicap H** → add back H's expected per-round category loss:
  `SG_vs_H(category) = SG_vs_tour(category) + adjustment_H(category)`
  - Interpolate `adjustment_H` between bracketing levels for handicaps in between (e.g. 12 → blend 10 & 15).
  - Scale by holes played (× 0.5 for a 9-hole round; prorate partial rounds).

So a golfer who plays exactly like the average of their handicap nets ≈ 0 total SG — positive
means better than their level. **Live per-shot SG during a round is shown vs Tour**, since the
handicap adjustment is only defined at the round/category level.

## Source-data corrections applied (2026-07-24)

The raw CSVs were corrected in place from the values originally supplied. Provenance:

1. **`long-game.csv` ROUGH @ 230 yd: 3.80 → 3.58.** Original broke monotonicity (neighbors
   3.53 / 3.64); user confirmed 3.58.
2. **`long-game.csv` FAIRWAY @ 520–600 yd: re-derived** to `4.66 / 4.77 / 4.86 / 4.91 / 4.94`.
   The original fairway values duplicated the ROUGH column. ROUGH was determined correct (it
   continues its own +~0.13/step trend from 500 yd = 4.72); FAIRWAY was wrong. New values place
   fairway ~39% of the way from the TEE value to the ROUGH value at each distance — the stable
   ratio observed at 460–500 yd — so fairway sits correctly below rough and decelerates like the
   tee column.
3. **`handicap-adjustments.csv` SHORT + PUTT re-derived** for handicaps 10/15/20/25. Original had
   SHORT == PUTT ≈ 4.5 for 15/20/25 (a data-entry slip) and PUTT @ hcp 10 = 2.77 (an outlier
   inconsistent with all public strokes-gained-by-handicap research, where putting is the
   _smallest_ category and grows slowly). TEE and APPROACH columns were left as supplied (they
   already match Broadie's structure — approach dominant). SHORT/PUTT were extended from the
   clean 0/5 rows at a research-consistent slope (short game ~+0.5 per 5 strokes; putting
   growing more slowly). **These SHORT/PUTT values are approximations — replace if authoritative
   source numbers become available.** The steeper overall scale of this dataset vs some public
   tables (scratch total ~5.1 vs ~3.2) was preserved.
