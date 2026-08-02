import { scoreShot } from "./engine";
import type { WedgeShot } from "./types";

export interface DistanceBand {
  label: string;
  /** Mean points across balls whose TARGET fell in this band. */
  averagePoints: number;
  ballsHit: number;
  /** Mean signed error over struck balls in the band; null if none struck. */
  biasYd: number | null;
}

/**
 * Bands by **target** distance, not by carry — the question is "how do I score
 * from 120 yards", so a ball belongs to the yardage it was asked for.
 *
 * Bounds are exclusive-upper and fixed rather than derived from the session's
 * own min/max, so the same band means the same thing across sessions and the
 * numbers stay comparable over time.
 */
const BANDS: { max: number; label: string }[] = [
  { max: 75, label: "Under 75" },
  { max: 100, label: "75–100" },
  { max: 125, label: "100–125" },
  { max: Infinity, label: "125+" },
];

/**
 * Per-band scoring for a session. Only bands that actually contain balls are
 * returned — a session set to 100–140 shouldn't render two empty rows.
 */
export function distanceBreakdown(shots: WedgeShot[]): DistanceBand[] {
  const buckets = BANDS.map((b) => ({
    label: b.label,
    max: b.max,
    points: [] as number[],
    deltas: [] as number[],
  }));

  for (const shot of shots) {
    const bucket = buckets.find((b) => shot.targetDistance < b.max);
    if (!bucket) continue;
    const result = scoreShot(shot);
    bucket.points.push(result.points);
    // Mishits carry no distance signal, so they score but don't bias.
    if (result.deltaYd != null) bucket.deltas.push(result.deltaYd);
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  return buckets
    .filter((b) => b.points.length > 0)
    .map((b) => ({
      label: b.label,
      averagePoints: mean(b.points),
      ballsHit: b.points.length,
      biasYd: b.deltas.length > 0 ? mean(b.deltas) : null,
    }));
}
