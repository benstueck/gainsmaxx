import { cn } from "@/lib/utils";
import type { MissCell } from "@/lib/putt";

/**
 * The 3×3 grid as a heatmap, laid out exactly like the entry grid so a glance
 * maps straight back onto the buttons that were tapped.
 *
 * The centre is makes, not a miss — shading it on the same scale as the misses
 * would make a good session look like a bad one, so it gets the primary colour
 * while the misses share a neutral ramp.
 */
export function MissMap({ cells }: { cells: MissCell[] }) {
  const misses = cells.filter((c) => !(c.speed == null && c.line == null));
  const worst = Math.max(1, ...misses.map((c) => c.count));

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {cells.map((c) => {
        const isCentre = c.speed == null && c.line == null;
        const intensity = isCentre ? 0 : c.count / worst;
        return (
          <div
            key={`${c.speed}-${c.line}`}
            className={cn(
              "flex flex-col items-center justify-center rounded-app py-3 text-center",
              isCentre
                ? "bg-primary text-primary-foreground"
                : "border border-border",
            )}
            style={
              isCentre
                ? undefined
                : // A neutral ramp: empty cells stay plain, the worst cell is
                  // clearly the worst, without implying "left" is a colour.
                  { backgroundColor: `rgb(0 0 0 / ${intensity * 0.1})` }
            }
          >
            <span className="text-lg font-bold tabular-nums">{c.count}</span>
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide",
                isCentre ? "opacity-80" : "text-muted",
              )}
            >
              {isCentre
                ? "Made"
                : [
                    c.speed === "fast"
                      ? "Fast"
                      : c.speed === "slow"
                        ? "Slow"
                        : "",
                    c.line === "left"
                      ? "Left"
                      : c.line === "right"
                        ? "Right"
                        : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
            </span>
          </div>
        );
      })}
    </div>
  );
}
