# 08 — Feed & edit past rounds

**Status:** not started
**Depends on:** 06, 07

## Goal

The Feed tab (rounds newest-first) and the ability to edit any past round/shot with SG recompute
(the user's "adjust tracking where needed").

## Checklist

**Feed**

- [ ] Rounds newest-first as cards: date, optional course, 9/18, total score, **Total SG** vs baseline,
      small category mini-bars (OTT/APP/ARG/P).
- [ ] **In-progress round pinned at top** as "Continue round" → resumes the tracking session.
- [ ] Tap a card → round summary (Task 07).
- [ ] Empty state for no rounds.

**Editing**

- [ ] Open a saved round → reuse the shot-entry UI to edit lie/distance/penalty/par.
- [ ] Recompute affected shot + hole + round SG on save; persist + re-sync.
- [ ] Add/delete a shot mid-hole with re-chaining of start/end.
- [ ] Delete a round (with confirm).

## Acceptance criteria

- Feed reflects rounds in correct order with accurate SG summaries.
- Continue-round resumes exactly where left off.
- Editing a past shot updates all derived SG correctly and persists.
