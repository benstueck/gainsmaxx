import { holeShotInputs, isHoleComplete, type HoleState } from "@/lib/round";
import { strokesGainedForShot, type SgCategory } from "@/lib/sg";

/**
 * Distance-bucket breakdowns and Fairways/Greens in Regulation, derived from
 * the same shot data the round-summary/career-stats pages already load — no
 * new DB queries. Always vs the Tour baseline (handicap adjustments only
 * exist at the whole-category level, so there's no principled way to split
 * them across distance buckets).
 */

/** Ascending, exclusive-upper-bound thresholds: a shot's starting distance
 *  falls in the first bucket whose max it's strictly less than. */
const BUCKET_THRESHOLDS: Record<SgCategory, { max: number; label: string }[]> =
  {
    ott: [
      { max: 350, label: "<350" },
      { max: 400, label: "350–400" },
      { max: 450, label: "400–450" },
      { max: 500, label: "450–500" },
      { max: Infinity, label: "500+" },
    ],
    app: [
      { max: 50, label: "30–50" },
      { max: 100, label: "50–100" },
      { max: 150, label: "100–150" },
      { max: 200, label: "150–200" },
      { max: Infinity, label: "200+" },
    ],
    arg: [
      { max: 10, label: "0–10" },
      { max: 20, label: "10–20" },
      { max: Infinity, label: "20–30" },
    ],
    putt: [
      { max: 3, label: "0–3" },
      { max: 5, label: "3–5" },
      { max: 10, label: "5–10" },
      { max: 15, label: "10–15" },
      { max: 20, label: "15–20" },
      { max: 30, label: "20–30" },
      { max: Infinity, label: "30+" },
    ],
  };

const CATEGORIES: SgCategory[] = ["ott", "app", "arg", "putt"];

export type BucketRow = { bucket: string; totalSg: number; shotCount: number };
export type CategoryBuckets = Record<SgCategory, BucketRow[]>;

function bucketLabel(category: SgCategory, distance: number): string {
  const thresholds = BUCKET_THRESHOLDS[category];
  for (const t of thresholds) {
    if (distance < t.max) return t.label;
  }
  return thresholds[thresholds.length - 1].label;
}

function emptyCategoryBuckets(): CategoryBuckets {
  return CATEGORIES.reduce((acc, c) => {
    acc[c] = BUCKET_THRESHOLDS[c].map((t) => ({
      bucket: t.label,
      totalSg: 0,
      shotCount: 0,
    }));
    return acc;
  }, {} as CategoryBuckets);
}

/**
 * Total SG + shot count per distance bucket, across every shot in the given
 * rounds — regardless of whether a hole or round is complete, matching how
 * the existing category totals (`roundStrokesGained`) already work.
 */
export function computeBucketTotals(rounds: HoleState[][]): CategoryBuckets {
  const totals = emptyCategoryBuckets();
  for (const holes of rounds) {
    for (const hole of holes) {
      for (const shot of holeShotInputs(hole)) {
        const { category, sg } = strokesGainedForShot(shot, hole.par);
        const label = bucketLabel(category, shot.startDistance);
        const row = totals[category].find((r) => r.bucket === label)!;
        row.totalSg += sg;
        row.shotCount += 1;
      }
    }
  }
  return totals;
}

/** Rescales each bucket's totalSg to a per-18-holes rate (shotCount is left
 *  as the raw count — it's a sample-size indicator, not something to scale). */
export function scaleBucketsPer18(
  buckets: CategoryBuckets,
  totalHolesPlayed: number,
): CategoryBuckets {
  if (totalHolesPlayed === 0) return buckets;
  const scale = 18 / totalHolesPlayed;
  return CATEGORIES.reduce((acc, c) => {
    acc[c] = buckets[c].map((row) => ({
      ...row,
      totalSg: row.totalSg * scale,
    }));
    return acc;
  }, {} as CategoryBuckets);
}

/**
 * Career distance-bucket averages: sums every completed round's shots into
 * buckets, then scales to a per-18 rate the same way `computeCareerStats`
 * scales its category totals — a 9-hole round contributes half a data
 * point, not a whole one.
 */
export function careerBucketTotals(
  rounds: {
    status: "in_progress" | "complete";
    holesPlayed: number;
    holes: HoleState[];
  }[],
): CategoryBuckets {
  const played = rounds.filter(
    (r) => r.status === "complete" && r.holesPlayed > 0,
  );
  const totals = computeBucketTotals(played.map((r) => r.holes));
  const totalHoles = played.reduce((sum, r) => sum + r.holesPlayed, 0);
  return scaleBucketsPer18(totals, totalHoles);
}

/** Null when not applicable: par 3s have no fairway concept, and an
 *  incomplete hole isn't a made/missed attempt yet. */
export function holeFairwayInRegulation(hole: HoleState): boolean | null {
  if (!isHoleComplete(hole)) return null;
  if (hole.par === 3) return null;
  const tee = hole.shots[0];
  if (!tee) return null;
  if (tee.penaltyStrokes > 0) return false;
  return tee.endLie === "fairway" || tee.endLie === "green";
}

/** Null when the hole isn't complete yet. Regulation = par − 2 strokes to
 *  reach the green (or hole out), counting penalty strokes the same way
 *  `holeStrokesGained` already counts them toward score. */
export function holeGreenInRegulation(hole: HoleState): boolean | null {
  if (!isHoleComplete(hole)) return null;
  let strokes = 0;
  for (const s of hole.shots) {
    strokes += 1 + s.penaltyStrokes;
    if (s.isHoled || s.endLie === "green") {
      return strokes <= hole.par - 2;
    }
  }
  return false;
}

export type FirGir = {
  fir: { made: number; attempted: number };
  gir: { made: number; attempted: number };
};

export function roundFirGir(holes: HoleState[]): FirGir {
  let firMade = 0;
  let firAttempted = 0;
  let girMade = 0;
  let girAttempted = 0;
  for (const hole of holes) {
    const fir = holeFairwayInRegulation(hole);
    if (fir !== null) {
      firAttempted += 1;
      if (fir) firMade += 1;
    }
    const gir = holeGreenInRegulation(hole);
    if (gir !== null) {
      girAttempted += 1;
      if (gir) girMade += 1;
    }
  }
  return {
    fir: { made: firMade, attempted: firAttempted },
    gir: { made: girMade, attempted: girAttempted },
  };
}
