# 12 — Advanced stats (distance breakdown + FIR/GIR)

**Status:** implemented, not yet browser-verified (typecheck/lint/build/tests green)
**Depends on:** 07 (round summary), 09 (profile stats)

## Goal

Two additions, both derived from data already loaded (no new DB queries, no schema changes):

1. An **"Advanced stats" section** (collapsible, added to existing pages — no new routes) on
   both the round summary and the Profile page, breaking each category (OTT/APP/ARG/PUTT) down
   by starting distance.
2. **Fairways in Regulation** and **Greens in Regulation** (count + %) on the round summary.

Decisions already confirmed with the user:

| Question                         | Decision                                                                                                                                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Round-summary distance breakdown | **Total SG** per bucket (matches the screenshots)                                                                                                                                                                       |
| Profile distance breakdown       | **Per-18 holes-weighted average** per bucket — same normalization as the existing career `avgTotal`/`avgByCategory` (see `lib/career-stats.ts`), not a simple per-round or per-shot average                             |
| Baseline                         | Always **vs Tour**, regardless of the page's baseline toggle. Handicap adjustments only exist at the whole-category level, not per distance bucket, so there's no principled way to split them across buckets           |
| FIR edge case                    | A tee shot that reaches the **green** (not just the fairway) also counts as a fairway hit                                                                                                                               |
| UI placement                     | New collapsible "Advanced stats" section on the existing round-summary and Profile pages                                                                                                                                |
| Distance buckets                 | Confirmed as proposed below                                                                                                                                                                                             |
| FIR/GIR scope                    | **Round summary only** — no career FIR%/GIR% on Profile                                                                                                                                                                 |
| Disclaimer                       | The Advanced Stats section must make clear its numbers are **vs the PGA Tour baseline**, not the user's handicap or the page's baseline toggle — since it's easy to miss that this section ignores that toggle entirely |

## Distance buckets (confirmed)

These are independent of the benchmark data's own interpolation grid (that's a different,
finer-grained table used only to compute expected strokes). Buckets are purely a reporting
grouping of the player's own shots, by **starting** distance/lie (same as SG categorization).

- **PUTT** (feet): `0–3, 3–5, 5–10, 10–15, 15–20, 20–30, 30+` — exactly matches your screenshot.
- **APP** (yards): `30–50, 50–100, 100–150, 150–200, 200+`. Your screenshot started at 50–100;
  added a 30–50 bucket since APP starts right where ARG ends (>30 yd), so shots in that range
  need a home. Par-3 tee shots also land in here (they can push into the 200+ bucket).
- **ARG** (yards, 0–30 by definition): `0–10, 10–20, 20–30`.
- **OTT** (yards — this is the **hole length**, i.e. the tee shot's starting distance, not
  where it ended up): `<350, 350–400, 400–450, 450–500, 500+`. Not in your screenshots since
  those were APP/PUTT examples, but this is the standard way tee-shot SG gets bucketed (by hole
  length, since that's what the tee shot's "start" distance is).

