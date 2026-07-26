# 09 — Profile stats & settings

**Status:** done — verified end-to-end in the browser
**Depends on:** 03, 07

## Goal

The Profile tab: lightweight high-level stats + account/preferences management.

## What landed

- `lib/baseline.ts` — shared `baselineOptions()` / `resolveBaseline()`, used by the round
  summary toggle, the Feed, and Profile stats so "which baseline" is consistent everywhere and
  matches what's stored in `profiles.default_baseline`.
- `lib/career-stats.ts` — pure `computeCareerStats(rounds)`: rounds played, avg total SG, avg
  per-category SG, over completed rounds only.
- `lib/db/queries.ts` — `updateHandicap`, `updateUsername`, `updateDefaultBaseline`.
- `app/profile/actions.ts` — server actions for handicap, username, default baseline, email
  (`supabase.auth.updateUser`), and password (`supabase.auth.updateUser`).
- `components/profile/settings-forms.tsx` — one small form per field (`useActionState`), each
  **keyed by its current server value** in `profile/page.tsx` so a save re-syncs the field
  immediately instead of flashing stale for one render (a known `revalidatePath` +
  uncontrolled-input quirk — confirmed via DB read that data was correct even during the flash).
- `app/(app)/profile/page.tsx` — career stats card + settings list; `app/(app)/feed/page.tsx`
  updated to use `resolveBaseline` instead of a hardcoded `handicap ?? "tour"`.

## Checklist

**High-level stats (lightweight)**

- [x] Rounds played, career **avg Total SG**, and per-category averages (OTT/APP/ARG/P) vs the
      user's resolved default baseline.
- [x] Kept modest — no trends/strengths (deferred to a later plan per the design doc).

**Settings**

- [x] Edit **handicap** (re-interpolates baseline everywhere — verified stats/dropdown update live).
- [x] Edit **username**. Email edit via `supabase.auth.updateUser({ email })`.
- [x] **Change password** (`supabase.auth.updateUser({ password })`) — verified: logged out,
      signed back in with the new password.
- [x] **Default baseline** picker (My handicap / Tour / Scratch..25) — feeds Feed + Profile stats + the round summary's initial toggle position.
- [x] **Units** shown as a fixed "Yards & feet" row (metric deferred per the design doc — no
      functional second option to build a toggle for yet).
- [x] **Log out** (already existed; still present below settings).

## Acceptance criteria

- [x] Changing handicap updates displayed SG (stats, dropdown label) across the page immediately.
- [x] Settings persist to `profiles`; verified via direct DB read after each save.
- [x] Logout returns to `/login`; new password successfully signs back in.
