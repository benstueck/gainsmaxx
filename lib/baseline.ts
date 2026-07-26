import type { Baseline } from "@/lib/sg";

/**
 * Shared baseline selection logic (used by the round summary toggle, the Feed,
 * and Profile career stats) so "which baseline am I looking at" is consistent
 * across the app and matches what's stored in `profiles.default_baseline`.
 *
 * Storage values: "handicap" (the user's own, interpolated) | "tour" |
 * "0" | "5" | "10" | "15" | "20" | "25".
 */
export type BaselineOption = {
  value: string;
  label: string;
  baseline: Baseline;
};

export function baselineOptions(handicap: number | null): BaselineOption[] {
  const opts: BaselineOption[] = [];
  if (handicap != null) {
    opts.push({
      value: "handicap",
      label: `My handicap (${handicap.toFixed(1)})`,
      baseline: handicap,
    });
  }
  opts.push({ value: "tour", label: "PGA Tour", baseline: "tour" });
  for (const l of [0, 5, 10, 15, 20, 25]) {
    opts.push({
      value: String(l),
      label: l === 0 ? "Scratch (0)" : `${l} handicap`,
      baseline: l,
    });
  }
  return opts;
}

/** Resolve a stored default-baseline preference to an actual engine Baseline. */
export function resolveBaseline(
  defaultBaseline: string,
  handicap: number | null,
): Baseline {
  if (defaultBaseline === "handicap") return handicap ?? "tour";
  if (defaultBaseline === "tour") return "tour";
  const n = Number(defaultBaseline);
  return Number.isFinite(n) ? n : "tour";
}
