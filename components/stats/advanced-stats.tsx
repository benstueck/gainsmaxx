"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SgCategory } from "@/lib/sg";
import type { CategoryBuckets } from "@/lib/round-stats";

const CATEGORY_LABEL: Record<SgCategory, string> = {
  ott: "Off the tee",
  app: "Approach",
  arg: "Around green",
  putt: "Putting",
};
const CATEGORY_ORDER: SgCategory[] = ["ott", "app", "arg", "putt"];

const fmtSg = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;

/**
 * Collapsible "Advanced stats" card: per-category distance-bucket breakdown,
 * all categories shown at once when open (no per-category toggle). Always
 * vs the Tour baseline — the disclaimer stays visible whenever this is open
 * since it silently ignores whatever baseline toggle the rest of the page
 * has.
 */
export function AdvancedStatsSection({
  buckets,
  valueLabel,
}: {
  buckets: CategoryBuckets;
  /** What the number column represents, e.g. "Total SG" or "Avg SG / 18". */
  valueLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-app border border-border p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold">Advanced stats</span>
        <ChevronDown
          size={18}
          className={cn(
            "text-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-xs text-muted">
            Strokes gained vs the{" "}
            <span className="font-semibold">PGA Tour</span> baseline — this
            doesn&rsquo;t follow the baseline toggle above.
          </p>
          <div className="mt-3 flex flex-col gap-4">
            {CATEGORY_ORDER.map((c) => (
              <div key={c}>
                <h3 className="text-sm font-semibold">{CATEGORY_LABEL[c]}</h3>
                <table className="mt-1 w-full text-sm">
                  <thead>
                    <tr className="text-xs font-medium text-muted">
                      <th className="py-1 text-left">Distance</th>
                      <th className="py-1 text-right">{valueLabel}</th>
                      <th className="py-1 text-right">Shots</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buckets[c].map((row) => (
                      <tr key={row.bucket} className="border-t border-border">
                        <td className="py-1.5">{row.bucket}</td>
                        <td
                          className={cn(
                            "py-1.5 text-right font-semibold tabular-nums",
                            row.shotCount === 0
                              ? "text-muted"
                              : row.totalSg >= 0
                                ? "text-positive"
                                : "text-negative",
                          )}
                        >
                          {row.shotCount === 0 ? "—" : fmtSg(row.totalSg)}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-muted">
                          {row.shotCount === 0 ? "—" : row.shotCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
