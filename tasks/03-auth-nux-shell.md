# 03 — Auth, NUX & app shell

**Status:** done — verified end-to-end in the browser
**Depends on:** 02

## Goal

Sign-up / sign-in, first-run onboarding (handicap + units), and the authenticated **3-tab
bottom-bar** shell that everything else hangs off.

## Checklist

- [x] Supabase Auth email/password sign up + sign in + sign out via server actions
      (`app/auth/actions.ts`); `/auth/confirm` route handles the email-confirmation link.
      _(Google OAuth deferred.)_
- [x] Route protection: `(app)/layout.tsx` requires a session; `/`, `/login`, `/signup` redirect
      by auth state. Session refresh in `proxy.ts`.
- [x] **NUX** (`app/nux/`): set **username** (required) + **handicap** (0–54, validated) → writes
      `profiles`, then Feed. Units default to imperial (metric deferred, so no toggle yet).
- [x] **3-tab bottom bar** (`components/shell/tab-bar.tsx`, ≥ 64px, thumb zone, `pb-safe`):
  - [x] **Rounds** (left) — Feed placeholder (real cards in Task 08).
  - [x] **"+"** (center) — circular primary button → `/round/new` placeholder (real flow Task 06).
  - [x] **Profile** (right) — email + handicap + units + logout (stats/settings in Task 09).
- [x] Server components read the authed user (`lib/auth.ts` `requireUser`, `lib/supabase/server`).
- [x] Auth error/message + pending states via `useActionState`; light-mode styling.

## Acceptance criteria

- [x] Sign in → NUX → lands on Feed with handicap saved (12.4 persisted, shown on Profile).
- [x] Tab bar renders/navigates; **logout returns to `/login`**.
- [x] Protected routes (`/feed`) redirect to `/login` when signed out.

## Notes

- **Email confirmation is now OFF** in the Supabase project — signup creates a session
  immediately and flows straight to NUX (verified: signup → NUX → Feed with handicap saved). The
  app still supports confirmation-on mode (the "check your email" message + `/auth/confirm` route)
  if it's ever re-enabled.
- Signup trigger verified: a `profiles` row is auto-created on signup (handicap null → NUX).
