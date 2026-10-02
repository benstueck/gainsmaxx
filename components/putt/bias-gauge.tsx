import { DivergingBar } from "@/components/ui/diverging-bar";
import type { BiasResult } from "@/lib/putt";

/**
 * One tendency gauge.
 *
 * The tilt always renders, so the raw counts are visible — but the *verdict*
 * only appears once the sample supports it. With ten misses a 6–4 split is the
 * single most likely outcome for a player with no tendency at all; calling that
 * a bias would send them to the practice green to fix a problem they don't
 * have, which is worse than saying nothing.
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
        ) : bias.significant ? (
          <span className="font-semibold text-foreground">
            Leans {bias.leaning === bias.sides[0] ? labels[0] : labels[1]} —
            clear enough at {bias.n} to act on.
          </span>
        ) : (
          <span className="text-muted">
            Not enough data yet — a split like this is ordinary at {bias.n}.
          </span>
        )}{" "}
        <span className="text-muted">({population})</span>
      </p>
    </div>
  );
}
