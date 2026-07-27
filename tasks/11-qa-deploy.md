# 11 — QA & deploy

**Status:** QA done — verified end-to-end; deploy not yet started
**Depends on:** all prior

## Goal

End-to-end verification and production deploy.

## QA — done

- [x] Engine tests green (21 tests incl. the SG invariant, vs real reference data).
- [x] End-to-end pass (fresh accounts, dev server): sign up → NUX → play a round → summary
      matches the in-session live SG exactly → **edit a shot → SG recomputes** → verified
      persisted correctly in Supabase.
- [x] Offline scenario — already exhaustively verified in Milestone 10 (full 18-hole offline
      round, offline Finish, reload-recovers-a-draft).
- [x] RLS / per-user isolation: User B got a **404** on User A's round via direct URL; User B's
      Feed was empty. (RLS itself — not just app-level `userId` scoping — was verified enabled
      with per-user policies back in Task 02; this pass re-confirmed no leakage through the app.)
- [x] Mobile viewport pass — exercised throughout at 375×812 across this and prior milestones.
- [ ] Full accessibility audit — explicitly **out of scope** per user direction. One real bug
      found incidentally during the functional pass (below) was fixed since it also affected
      correctness, not just a11y; no further a11y work was done.

### Bug found and fixed during this pass

**Editing an earlier (non-holed) shot after the hole is already complete was silently broken.**
Tapping the shot correctly highlighted the row (`draft.editing` was set), but the entry dock kept
showing the "Hole complete" summary card instead of the edit form, because the dock's ternary
only checked `complete`, not whether an edit was in progress. Separately, even the underlying
`addShot`/`holeOut` reducer cases would have no-op'd on save: they gated on `nextStart(hole)`,
which returns `null` once _any_ shot in the hole is holed, regardless of which shot is being
edited.

Fixed by:

- `lib/round.ts`: added `startForIndex(hole, index)` — chains from Tee through the _preceding_
  shots only, so it works for an arbitrary shot index even after the hole is complete.
- `components/round/round-session.tsx`: the entry dock now shows the edit form whenever
  `state.draft.editing != null`, regardless of `complete`; `addShot`/`holeOut`/the render's
  `start` all use `startForIndex` when editing, `nextStart` otherwise.

Verified live: edited hole 1's tee shot (150→180 yd) after the hole was already holed out —
the edit form appeared, saved correctly, shot 2 re-chained its start to the new distance, hole
total SG stayed internally consistent (+0.99), and the change persisted to Supabase exactly as
shown on screen.

## Deploy — not started

- [ ] Decide: reuse the existing Supabase project as production (it already holds real user
      accounts — see `tasks/README.md` "Blocked-on-user") vs. provision a separate one.
- [ ] Deploy to **Vercel**; wire env vars (`NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `DIRECT_URL`).
- [ ] Verify PWA install + offline on the deployed URL from a real phone.
- [ ] Update `CLAUDE.md` (status, deploy notes, live URL if applicable).

## Acceptance criteria

- [ ] The deployed PWA supports a full offline round with correct SG and per-user data isolation.