Buckets with zero shots in a given scope (a round, or across all rounds for Profile) are shown
as empty/dash, not zero — a zero would misleadingly imply "played it dead even" rather than "no
data." Each bucket also shows its **shot count**, so a wild single-shot outlier isn't mistaken
for a trend (especially on a single round's breakdown).

## FIR / GIR definitions

Both only count **completed holes** (a hole with no `isHoled` shot contributes to neither
numerator nor denominator).

**Fairway in Regulation** — only applies to **par 4/5** holes (a hole where the tee shot is
categorized OTT; par 3s have no FIR concept and are excluded from both numerator and
denominator).

- Hit: the tee shot (first shot of the hole) has `penaltyStrokes === 0` and `endLie` is
  `"fairway"` or `"green"`.
- Miss: anything else (rough/sand/recovery, or any penalty on the tee shot — a penalized tee
  shot never counts as a hit, even if the drop happened to land in the fairway).
- Displayed as `made/attempted (pct%)`, e.g. `9/14 (64%)`.

**Green in Regulation** — applies to all holes.

- "Regulation" strokes = `par − 2`.
- Find the first shot (by array order) whose `endLie === "green"` or `isHoled === true`.
- Compute the **cumulative stroke count** through that shot: `sum(1 + penaltyStrokes)` for every
  shot up to and including it (this already matches how `holeStrokesGained` computes `score`, so
  it's the same accounting, not a new stroke-counting concept).
- Hit if that cumulative count is `≤ par − 2`.
- Displayed as `made/attempted (pct%)`, e.g. `14/18 (78%)`.

## New pure functions (lib/sg or a new lib/round-stats.ts — TBD during implementation)

- `bucketDistance(category, distance): string` — maps a starting distance to its bucket label
  for a given category.
- `distanceBreakdown(shots-with-results, scope): { category, bucket, totalSg, shotCount }[]` —
  groups already-computed per-shot SG (vs Tour) by category + bucket. Used two ways:
  - Round summary: fed the single round's shots, shown as **total SG** per bucket.
  - Profile: fed **all completed rounds'** shots, summed per bucket, then divided by **total
    holes played across those rounds** and scaled ×18 (identical normalization to
    `computeCareerStats`, applied per-bucket instead of per-category).
- `holeFairwayInRegulation(shots, par): boolean | null` — `null` for par 3 or incomplete holes.
- `holeGreenInRegulation(shots, par): boolean | null` — `null` for incomplete holes.
- `roundFirGir(holes): { fir: {made, attempted}, gir: {made, attempted} }` — aggregates the two
  above across a round's completed holes.

All pure, dependency-free, alongside the existing `lib/sg/` engine — same testing approach
(unit tests against constructed fixtures, plus a couple of hand-computed examples).

## UI plan

- **Round summary** (`components/round/round-summary.tsx`): a new collapsible "Advanced stats"
  section below the existing hole-by-hole table — a small disclosure per category (OTT/APP/ARG/
  PUTT), each expanding to its bucket table (bucket, total SG, shot count), with a persistent
  "vs PGA Tour" disclaimer label on the section (not just a one-time tooltip — it should be
  visible whenever the section is open, since it silently ignores the page's own baseline
  toggle). FIR/GIR shown as two stat lines near the existing total-SG hero (always visible, not
  inside the collapsible).
- **Profile** (`app/(app)/profile/page.tsx`): the same collapsible "Advanced stats" section and
  the same "vs PGA Tour" disclaimer, same per-category bucket tables, but populated with the
  holes-weighted average across all completed rounds instead of a single round's totals. No
  FIR/GIR here per the confirmed scope.

## Checklist

- [x] `lib/round-stats.ts`: bucketing (`computeBucketTotals`, `scaleBucketsPer18`,
      `careerBucketTotals`) + FIR/GIR (`holeFairwayInRegulation`, `holeGreenInRegulation`,
      `roundFirGir`) pure functions — 18 unit tests in `lib/round-stats.test.ts`
- [x] Round summary: FIR/GIR stat lines (`components/round/round-summary.tsx`)
- [x] Round summary: collapsible Advanced Stats section (total SG per bucket) with "vs PGA Tour"
      disclaimer (`components/stats/advanced-stats.tsx`)
- [x] Profile: collapsible Advanced Stats section (holes-weighted avg per bucket) with "vs PGA
      Tour" disclaimer — `lib/db/round-queries.ts`'s `FeedRound` now also returns `holes` (already
      fetched, no new query) so `careerBucketTotals` can consume it
- [ ] Update `CLAUDE.md` status once shipped
- [ ] **Not yet verified in the browser** — no test account credentials available this session;
      typecheck/lint/build/tests are all green, but the UI itself needs a real click-through
      (expand each category on both pages, confirm bucket math against a known round, confirm
      FIR/GIR against a hand-counted round).

## Acceptance criteria

- [x] A round with known shots produces hand-verifiable bucket totals and FIR/GIR counts (see
      `lib/round-stats.test.ts`, including exact-boundary and penalty-stroke edge cases).
- [x] Profile's per-bucket averages are holes-weighted the same way `computeCareerStats` already
      is (a 9-hole round doesn't get equal weight to an 18 in the bucket averages either) —
      covered by a dedicated test.
- [x] Empty buckets render distinctly from a zero-SG bucket (shown as "—", not "+0.00").
- [x] No new DB queries — computed from data the pages already load.
- [x] The "vs PGA Tour" disclaimer is visible on both Advanced Stats sections whenever expanded.
