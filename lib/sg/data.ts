import raw from "@/data/benchmarks/v1/benchmarks.json";
import type { Benchmarks } from "./benchmarks.types";

/**
 * The bundled, normalized strokes-gained reference data (Tour expected-strokes
 * tables + per-handicap round-level adjustments). Imported statically so the
 * engine works offline with no IO. Regenerate via `npm run ingest:benchmarks`.
 */
export const benchmarks = raw as unknown as Benchmarks;
