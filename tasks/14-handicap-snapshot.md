# 14 — Snapshot handicap per round

**Status:** done (code) — browser verification of the edit flow outstanding
**Depends on:** 05 (SG engine), 07 (round summary), 09 (profile stats)

## The problem

Changing your handicap in Settings retroactively rewrites the strokes gained of **every past
round**. A round played off 12.5 and later viewed off 16 reports numbers that were never true,
so historical SG drifts as your handicap moves and the trend you'd most want to read — "am I
getting better?" — is the one thing it can't tell you.

Per the domain model, per-shot SG is always computed vs Tour; the handicap only enters as a
**round-level category adjustment** added back to the aggregate. So the stored shots are already
baseline-independent. **Nothing needs recomputing or migrating — only the baseline chosen at
read time is wrong.**

## Key finding: the database is already correct

`rounds.baseline_snapshot` **already exists and is already populated**:

```ts
// lib/db/schema.ts
// Handicap snapshot at play time (for reproducible baseline defaults).
baselineSnapshot: numeric("baseline_snapshot", { precision: 4, scale: 1 }),
```

```ts
// app/round/actions.ts — createRound()
baselineSnapshot: profile?.handicap ?? null,
```

Verified against production: all 5 rounds carry a snapshot, and the values genuinely vary
(12.5 ×4, then 13.5), so the write path works and has been capturing the change all along.

**The column is never read.** `grep baselineSnapshot` returns exactly two hits: the schema
definition and that one write. Every read path instead resolves the _current_ profile handicap:

| Read path                          | Today                                                |
| ---------------------------------- | ---------------------------------------------------- |
| `loadUserRounds(userId, baseline)` | One baseline applied to **all** rounds               |
| `app/(app)/feed/page.tsx`          | `resolveBaseline(profile.defaultBaseline, handicap)` |
| `app/round/[id]/summary/page.tsx`  | Passes current `handicap` into the summary           |
| `app/(app)/profile/page.tsx`       | Career stats aggregate summaries built that same way |

**So this is a read-path + display change, not a schema change.** No migration, no backfill, no
recompute. That is a much smaller job than it looks.

## Plan

### 1. Read path — use each round's own snapshot

- [x] `lib/db/round-queries.ts`: change `loadUserRounds(userId, baseline)` so the second argument
      is a **fallback**, and each round resolves its own baseline from
      `round.baselineSnapshot ?? fallback`. Rounds are already mapped individually, so this is a
      per-round resolve inside the existing `.map()` — no extra queries.
