# 07 — Round summary + baseline toggle

**Status:** done — verified in the browser (baseline toggle recomputes live)
**Depends on:** 05, 06

## Goal

The per-round breakdown screen — the MVP's headline analytics.

## What landed

- `lib/db/round-queries.ts` — shared `loadRound()` (reconstructs `HoleState[]`), used by the
  session and summary pages.
- `app/round/[id]/summary/page.tsx` — server loader; `components/round/round-summary.tsx` — client.
- `finishRound` now redirects to the summary; a complete round opened at `/round/[id]` redirects
  to its summary too.

## Checklist

- [x] Per-category SG (**OTT / APP / ARG / Putting**) + **Tee-to-Green** + **Total**.
- [x] Hole-by-hole list (hole, par, score + to-par, per-hole SG vs Tour).
- [x] **Baseline toggle** dropdown — "My handicap (X.X)" (default, interpolated) + PGA Tour +
      Scratch/5/10/15/20/25; recomputes the whole breakdown **instantly** client-side.
- [x] Diverging bars (green gained right / red lost left, neutral zero midpoint) + signed labels
      (never color-alone); light-mode legible.
- [x] Reached immediately after **Finish**; in-progress rounds show a partial summary + a
      **Continue round** button. (Feed-card entry lands in Milestone 8.)
- [x] In-progress handled gracefully (only played holes counted; "in progress" label).

## Acceptance criteria

- [x] Totals match the engine (verified: +3.02 vs handicap 8 = +1.06 vs Tour + scaled adjustment).
- [x] Switching baseline recomputes instantly and correctly (Tour ↔ handicap flips bar polarity).
