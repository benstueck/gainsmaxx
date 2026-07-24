# 01 — Repo bootstrap

**Status:** done
**Depends on:** none

## Goal

Stand up the Next.js app skeleton with the toolchain, a **light-only** design system tuned for
on-course use (big targets, high contrast), and project hygiene. No features yet.

## Checklist

- [x] Init **Next.js 16 (App Router) + TypeScript + React 19**; strict TS config. _(create-next-app
      gave Next 16, current latest — a bump from the plan's "15".)_
- [x] Add **Tailwind CSS v4**; configure **light-only** (no dark variants) theme tokens in
      `app/globals.css`: fairway-green primary, SG positive/negative, high contrast, `--tap: 64px`.
- [x] shadcn foundation (cn util + cva/clsx/tailwind-merge/lucide) so `npx shadcn add` works later.
- [x] `BigButton` primitive (`components/ui/big-button.tsx`, min-height = tap target). _(Lie-selector,
      bottom-sheet, numeric keypad deferred to Task 06 where their behavior is defined.)_
- [x] Mobile-first layout + viewport meta (`viewportFit: cover`, theme-color) + `pb-safe`/`pt-safe`.
- [x] ESLint + Prettier (`.prettierignore`) + `tsconfig` path alias `@/*`.
- [x] Vitest (v3) + smoke test; scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `format`, `db:*`.
- [x] `.env.example` with Supabase placeholders; `.gitignore` keeps `.env.example` tracked.
- [x] README quickstart + `CLAUDE.md` Commands updated.

## Acceptance criteria

- [x] `npm run dev` serves a mobile-first landing page in light mode (verified in browser @375px).
- [x] `npm run lint`, `typecheck`, `test`, and `build` all pass.
- [x] `BigButton` renders at ≥ 64px on a phone viewport.
