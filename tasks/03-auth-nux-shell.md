# 03 — Auth, NUX & app shell

**Status:** not started
**Depends on:** 02

## Goal

Sign-up / sign-in, first-run onboarding (handicap + units), and the authenticated **3-tab
bottom-bar** shell that everything else hangs off.

## Checklist

- [ ] Supabase Auth: email/password sign up + sign in + sign out (optional Google OAuth).
- [ ] Route protection: unauthenticated users only see the auth flow; authenticated users land in the shell.
- [ ] **NUX** (first sign-in): set **handicap** + **units**, write to `profiles`, then go to Feed.
- [ ] **3-tab bottom bar** (≥ 64px, thumb zone, safe-area aware):
  - [ ] **Feed** (left) — placeholder list (real cards in Task 08).
  - [ ] **"+"** (center) — entry point to New Round (real flow in Task 06).
  - [ ] **Profile** (right) — placeholder (real content in Task 09).
- [ ] Session handling on client + server (server actions read the authed user).
- [ ] Auth error/loading states; light-mode styling.

## Acceptance criteria

- New user can sign up → NUX → lands on Feed with handicap/units saved.
- Tab bar navigates between the three tabs; logout returns to auth.
- Protected routes redirect when signed out.
