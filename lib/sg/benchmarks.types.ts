// Types for the normalized SG benchmark data (data/benchmarks/vN/benchmarks.json).
// The SG engine imports this shape; the ingestion script (scripts/ingest-benchmarks.mjs)
// produces it. Keep the two in sync.

/** Lies covered by the long-game (full-swing) expected-strokes table. */
export type LongGameLie = "tee" | "fairway" | "rough" | "sand" | "recovery";

/** Any position a ball can rest — long-game lies plus the green (putting). */
export type Lie = LongGameLie | "green";

/** The four strokes-gained categories. */
export type SgCategory = "ott" | "app" | "arg" | "putt";

/** Discrete baselines available on the round-summary toggle. */
export type BaselineLevel = "tour" | 0 | 5 | 10 | 15 | 20 | 25;

/** [distance, expectedStrokes] pair, sorted ascending by distance. */
export type BenchmarkPoint = [distance: number, expectedStrokes: number];

export interface LongGameTable {
  /** Distance unit for the pairs below. */
  unit: "yards";
  /** Sorted expected-strokes-to-hole-out points per lie (Tour baseline). */
  lies: Record<LongGameLie, BenchmarkPoint[]>;
}

export interface PuttingTable {
  unit: "feet";
  /** Sorted expected-putts-to-hole-out points on the green (Tour baseline). */
  green: BenchmarkPoint[];
}

/** Strokes lost per 18-hole round vs the Tour baseline, per SG category. */
export type HandicapAdjustment = Record<SgCategory, number>;

export interface HandicapAdjustments {
  unit: string;
  /** Source CSV column name -> engine category. */
  categoryMap: Record<"tee" | "approach" | "short" | "putt", SgCategory>;
  /** Keyed by handicap level (0,5,10,15,20,25). */
  levels: Record<string, HandicapAdjustment>;
}

export interface Benchmarks {
  version: number;
  generatedAt: string;
  source: string;
  notes: string;
  tour: {
    longGame: LongGameTable;
    putting: PuttingTable;
  };
  handicapAdjustments: HandicapAdjustments;
}
