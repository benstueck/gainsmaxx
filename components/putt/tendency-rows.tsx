import { cn } from "@/lib/utils";
import { DivergingBar } from "@/components/ui/diverging-bar";
import type { BiasResult } from "@/lib/putt";

type Row<T extends string> = {
  title: string;
  bias: BiasResult<T>;
  /** Display names for the two ends, in the same order as bias.sides. */
  labels: readonly [string, string];
};

/**
 * One tendency, shown as a proportion rather than a verdict.
 *
 * The earlier version gated the *whole row* behind statistical significance,
 * so a player whose misses were 78% low read "not enough data yet" and learned
 * nothing. That was the wrong trade: the share is a fact about putts they
 * actually hit, and seeing their own trends is most of why the mode exists.
 *
 * So the number is always stated, and the badge marks the ones the sample
 * genuinely supports. Describing is free; claiming still costs evidence.
 */
function TendencyRow<T extends string>({ title, bias, labels }: Row<T>) {
  const leaningLabel =
    bias.leaning == null
      ? null
      : bias.leaning === bias.sides[0]
        ? labels[0]
        : labels[1];

  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">
          {title}
          {bias.n > 0 && (
            <span className="ml-1.5 text-xs font-normal text-muted">
              {bias.n}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          {bias.n === 0 ? (
            <span className="text-sm text-muted">No misses yet</span>
          ) : leaningLabel == null ? (
            <span className="text-sm text-muted">Even</span>
          ) : (
            <span className="text-sm tabular-nums">
              <span className="font-bold">{Math.round(bias.share * 100)}%</span>{" "}
              {leaningLabel.toLowerCase()}
            </span>
          )}
          {bias.significant && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
              Trend
            </span>
          )}
        </span>
      </div>
      <DivergingBar
        tilt={bias.tilt}
        className="mt-1.5 h-2"
        fillClassName={bias.significant ? "bg-primary" : "bg-muted/50"}
      />
    </div>
  );
}

/**
 * The three tendency gauges. Shared by the session summary and the Profile
 * career block so one glance reads the same in both places.
 */
export function TendencyRows({
  direction,
  read,
  speed,
  className,
}: {
  direction: BiasResult<"left" | "right">;
  read: BiasResult<"high" | "low">;
  speed: BiasResult<"fast" | "slow">;
  className?: string;
}) {
  return (
    <div className={cn("divide-y divide-border", className)}>
      <TendencyRow
        title="Direction"
        bias={direction}
        labels={["Left", "Right"] as const}
      />
      <TendencyRow title="Read" bias={read} labels={["High", "Low"] as const} />
      <TendencyRow
        title="Speed"
        bias={speed}
        labels={["Fast", "Slow"] as const}
      />
    </div>
  );
}

/**
 * One-line snapshot for a session card: the strongest leans, strongest first.
 *
 * Only leans worth a glance are listed (a 55% split is noise on a card), and
 * nothing renders when there's nothing to say, so a card never carries a row
 * of meaningless percentages.
 */
export function TendencySnapshot({
  direction,
  read,
  speed,
}: {
  direction: BiasResult<"left" | "right">;
  read: BiasResult<"high" | "low">;
  speed: BiasResult<"fast" | "slow">;
}) {
  const label = <T extends string>(
    b: BiasResult<T>,
    names: readonly [string, string],
  ) =>
    b.leaning == null
      ? null
      : (b.leaning === b.sides[0] ? names[0] : names[1]).toLowerCase();

  const leans = [
    { b: speed as BiasResult<string>, name: label(speed, ["fast", "slow"]) },
    { b: read as BiasResult<string>, name: label(read, ["high", "low"]) },
    {
      b: direction as BiasResult<string>,
      name: label(direction, ["left", "right"]),
    },
  ]
    .filter((x) => x.name != null && x.b.n >= 3 && x.b.share >= 0.6)
    .sort((a, b) => b.b.share - a.b.share)
    .slice(0, 2);

  if (leans.length === 0) return null;

  return (
    <>
      {leans.map(({ b, name }) => (
        <span key={name} className={cn(b.significant && "font-semibold")}>
          {Math.round(b.share * 100)}% {name}
          {b.significant && " ✓"}
        </span>
      ))}
    </>
  );
}
