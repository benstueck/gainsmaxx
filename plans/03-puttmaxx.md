# Design Plan — Puttmaxx (practice-green putting training)

**Status:** design agreed, not yet built
**Task checklist:** [`../tasks/15-puttmaxx.md`](../tasks/15-puttmaxx.md)
**Precedent:** [`02-wedgemaxx.md`](02-wedgemaxx.md) — same session → attempts → summary shape.

## Context

Modelled on The Stack's putting system. The app deals a simulated round of putts; for each one it
calls a **distance, elevation and break** ("8 ft, uphill, left-to-right"). You find a matching putt
on a practice green, hit it, and report what happened. Scored in **strokes gained**.

Practice green only — tracking putts during a real round is explicitly out of scope.

## Why this is cheap to build well

Unlike Wedgemaxx, **there is no calibration work**. `lib/sg/`'s putting table already gives
expected putts from any distance in feet, so strokes gained falls straight out:

```
SG(hole) = expectedPutts(distance) − puttsTaken
```

That table is the Tour baseline, so **a session total of 0.00 means you putted like a Tour pro**.
No invented scale, no reference curve to derive — which is exactly why Puttmaxx reports raw SG
where Wedgemaxx needed points.

## Choosing the distance range

From the Tour putting table (`data/benchmarks/v1/benchmarks.json`):

| Distance | Expected putts | ≈ Make % |
| -------- | -------------- | -------- |
| 4 ft     | 1.13           | ~87%     |
| 5 ft     | 1.23           | ~77%     |
| 6 ft     | 1.34           | ~66%     |
| **8 ft** | **1.50**       | **~50%** |
| 10 ft    | 1.61           | ~39%     |
| 12 ft    | 1.68           | ~32%     |
| 15 ft    | 1.78           | ~24%     |
| 20 ft    | 1.87           | ~15%     |

**Default 5–12 ft**, customizable at setup like Wedgemaxx.

The reasoning is about _information_, not difficulty. 8 ft is a coin flip, and a coin flip produces
the most misses per putt attempted — and misses are the only thing that feeds the bias analytics.
Below 5 ft you hole ~80%+, so an 18-putt session yields ~3 misses, far too few to separate a real
left bias from noise. Above ~15 ft the drill quietly becomes lag putting, where holing out isn't
the goal and the 3×3 grid stops describing the skill being trained.

## Capture model

### The 3×3 grid

The core interaction, lifted from The Stack. One tap records **two independent error axes**:

|          | Left      | —        | Right      |
| -------- | --------- | -------- | ---------- |
| **Fast** | Fast Left | Fast     | Fast Right |
| **—**    | Left      | **Made** | Right      |
| **Slow** | Slow Left | Slow     | Slow Right |

Vertical = speed error, horizontal = line error. Either can be null (a pure line miss has correct
speed). This decomposition is what makes "you leak putts left" computable.

### Misread flags

Two independent toggles — **misread line** and **misread speed** — rather than one. They separate
_"I read it wrong"_ from _"I read it right and stroked it badly"_, which need entirely different
practice. Keeping them independent matches the two error axes and lets a Slow-Left miss be logged
as a speed misread with a sound stroke, which one combined flag couldn't express.

These are **self-reported**, where the read-bias gauge is **measured**. That makes them worth
keeping even though they overlap: the interesting case is disagreement. Consistently missing on the
low side while never flagging a misread means you're misreading and don't know it, which is a far
more useful finding than either signal alone.

### What happens after a miss

Per The Stack (confirmed via community docs), a missed putt logs the miss, the **comeback
distance**, and the comeback's outcome.

**The comeback is a putt, so it is a data point.** In an 18-putt session you'll miss roughly ten
first putts, which means ten comebacks — treating those as a mere yes/no throws away a sample
roughly the size of the session itself. Since bias detection is sample-starved (see the noise
section below), that's the most expensive thing we could do.

So the comeback is captured on **the same 3×3 grid**, tagged as a comeback. The cost of this is
zero: a miss was always going to be three taps.

| Step | Yes/no comeback   | 3×3 comeback       |
| ---- | ----------------- | ------------------ |
| 1    | first putt → 3×3  | first putt → 3×3   |
| 2    | comeback distance | comeback distance  |
| 3    | holed? **y/n**    | comeback → **3×3** |

Identical interaction cost, roughly double the data. A missed comeback is a 3-putt and the hole
ends there — a third putt's direction isn't captured.

**Comeback distance is still needed**, and for a subtler reason than the outcome. It is _not_ used
by the hole's SG:

