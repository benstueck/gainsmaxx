# Design Plan — Wedgemaxx (wedge distance-control training)

Second design plan (after [`01-design.md`](01-design.md)). This is the feature that turns the app
from "a strokes-gained round tracker" into a golf-performance platform with multiple modes — and
is why the app was renamed **Gainsmaxxing → Gainsmaxx**.

## Context

Range practice with wedges is usually unmeasured: you hit balls at a flag and eyeball it.
**Wedgemaxx** turns that into a scored drill. The app calls out a random target yardage, you hit
a shot, you enter the **carry distance**, and it scores the shot in points derived from strokes
gained. Inspired by [Stack Wedging](https://www.thestacksystem.com/pages/stack-wedging), which
maps its Stack Points from SG data with tour = 200 points _at any target distance_ — that
per-distance normalization is the key idea we adopt.

Unlike round tracking, the only measurement available is **carry distance**. There is no lateral
dispersion data, so the whole model is one-dimensional. That constraint drives the scoring design
below.

## Scoring model

### Per-shot geometry

```
error  = |target − carry|                             yards
prox   = max(error, 1)                                yards — floor, see below
end    = prox ≤ 30 ? Exp(green, prox × 3 ft)
                   : Exp(fairway, prox yd)
sgRaw  = Exp(fairway, target) − end − 1
```

- **Start lie is always `fairway`** (range turf/mat).
- **The 1-yard floor matters.** Without it, an exact carry means proximity 0 → holed →
  `Exp(end) = 0`. At 130 yd that scores 194 points while being 1 yard off scores 142 — a
  **52-point cliff on a single yard**. Since carries are entered as whole numbers, exact hits are
  common enough that they'd dominate a session average. The floor makes a perfect number a 3-ft
  tap-in instead of a hole-out.
- **The 30-yard lie switch matters.** The putting table ends at 90 ft (= 30 yd), so a green-only
  model scores a 30-yard miss and a 40-yard chunk _identically_. Switching to the fairway table
  beyond 30 yards keeps the curve monotonic. The boundary is nearly continuous —
  `green@90ft = 2.400` vs `fairway@30yd = 2.500`, a 0.1-stroke step — and 30 yards is already
  `ARG_MAX_YARDS` in the SG engine, so it's conceptually consistent too.

### Per-distance calibration (the important part)

Raw SG is **not** a fair score here. `sgRaw = 0` means "you finished at tour-average _total_
proximity" — but total proximity includes a lateral miss you physically cannot make on a range.
Grading a 1-D outcome on a 2-D benchmark flatters the player, and unevenly: uncalibrated, a tour
player scores 111 from 50 yd but only 106 from 140 yd.

We need tour's **distance-only** error. Derive it from our own benchmark data plus one geometric
assumption — no external dataset required:

- `P_tour(target)` = the proximity at which `sgRaw = 0` (solve numerically). This is tour-average
  total proximity, already implied by the SG table.
- For an isotropic 2-D Gaussian miss, mean radial distance = `1.253σ` per-axis. So
  **`σ_tour(target) = P_tour(target) / 1.253`**.

Sanity check against published data — this yields tour distance errors of **2.4 yd @ 50**,
3.2 @ 90, 4.4 @ 130, **5.0 yd @ 140**, matching the reported
[3–5 yard tour wedge dispersion](https://www.scoringzone.net/blog/golf-wedge-distances-chart.html).

**Anchor: PGA Tour average = 100 points at every target distance.**

```
ref(target) = E[ sgRaw(target, e) ]  where e ~ N(0, σ_tour(target))
points      = 100 + 50 × (sgRaw − ref(target))
```

> **Retuned after real use.** This originally anchored on _scratch_
> (`σ = 1.5 × σ_tour`), which real sessions showed was far too generous — breaking 100 was easy,
> which drains the number of meaning. Anchoring on tour makes 100 genuinely hard: you have to
> out-control a tour pro distance-wise. Because points are always derived and never stored,
> flipping the constant re-scored every historical session automatically.

**Use the expectation, not the score at the mean error.** The points curve is convex, so a
player's session average is ~7 points higher than their score at their average error. Calibrating
on `E[sgRaw]` makes the anchor exact by linearity of expectation.

### Expected results (simulated, 40 balls, targets 50–140)

| Tour    | Scratch | Low single digit | Mid handicap | High handicap |
| ------- | ------- | ---------------- | ------------ | ------------- |
| **100** | 93      | 88               | 81           | 76            |

Single-shot values (tour anchor):

| Miss   | 50 yd | 90 yd | 140 yd |
| ------ | ----- | ----- | ------ |
| 0 yd   | 116   | 121   | 129    |
| 5 yd   | 79    | 84    | 92     |
| 10 yd  | 69    | 74    | 82     |
| 20 yd  | 58    | 62    | 70     |
| 40 yd  | 38    | 43    | 51     |
| Mishit | 36    | 34    | 35     |

Smooth, monotonic, never negative.

**50 points per stroke gained** is a pure aesthetic knob — it scales spread without changing
signal-to-noise. It lives as a single named constant so it's trivial to retune.

### Mishits (shanks, tops, duffs)

A shank sideways into the net has no measurable carry, and even when it does, a topped ball says
nothing about your distance calibration. Both problems need solving: you need a **one-tap escape
hatch** to log the ball and keep the range rhythm, and the stats need to keep strike quality
separate from distance control.

A mishit is defined as **zero progress** — the ball ends as far from the pin as it started, so
`Exp(end) = Exp(start)` and the shot is worth exactly **one wasted stroke** (`SG = −1`). Three
properties make this the right definition:

- It's principled, not an arbitrary penalty — it's literally what a top or duff does.
- It lands ~41 points at every target, always **below the worst realistic distance miss**
  (a 40-yard miss scores 45–57). So marking a merely-bad shot as a mishit is never the cheap way
  out — **the escape hatch cannot be gamed**.
- It costs ~1.5 points off a 40-ball average: noticeable, not session-ruining.

A mishit **counts as a ball hit** and drags the average down, but is **excluded from bias and
spread** (folding one in as a huge "short" miss would poison the coachable number). **Mishit rate**
becomes its own strike-quality stat alongside distance control.

In the data model, `carry_distance` is **nullable, and null _is_ the mishit flag** — a single
source of truth, so a shot can never be in the contradictory state of being flagged a mishit while
also carrying a distance. `deltaYd` is likewise `null` rather than `0` for a mishit, so it can't
be silently averaged into the distance-control stats.

### Why derive points instead of storing them

Only `target_distance` and `carry_distance` are persisted; points are always recomputed by the
pure engine, exactly like round SG is recomputed in `lib/db/round-queries.ts`. If the calibration
constant is ever retuned, all historical sessions re-score consistently instead of drifting.

## Navigation change

The 3-tab bar changes meaning:

| Tab        | Before        | After                                                    |
| ---------- | ------------- | -------------------------------------------------------- |
| **Left**   | Feed (rounds) | Feed (rounds) — **starting a round moves to a "+" here** |
| **Middle** | "+" new round | **Wedgemaxx** — session feed + entry point               |
| **Right**  | Profile       | Profile (unchanged, gains a Wedgemaxx stats block)       |

## Wedgemaxx UX

**Tab → session feed.** Newest-first list of sessions, in-progress pinned at top as "Continue",
matching `FeedCard`'s visual treatment. A "+" starts a new session.

**Setup screen.** Three parameters, all editable, defaults remembered from the last session:

- Number of balls — default **40**
- Min distance — default **50 yd**
- Max distance — default **140 yd**

**Session screen.**

- Elapsed **timer** (informational only; pauses when you back out).
- **Ball X of N**.
- A large **target yardage** — uniform random whole yards in `[min, max]`, never repeating the
  immediately-preceding target. The whole sequence is **rolled once when the session is created**
  and stored on the session row, so a reload or a force-quit hands back the _same_ yardage rather
  than re-rolling it (which was both unsettling mid-swing and mildly exploitable), and the
  offline layer gets the targets without needing the server. Stored as a list rather than derived
  from a seed, so the numbers can't shift if the RNG implementation ever changes.
- An **always-visible custom numeric keypad** (`NumericKeypad`, shared with round tracking) —
  explicitly **not** the OS keyboard. The native keyboard shifts the viewport and covers the
  target yardage you're aiming at, and stays open across balls so you can't see the next target.
- A **Mishit** button beside it — one tap to log a shank/top you can't measure, and move on.
- Submitting scores the shot and advances to the next ball with a new target.
- Previous shots listed underneath as rows: target, carry, signed delta, proximity, points.
  **Tap any row to edit** a mistyped carry; points recompute.
- **⋯ menu** (top right): **End session** (finish early — the range ran out of balls on ball 38;
  scores over shots actually taken) and **Discard session** (delete entirely, with confirmation).
  Backing out just pauses.

**Summary screen.** Hero **average points**, plus balls hit, duration, best/worst shot,
**mishit rate**, and — the genuinely coachable number — **average signed bias** (are you
systematically short?). A per-distance-bucket breakdown (short/mid/long) is a natural stretch,
mirroring Advanced Stats.

## Data model

Two new tables, same RLS + per-user isolation pattern as `rounds`/`holes`/`shots`:

- `wedge_sessions` — `user_id`, `client_uuid`, `started_at`, `status` (in_progress|complete),
  `ball_count`, `min_distance`, `max_distance`, `elapsed_seconds`, `targets` (**the pre-rolled
  yardage sequence**), timestamps.
- `wedge_shots` — `session_id`, `shot_number`, `target_distance`, `carry_distance` (**nullable —
  null means mishit**), timestamps.

## Architecture

- **`lib/wedge/`** — pure, dependency-free scoring engine, same discipline as `lib/sg/` (no
  framework/IO imports) so it runs identically offline on the client and on the server.
  The `ref(target)` curve is expensive to integrate per-shot, so it's computed once over a coarse
  grid at module init and interpolated.
- **Offline-first**, reusing the Dexie draft-queue + retry-on-reconnect pattern from
  `lib/offline/`. Requires a Dexie **version 2** migration adding a `wedgeDrafts` table without
  disturbing the existing `roundDrafts`.
- Starting a _new_ session needs connectivity (it creates the server row), same limitation as
  starting a new round; an in-progress session survives signal loss.

## Out of scope for v1

Launch-monitor integration, lateral dispersion, club selection/tagging per shot, difficulty
progression or adaptive targets (Stack's "100 challenge levels"), head-to-head compete, and
Wedgemaxx contributing to on-course SG stats.
