# 09 — Profile stats & settings

**Status:** not started
**Depends on:** 03, 07

## Goal

The Profile tab: lightweight high-level stats + account/preferences management.

## Checklist

**High-level stats (lightweight)**

- [ ] Rounds played, career **avg Total SG**, and per-category averages (OTT/APP/ARG/P) vs the user's baseline.
- [ ] (Deeper trends/strengths are a later plan — keep this modest.)

**Settings**

- [ ] Edit **handicap** (re-interpolates baseline everywhere).
- [ ] Edit **username** / email.
- [ ] **Change password**.
- [ ] **Units** (yd/ft default; meters deferred) + **default baseline**.
- [ ] **Log out**.

## Acceptance criteria

- Changing handicap updates displayed SG defaults across the app.
- Settings persist to `profiles`; logout returns to auth.
