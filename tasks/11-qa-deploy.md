# 11 — QA & deploy

**Status:** not started
**Depends on:** all prior

## Goal

End-to-end verification and production deploy.

## Checklist

**QA**

- [ ] Engine tests green (incl. the SG invariant) — ideally against **real** reference data by now.
- [ ] End-to-end: sign up → NUX → play a round → summary matches a hand-computed SG sample →
      edit a shot → SG recomputes → data isolated per user (RLS).
- [ ] Offline scenario (Task 10 acceptance) passes.
- [ ] One-handed mobile pass on a real phone viewport; light-mode contrast in bright conditions.
- [ ] Basic a11y (labels, focus, target sizes) + error/empty/loading states.

**Deploy**

- [ ] Supabase production project; run migrations; verify RLS in prod.
- [ ] Deploy to **Vercel**; wire env vars; custom domain (optional).
- [ ] Verify PWA install + offline on the deployed URL from a phone.
- [ ] Update `CLAUDE.md` (status, commands, any deploy notes).

## Acceptance criteria

- The deployed PWA supports a full offline round with correct SG and per-user data isolation.