```
SG(hole) = expectedPutts(8 ft) − puttsTaken        ← comeback distance absent
```

It's what lets the **first putt be scored on its own**:

```
SG(first putt) = expectedPutts(8 ft) − 1 − expectedPutts(comebackDistance)
```

A miss leaving a tap-in and a miss running 6 ft past are the same "2 putts" to the hole score, but
they are not remotely the same stroke — only the per-putt figure separates them. It's the direct
analogue of proximity in Wedgemaxx. Because hole SG doesn't depend on it, **coarse entry is fine**:
quick-tap buckets beat a keypad when you're holding a putter.

### The comeback's break: derive, don't store

A missed uphill-L2R putt does leave a roughly downhill-R2L comeback, and on a planar practice green
that inference holds up. But it should be **derived at read time, never written to a row** — the
same discipline that keeps points and putts-taken out of the database. A modelled value sitting in
a column is indistinguishable from a measured one six months later, and this one is modelled on an
assumption (a planar green) that real greens violate.

It also carries less weight than it first appears: comebacks here are typically 1–5 ft, where break
barely moves the ball. The useful signal from a comeback is the **absolute** left/right miss, which
needs no break label at all. Break-relative analysis ("you under-read L2R putts") stays a
first-putt metric, where the putts are long enough for the read to matter.

### Putts per hole

1 (made) · 2 (comeback holed) · 3 (comeback missed). **Four-putts aren't representable**, which is
an accepted simplification inside 15 ft.

### Express mode

The Stack offers a mode that logs only made/missed. Worth having as a setup toggle for fast
sessions, at the cost of first-putt SG and lag analytics. Optional, off by default.

## The entry loop

```
Putt 7 of 18        0:42 · −0.31 SG          ⋯

        8 ft · Uphill · Left → Right

   ┌───────────┬───────────┬───────────┐
   │ Fast Left │   Fast    │ Fast Right│
   ├───────────┼───────────┼───────────┤
   │   Left    │  MADE!    │   Right   │
   ├───────────┼───────────┼───────────┤
   │ Slow Left │   Slow    │ Slow Right│
   └───────────┴───────────┴───────────┘
        ☐ misread line   ☐ misread speed

   [ scrollable history of previous putts ]
```

On a miss the grid is replaced by a two-step follow-up — comeback distance, then the **same 3×3
grid** for the comeback — then the loop returns. **1 tap for a make, 3 for a miss.**

Layout follows the lessons already paid for in Wedgemaxx: `h-dvh` (a _definite_ height, not
`min-h-*`), controls pinned, history scrolling independently.

## Summary analytics

Where the system earns its keep. From ~18 putts:

- **Total SG** and SG per putt, vs Tour
- **Putt distribution** — 1-putts / 2-putts / 3-putts
- **Make %**, overall and by distance band (reusing the Wedgemaxx `distanceBreakdown` shape)
- **Miss map** — the 3×3 grid as a heatmap, counts and percentages
- **Three bias gauges** — direction, speed, read (below)
- **Misread counts**, line and speed, held separate
- **Average comeback distance** — lag quality on missed putts

### Two directional faults, not one

The single most important analytical decision here. A naive "direction bias" gauge pooling absolute
left/right misses **erases the most common amateur fault**.

Say you systematically under-read break:

- on an **L2R** putt the low side is the **right** → you miss right
- on an **R2L** putt the low side is the **left** → you miss left

Pooled into one absolute gauge, those **cancel**, and a golfer with a severe, consistent read fault
reads as perfectly neutral. That isn't noise swamping the signal — it's the metric subtracting the
signal from itself.

So direction splits in two, because left/right and high/low measure genuinely different faults:

| Gauge              | Frame                 | Detects                                       | Population                       |
| ------------------ | --------------------- | --------------------------------------------- | -------------------------------- |
| **Direction bias** | Absolute left / right | **Stroke** — face and path. A pull is a pull. | All putts                        |
| **Read bias**      | High side / low side  | **Read** — under- or over-reading the break   | First putts, breaking putts only |
| **Speed bias**     | Fast / slow           | Pace control                                  | All putts                        |

Separated this way, the absolute gauge _correctly_ ignores read errors (they average out) and
isolates the stroke — but only if the sample is balanced, which is a constraint on the generator,
not the analytics. See below.

"Low side" is the amateur side for a reason: under-reading is the dominant read fault, so this is
the gauge most likely to find something real.

### Which putts feed which number

Comebacks are not a random sample: they're short, and they exist only _because_ you missed. So each
figure states its population:

| Number                | Population                | Why                                                                             |
| --------------------- | ------------------------- | ------------------------------------------------------------------------------- |
| Make %, miss map      | **First putts**           | Comparable session to session; matches The Stack's "1st Putt" panel             |
| Direction, speed bias | **All putts**             | A 3 ft comeback barely breaks, so it's the _purest_ face-angle signal available |
| Read bias             | **First putts, breaking** | Comeback break is inferred and tiny — noise with no signal                      |
| SG, putt distribution | **All putts**             | They're strokes; they count                                                     |

Comebacks are therefore not contamination for the stroke gauge — they're its cleanest input, and
they roughly double its sample. They are excluded from the read gauge for exactly the same reason:
at 3 ft there is almost no read to get wrong.

### Bias must be honest about noise

With 10 misses, 6 left and 4 right is **nothing** — it's what a perfectly neutral stroke produces
most of the time. Reporting that as "you have a left bias" would be astrology, and it's the failure
mode that makes training apps untrustworthy.

So a bias is only _called_ when the split clears a binomial threshold at the observed sample size;
below that the gauge still renders but reads **"not enough data yet"**. This matters more than any
other analytic here, because a falsely-detected bias sends you to the practice green to fix a
problem you don't have.

## Generating a fair sample

The analytics above impose a requirement back onto the putt generator, which is easy to miss:

**Break directions must be balanced by construction** — a shuffled deck of L2R / R2L / straight,
not independent random draws per putt. With 18 independent draws it's entirely ordinary to get 11
L2R and 4 R2L, and in that session a pure _read_ fault leaks into the _direction_ gauge as a fake
stroke bias. The user then goes and rebuilds a stroke that was never broken.

Balancing costs nothing and removes the failure mode at the source, which is the right place: no
amount of care in the analytics can recover from a skewed sample.

The same argument applies more weakly to elevation (uphill/downhill vs speed bias), so that deck is
balanced too.

## Data model

Two tables, mirroring `wedge_sessions` / `wedge_shots`.

**`putt_sessions`** — `putt_count`, `min_distance`, `max_distance` (feet), `call_slope_break`,
`express_mode`, `elapsed_seconds`, `status`, plus **`putts` (jsonb)**: the full pre-rolled sequence.

Pre-rolling matches Wedgemaxx and for the same reason: a reload or force-quit must hand back the
_same_ putt rather than re-rolling it, and the offline layer gets the sequence for free. `jsonb`
rather than three parallel arrays because distance/elevation/break travel together and parallel
arrays can drift out of sync.

**`putt_attempts`** — one row per hole: `target_distance`, `elevation`, `break_direction`,
`made`, `speed_error` (fast/slow/null), `line_error` (left/right/null), `misread_line`,
`misread_speed`, then the comeback — `comeback_distance`, `comeback_made`,
`comeback_speed_error`, `comeback_line_error`.

The comeback's **break and elevation are deliberately absent**: derived at read time if ever
needed, never stored (see above).

**High/low side is likewise derived, never stored** — it's a pure function of `line_error` and
`break_direction` (low side is right on an L2R putt, left on an R2L). Storing it would duplicate
state that could drift, and the rule can be corrected later without rewriting history.

**Putts taken is derived, never stored** — same discipline as Wedgemaxx points, so the rule can be
corrected later without rewriting history.

## Architecture

- `lib/putt/` — pure, framework-free, like `lib/sg/` and `lib/wedge/`. Generator, SG, analytics.
- Offline-first from the start: Dexie `puttDrafts` (schema v3), local-first save/finish, the
  cache-warming and offline-guard rules already established.
- `/puttmaxx` becomes the **fourth tab**: Gainsmaxx · Wedgemaxx · Puttmaxx · Profile.

## Open design question

**Which baseline?** SG is computed vs Tour, since that's what the table is. For an amateur every
session will read negative, which is honest but blunt. The round summary already has a baseline
selector, and `handicapAdjustments` carries a PUTT category — but those adjustments are defined
_per 18 holes of golf_, so applying them to a putting-only drill would be inventing a number.
Recommendation: **ship vs Tour**, show make % alongside as the relatable metric, and revisit a
selector once there are real sessions to look at.

## Out of scope for v1

- Tracking putts during a real round (The Stack does this; explicitly excluded)
- Lag/distance-control mode beyond ~15 ft — a different skill needing a different capture
- Green-speed (stimp) input
- Audio readout, voice entry and pocket mode — The Stack has all three, and the hands-full
  ergonomics are real, but they're a layer on top of a loop that has to work first
