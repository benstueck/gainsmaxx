# 08 — Feed & edit past rounds

**Status:** done — verified end-to-end in the browser
**Depends on:** 06, 07

## Goal

The Feed tab (rounds newest-first) and the ability to edit any past round/shot with SG recompute
(the user's "adjust tracking where needed").

## What landed

- `lib/db/round-queries.ts`: added `loadUserRounds()` — 3 queries total regardless of round
  count, returns each round with a computed `RoundSummary`. Shared `toHoleStates` helper.
- `app/(app)/feed/page.tsx` + `components/round/feed-card.tsx` — the Feed itself.
- `app/round/[id]/page.tsx` — `?edit=1` opens a **completed** round in the session editor
  instead of redirecting to its summary.
- `round-session.tsx` — added `deleteShot` action + a Delete button in the edit dock (shown when
  editing an existing shot). Deleting re-chains automatically (start is derived).
- `round-summary.tsx` — added **Edit round** (in-progress → Continue; complete → `?edit=1`) and
  **Delete round** (confirm → `deleteRound` server action → Feed).
- `app/round/actions.ts` — added `deleteRound`.

## Checklist

**Feed**
- [x] Rounds newest-first as cards: date, course, holes, score, **Total SG** vs the user's
      handicap baseline, mini category bars (OTT/APP/ARG/PUTT).
- [x] **In-progress round pinned at top**, visually distinct (primary border/tint), "Continue →".
- [x] Tap a card → summary (complete) or the session (in-progress).
- [x] Empty state for no rounds.

**Editing**
- [x] Open a saved round → reuse the shot-entry UI to edit lie/distance/penalty/par.
- [x] SG recomputes on save (same server-side `persist()` path as normal autosave).
- [x] Delete a shot mid-hole → remaining shots re-chain automatically (derived starts).
- [x] Delete a round (confirm dialog) → cascades holes/shots via FK.

## Acceptance criteria

- [x] Feed reflects rounds in correct order with accurate SG summaries (verified: in-progress
      pinned + tint, complete card showed correct total/score/mini-bars).
- [x] Continue-round resumes exactly where left off (Augusta round continued at hole 1 mid-entry).
- [x] Editing a past shot updates all derived SG correctly and persists (deleted a tee shot on a
      saved round → next shot re-chained to Tee 520 → Fairway 90, +0.76, live).
- [x] Delete round removed it from the Feed immediately.
