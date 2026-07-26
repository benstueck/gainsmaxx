# 06 — Tracking session & shot-entry UX ⭐ highest-care milestone

**Status:** done — verified end-to-end in the browser (mobile viewport)
**Depends on:** 03, 05

## Goal

The core on-course loop: start a round, then log shots with the fewest, most reliable taps.
This is the product — invest disproportionately here.

## What landed

- `lib/round.ts` — session domain: `ShotEnd`/`HoleState`, `nextStart`, `holeShotInputs`
  (derives each shot's START from the previous end, so edits auto-re-chain), `unitFor`.
- `app/round/actions.ts` — `createRound`, `saveRound` (autosave), `finishRound`; SG computed
  **server-side** via the engine and stored per shot (authoritative recompute).
- `app/(app)/round/new/page.tsx` + `new-round-form.tsx` — 9/18 + course chooser.
- `app/round/[id]/page.tsx` — full-screen session loader (no tab bar); reconstructs state.
- `components/round/round-session.tsx` — reducer-driven session + entry dock.
- `components/round/numeric-keypad.tsx` — custom digit keypad.

## Checklist

- [x] "+" → choose 9 or 18 (+ optional course) → create round → session (Hole 1).
- [x] Header: **Hole X of N** (+ live round SG & strokes) + big **Par 3/4/5** selector.
- [x] Shot 1 start pre-set to **Tee**; hole length entered once (= tee-shot start yardage).
- [x] Running shot list (`start → end` + per-shot SG) with running score + hole SG.
- [x] End-lie big buttons: Fairway · Rough · Sand · Recovery · Green.
- [x] **Custom numeric keypad** (thumb zone, not OS keyboard) + big Add/Holed.
- [x] **Green** → distance flips to **feet** + putting sub-mode (lie/penalty hidden).
- [x] **Penalty (+1)** / **OB (+2)** chips → correct engine SG (verified −2.30 OB example).
- [x] Prominent **Holed** button (any lie) → ends shot + completes hole.
- [x] Next shot **auto-carries start** from previous end.
- [x] One-tap **Undo**; tap any shot row to **edit** (loads draft, recomputes live).
- [x] **Next hole** resets to Tee; **Finish** completes the round → Feed.
- [x] Header **back/forward chevrons** jump between already-reached holes (no data loss;
      re-entering a hole shows its full state — complete or in-progress — for correction).
- [x] Live SG per shot vs Tour; round total vs the user's handicap baseline.
- [x] Debounced **autosave** to Supabase; reload/continue reconstructs the round.

## Acceptance criteria

- [x] A full hole logged in a few taps/shot; start never re-entered (verified: par-4 birdie,
      Hole SG +0.99 == benchmark − score).
- [x] Penalty & OOB compute the documented SG (OB tee shot = −2.30).
- [x] Undo/edit work and recompute; putting sub-mode behaves.
- [x] Verified on a 375px phone viewport; persisted round matches (status complete, SG per hole).

## Deferred

- Offline queue / Dexie (Milestone 10) — currently autosaves straight to Supabase.
- Round **summary** screen after Finish (Milestone 7) — Finish currently returns to Feed.
