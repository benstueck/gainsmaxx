import { cn } from "@/lib/utils";

/**
 * A bar that fills outward from the centre — right for positive, left for
 * negative.
 *
 * Extracted from the round summary when the putting bias gauges needed the
 * same shape. The *meaning* differs (strokes gained vs a directional tendency),
 * which is why the fill colour is the caller's to choose: leaning left isn't
 * "bad" the way losing strokes is, so the gauges deliberately don't use the
 * positive/negative palette.
 */
export function DivergingBar({
  /** −1 fills the track fully left, +1 fully right, 0 is empty. */
  tilt,
  fillClassName,
  className,
  showCenter = true,
}: {
  tilt: number;
  fillClassName: string;
  className?: string;
  showCenter?: boolean;
}) {
  const clamped = Math.max(-1, Math.min(1, Number.isFinite(tilt) ? tilt : 0));
  const pct = Math.abs(clamped) * 50;
  const positive = clamped >= 0;

  return (
    <div
      className={cn(
        "relative h-2.5 w-full rounded-full bg-surface-2",
        className,
      )}
    >
      {showCenter && (
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border" />
      )}
      <div
        className={cn("absolute top-0 h-full rounded-full", fillClassName)}
        style={
          positive
            ? { left: "50%", width: `${pct}%` }
            : { right: "50%", width: `${pct}%` }
        }
      />
    </div>
  );
}
