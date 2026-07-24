# 07 — Round summary + baseline toggle

**Status:** not started
**Depends on:** 05, 06

## Goal

The per-round breakdown screen — the MVP's headline analytics.

## Checklist

- [ ] Compute + display per-category SG (**OTT / APP / ARG / Putting**) + **Tee-to-Green** + **Total**.
- [ ] Hole-by-hole score list (par, strokes, +/- , optional per-hole SG).
- [ ] **Baseline toggle** dropdown over the 7 levels (`0/5/10/15/20/25/Tour`); default = user's
      interpolated handicap; recompute the breakdown on change (client-side, instant).
- [ ] Clear visual encoding of gained (+) vs lost (−) per category (bars/color), light-mode legible.
- [ ] Reached from a Feed card and immediately after finishing a round.
- [ ] Handle in-progress rounds gracefully (partial summary).

## Acceptance criteria

- Totals match the engine and the hand-computed sample.
- Switching baseline recomputes instantly and correctly (including interpolated default).
