"use client";

import { cn } from "@/lib/utils";
import type { LineError, SpeedError } from "@/lib/putt";

export type GridChoice = {
  made: boolean;
  speedError: SpeedError | null;
  lineError: LineError | null;
};

/**
 * The 3×3 outcome grid — the core interaction, lifted from The Stack.
 *
 * One tap records two independent error axes: vertical is speed, horizontal is
 * line, and either may be null (a pure line miss had the right pace). That
 * decomposition is what makes "you leak putts left" computable at all, and it
 * costs no more than a made/missed button would.
 *
 * The same grid is reused for the comeback putt. A comeback is a putt, so it's
 * a data point, and reusing the grid means identical muscle memory and an
 * identical interaction cost to the yes/no it replaced.
 */
const ROWS: { speed: SpeedError | null; label: string }[] = [
  { speed: "fast", label: "Fast" },
  { speed: null, label: "" },
  { speed: "slow", label: "Slow" },
];
const COLS: { line: LineError | null; label: string }[] = [
  { line: "left", label: "Left" },
  { line: null, label: "" },
  { line: "right", label: "Right" },
];

function cellLabel(speed: SpeedError | null, line: LineError | null): string {
  if (speed == null && line == null) return "Made!";
  const s = ROWS.find((r) => r.speed === speed)!.label;
  const l = COLS.find((c) => c.line === line)!.label;
  return [s, l].filter(Boolean).join(" ");
}

export function PuttGrid({
  onChoose,
  disabled = false,
}: {
  onChoose: (choice: GridChoice) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ROWS.flatMap(({ speed }) =>
        COLS.map(({ line }) => {
          const isMade = speed == null && line == null;
          return (
            <button
              key={`${speed}-${line}`}
              type="button"
              disabled={disabled}
              onClick={() =>
                onChoose({
                  made: isMade,
                  speedError: isMade ? null : speed,
                  lineError: isMade ? null : line,
                })
              }
              className={cn(
                "flex min-h-[4.5rem] items-center justify-center rounded-app px-1 text-center text-base font-bold leading-tight active:scale-95 disabled:opacity-40",
                isMade
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-surface",
              )}
            >
              {cellLabel(speed, line)}
            </button>
          );
        }),
      )}
    </div>
  );
}

/**
 * Where the missed putt finished, as quick-tap buckets.
 *
 * Coarse on purpose. The hole's strokes gained doesn't depend on this at all —
 * only the first putt's own score does — so precision buys little, while a
 * keypad costs real time when you're standing on a green holding a putter.
 * Laid out 3×3 so the dock keeps the same footprint across every step and the
 * screen never jumps.
 */
export const COMEBACK_DISTANCES = [1, 2, 3, 4, 5, 6, 8, 10, 12];

export function ComebackDistancePad({
  onChoose,
}: {
  onChoose: (ft: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {COMEBACK_DISTANCES.map((ft) => (
        <button
          key={ft}
          type="button"
          onClick={() => onChoose(ft)}
          className="flex min-h-[4.5rem] flex-col items-center justify-center rounded-app border border-border bg-surface text-xl font-bold tabular-nums active:scale-95"
        >
          {ft}
          <span className="text-xs font-normal text-muted">ft</span>
        </button>
      ))}
    </div>
  );
}
