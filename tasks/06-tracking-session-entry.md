# 06 — Tracking session & shot-entry UX ⭐ highest-care milestone

**Status:** not started
**Depends on:** 03, 05

## Goal

The core on-course loop: start a round, then log shots with the fewest, most reliable taps.
This is the product — invest disproportionately here.

## Checklist

**New round**

- [ ] "+" tab → choose **9 or 18** (+ optional course name) → create round (local-first) → Hole 1.

**Per-hole screen**

- [ ] Header: **Hole X of N** + big **Par 3 / 4 / 5** selector.
- [ ] Shot 1 start pre-set to **Tee**; user enters hole length once as start yardage.
- [ ] Running shot list (`startLie dist → endLie dist` + per-shot SG) with running score + running hole SG.

**Shot-entry sheet (the repeated action, target ~3–4 taps)**

- [ ] **End-lie** big buttons: `Fairway · Rough · Sand · Recovery · Green`.
- [ ] **Custom numeric keypad** (thumb zone, not OS keyboard) for end distance; big confirm.
- [ ] **Green** selection → distance unit flips to **feet** + enters putting sub-mode.
- [ ] **Penalty** / **OOB** toggles (wire to engine semantics: 1 vs 2 penalty strokes, end meaning).
- [ ] Prominent **"Holed"** button (works from any lie) → ends shot as holed + closes hole.
- [ ] Next shot **auto-carries start** from previous end (never re-entered).

**Putting sub-mode**

- [ ] Collapses to feet-only distance + **Holed**; start carried each putt.

**Speed/safety affordances**

- [ ] One-tap **Undo last shot**; tap any shot row to **edit** (recompute SG live).
- [ ] Auto-advance focus (lie → distance → ready); **Next hole** resets to Tee.
- [ ] Live SG shown per shot using the current handicap baseline.

## Acceptance criteria

- A full hole can be logged in a handful of taps per shot with start never re-entered.
- Penalty & OOB entries compute the SG documented in the plan.
- Undo/edit work and recompute correctly; putting sub-mode behaves.
- Verified on a phone-sized viewport, one-handed.
