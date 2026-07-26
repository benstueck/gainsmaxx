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
- `app/profile/actions.ts` — **`updateProfileAction`**: one server action that validates and
  saves handicap, default baseline, username, and email (via `supabase.auth.updateUser`)
  together; **`updatePasswordAction`** stays separate (its own `supabase.auth.updateUser` call).
- `components/profile/settings-forms.tsx` — **`ProfileSettingsForm`** (all four fields, one
  submit) and **`PasswordForm`**. (An earlier per-field-button, then a per-field-autosave-on-blur
  design were both tried and rejected — autosave-on-blur didn't feel right on mobile web. This
  single-form-per-section shape is the one that stuck.)
- `app/(app)/profile/page.tsx` — two bordered sections, **Profile** (stats-adjacent settings,
  one "Save changes" button) and **Password** (its own "Update password" button). The
  `ProfileSettingsForm` is **keyed by its current server values** so a save re-syncs the
  (uncontrolled) fields immediately instead of flashing stale for one render — a
  `revalidatePath` + uncontrolled-input quirk, confirmed harmless via a direct DB read during
  the flash. No Units row — removed since there's no second unit system to switch to yet.

## Checklist

**High-level stats (lightweight)**

- [x] Rounds played, career **avg Total SG**, and per-category averages (OTT/APP/ARG/P) vs the
      user's resolved default baseline.
- [x] Kept modest — no trends/strengths (deferred to a later plan per the design doc).

**Settings**

- [x] **Profile** section: handicap, default baseline, username, email — one "Save changes"
      button for all four (verified: changed all four in one submit, all persisted).
- [x] Edit **handicap** re-interpolates baseline everywhere — verified stats/dropdown update live.
- [x] Edit **username** (also now captured at NUX; displayed as the Profile page header).
- [x] **Password** section: its own two-field form + "Update password" button — verified: logged
      out, signed back in with the new password.
- [x] **Log out** (unchanged, still present below settings).

## Acceptance criteria

- [x] Changing handicap updates displayed SG (stats, dropdown label) across the page immediately.
- [x] Settings persist to `profiles`; verified via direct DB read after each save.
- [x] Logout returns to `/login`; new password successfully signs back in.