- [x] Surface the snapshot on the returned types: add `handicapSnapshot: number | null` to
      `FeedRound`, and expose `round.baselineSnapshot` through `LoadedRound` (it already returns
      the whole row, so it's available — it just needs to be read).
- [x] Fallback order when a snapshot is null (only possible for a round created while the profile
      had no handicap set): **current handicap → Tour**. Same as today's behaviour, so nothing
      regresses.

### 2. Round summary — snapshot is the default, toggle becomes an override

- [x] `app/round/[id]/summary/page.tsx` passes the round's snapshot as the default baseline
      instead of the current profile handicap.
- [x] `components/round/round-summary.tsx`: the baseline toggle **stays**, but its "my handicap"
      option means _the handicap this round was played off_, labelled with that number. Changing
      it is an explicit, temporary "what if" — it must not write anything.
- [x] Make the default visibly the snapshot, so the number on screen is reproducible months later.

### 3. Career stats — aggregate each round at its own baseline

- [x] `app/(app)/profile/page.tsx` + `lib/career-stats.ts`: `computeCareerStats` already just
      aggregates pre-computed per-round summaries, so once step 1 lands each round contributes at
      its own snapshot automatically. **Confirm, don't rebuild.**
- [x] Decide and document what the career average now means: "how I played relative to my ability
      at the time", rather than every round re-scored against today's handicap.

### 4. Display the handicap index

- [x] **Round summary**: the index sits with the secondary actions (paired with Delete round,
      divider between), not in the header — it's reference detail you occasionally correct, not a
      headline number, and the baseline selector already states it at the top of the card.
- [x] **Feed card**: compact, on the existing date / holes line — reads `· 12.5 index`.
- [x] Null snapshot renders as `HCP —` (or is hidden) rather than a misleading `0`.
- [x] Wording: **`12.5 index`** on the card and the action. The baseline dropdown keeps
      `Played off (12.5)` — among `Scratch (0)` and `10 handicap` it has to say whose baseline it
      is, where the standalone label doesn't.

### 5. Guard the invariant

- [x] `saveRound` / edit flows must **never** rewrite `baseline_snapshot` — verify, since editing
      a past round currently touches holes and shots only.
- [x] Unit test in `lib/career-stats.test.ts` (or a new `round-queries` test): two rounds with
      different snapshots must produce different per-round summaries from the same shot data, and
      changing the profile handicap must not move either.

## Decisions confirmed with the user

| Question        | Decision                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Correcting it   | **Editable from the round summary** — you often set your index after the fact, so a stale snapshot must be fixable                           |
| Baseline toggle | **Kept as a temporary override**, defaulting to the snapshot; changing it writes nothing                                                     |
| Career stats    | **Mixed per-round snapshots** — the career average means "how I played relative to my ability at the time", which is the point of the change |

### 6. Editing a round's snapshot

- [x] `updateRoundHandicap(roundId, handicap)` server action in `app/round/actions.ts` —
      ownership-checked like the other round mutations, accepts null to clear, and validates the
      same range/precision as the profile field (`numeric(4,1)`).
- [x] Edit affordance on the round summary next to the displayed index. Reuse the existing
      numeric input conventions rather than inventing a new control.
- [x] **Must go through `useOfflineGuard`** — it's a server mutation, so offline it shows the
      modal rather than failing. Same treatment as Delete round.
- [x] Nothing is recomputed on save: SG is derived at read time, so the summary simply re-renders
      against the new baseline. Confirm the Feed card and career stats pick it up on next load.
- [x] Editing the snapshot must **not** touch `profiles.handicap` — correcting one round is not a
      statement about your current index.

## Acceptance criteria

- [x] Changing the handicap in Settings leaves every past round's SG **numerically unchanged**.
- [x] Each round displays the handicap index it was played off.
- [x] A new round still snapshots the current handicap at creation (unchanged behaviour).
- [x] Career stats aggregate per-round snapshots, and don't move when the profile handicap moves.
- [x] No migration required; existing production rounds keep their already-correct snapshots.
- [x] A round's snapshot can be corrected from its summary, which changes that round's SG and the
      career aggregate but leaves `profiles.handicap` and every other round untouched.
- [x] Editing the snapshot while offline shows the modal instead of erroring.

## Outcome, measured against production data

Scoring each of ben's completed rounds both ways — off its snapshot, and off the current index
(13.3) the way the app did before:

| Date   | Played off | SG @ snapshot | SG @ current | Drift     |
| ------ | ---------- | ------------- | ------------ | --------- |
| Aug 12 | 13.5       | −3.97         | −4.15        | −0.18     |
| Aug 09 | 12.5       | −4.73         | −4.00        | **+0.72** |
| Aug 06 | 12.5       | **−0.55**     | **+0.18**    | **+0.72** |
| Jul 26 | 12.5       | −6.94         | −6.22        | **+0.72** |

**1.99 SG of phantom improvement** was being applied to history by a 1.0 handicap change. Aug 06
is the sharpest illustration: a round that genuinely _lost_ half a stroke was being displayed as
having _gained_ a fifth of one — the sign itself was wrong.

Confirmed in the browser against the real account: every Feed card now reads `· off 12.5`, the
Aug 06 summary reads **−0.55** where it previously read **+0.18**, and the figures match the
engine exactly.

## Notes

- **No migration, no backfill.** `rounds.baseline_snapshot` already existed and was already being
  written by `createRound`; it was simply never read. This was a read-path bug end to end.
- The pure logic lives in `lib/baseline.ts` (`parseHandicapSnapshot`, `resolveRoundBaseline`)
  rather than `lib/db/round-queries.ts`, which is `server-only` and therefore untestable. 10 tests
  in `lib/baseline.test.ts`.
- **A trap the tests caught:** `Number("")` is `0`, not `NaN`, so a blank snapshot parsed as
  **scratch** — the harshest possible baseline — instead of "absent". `parseHandicapSnapshot`
  rejects blanks before converting. The same test file pins `0` as a _real_ index distinct from
  null, guarding the `??` vs `||` version of the same mistake.
- Only `createRound` (insert) and `updateRoundHandicap` ever write the column; `saveRound` touches
  `updatedAt` and `finishRound` touches `status`, so editing a past round can't disturb its
  baseline.
