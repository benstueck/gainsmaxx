# 10 — Offline-first & PWA

**Status:** not started
**Depends on:** 06 (data flows exist to make offline)

## Goal

Make the whole round-capture experience work with **zero signal** and sync when reconnected —
the non-negotiable on-course requirement.

## Checklist

- [ ] **Serwist** service worker + web manifest; installable PWA (icons, name, light theme-color).
- [ ] Precache app shell + **benchmark JSON** so SG computes offline.
- [ ] **Dexie (IndexedDB)** local store for rounds/holes/shots; the tracking session is local-first.
- [ ] Client-generated `client_uuid` on create for idempotent sync.
- [ ] **Sync layer:** queue local mutations; flush to Supabase (server actions) on reconnect;
      **last-write-wins** by `client_uuid` + `updated_at`.
- [ ] Online/offline + "pending sync" indicators in the UI.
- [ ] Reconciliation on app open (pull server changes, merge).

## Acceptance criteria

- DevTools **offline** → complete a full 18-hole round → reconnect → all data syncs to Supabase, no loss.
- Installed PWA opens offline with app shell + working SG.
- No duplicate rounds after repeated syncs (idempotency holds).
