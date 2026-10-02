import { DivergingBar } from "@/components/ui/diverging-bar";
import type { BiasResult } from "@/lib/putt";

/**
 * One tendency gauge.
 *
 * Describing and diagnosing are deliberately separated, which they weren't at
 * first. "You missed left 5 of 5 today" is a *fact* and needs no statistics;
 * "you have a left bias" is a *claim* and does. Putting the significance gate
 * on both made the summary refuse to report something the player could plainly
 * see — 5 of 5 left reads as p = 0.063 and so went unmentioned entirely.
 *
 * So the count is always stated, and only the word "tendency" waits for the
 * evidence. The gate itself is unchanged: with ten misses a 6–4 split is the
 * single most likely outcome for a player with no tendency at all, and calling
 * that a bias would send them to fix a problem they don't have.
 *
 * `detects` and `population` are shown rather than implied. Three gauges draw
 * from deliberately different populations — the stroke gauge pools comebacks
 * where the read gauge can't — and a number is only honest if it says what it
 * measured and what it measured over.
 */
export function BiasGauge<T extends string>({
  title,
  detects,
  population,
  bias,
  labels,
}: {
  title: string;
  detects: string;
  population: string;
  bias: BiasResult<T>;
  /** Display names for the two ends, in the same order as bias.sides. */
  labels: readonly [string, string];
}) {
  const [a, b] = bias.counts;

  return (
    <div className="border-b border-border py-3 last:border-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted">{detects}</span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted">
          {labels[0]} {a}
        </span>
        <DivergingBar
          tilt={bias.tilt}
          fillClassName={bias.significant ? "bg-primary" : "bg-muted/40"}
        />
        <span className="w-12 shrink-0 text-xs tabular-nums text-muted">
          {b} {labels[1]}
        </span>
      </div>

      <p className="mt-1.5 text-xs">
        {bias.n === 0 ? (
          <span className="text-muted">No misses to read yet.</span>
        ) : bias.leaning == null ? (
          <span className="text-muted">
            Even at {bias.n}, no lean either way.
          </span>
        ) : bias.significant ? (
          <span className="font-semibold text-foreground">
            {Math.max(a, b)} of {bias.n}{" "}
            {bias.leaning === bias.sides[0] ? labels[0] : labels[1]}. Clear
            enough to act on.
          </span>
        ) : (
          <>
            {/* The fact first: it happened, and needs no statistics. Only the
                word "tendency" waits for the evidence. */}
            <span className="font-semibold text-foreground">
              {Math.max(a, b)} of {bias.n}{" "}
              {bias.leaning === bias.sides[0] ? labels[0] : labels[1]}.
            </span>{" "}
            <span className="text-muted">
              Not a tendency yet. Keep logging.
            </span>
          </>
        )}{" "}
        <span className="text-muted">({population})</span>
      </p>
    </div>
  );
}
