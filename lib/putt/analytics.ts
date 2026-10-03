import { missSide, scoreAttempt } from "./engine";
import { detectBias, type BiasResult } from "./stats";
import type {
  LineError,
  MissSide,
  PuttAttempt,
  PuttAttemptResult,
  SpeedError,
} from "./types";

/** One cell of the 3×3 grid. The centre (both null) is the made count. */
export interface MissCell {
  speed: SpeedError | null;
  line: LineError | null;
  count: number;
}

export interface PuttDistanceBand {
  label: string;
  attempts: number;
  made: number;
  makePercent: number;
  /** Mean strokes gained per attempt in this band. */
  averageSg: number;
}

export interface PuttSessionSummary {
  attempts: PuttAttemptResult[];
  /** Holes logged — each is one called putt plus any comeback. */
  attemptCount: number;

  totalSg: number;
  averageSg: number;

  // --- first putts only, so sessions stay comparable -----------------------
  firstPuttsMade: number;
  makePercent: number;
  /** 3×3 grid over FIRST putts. Centre cell = made. */
  missMap: MissCell[];
  bands: PuttDistanceBand[];

  // --- all putts -----------------------------------------------------------
  onePutts: number;
  twoPutts: number;
  threePutts: number;

  comebacks: number;
  comebacksMade: number;
  /** Mean leave distance on missed first putts. Null when nothing missed. */
  averageComebackFt: number | null;

  // --- the gauges ----------------------------------------------------------
  /** Stroke tendency: absolute left/right, over every putt struck. */
  directionBias: BiasResult<LineError>;
  /**
   * The same gauge over **first putts only**.
   *
   * Kept alongside because whether comebacks sharpen or dilute the stroke
   * signal is an open empirical question. The argument for pooling them is
   * that a 3 ft putt barely breaks, so it isolates face angle; the argument
   * against is that misses from 3 ft are rare and idiosyncratic — lip-outs,
   * carelessness — and therefore closer to noise. Simulation can't settle it,
   * because the answer depends on how this player actually putts.
   *
   * Computing both costs nothing and lets real sessions answer it: if the two
   * agree, pooling is safe and the extra sample is free. If they persistently
   * disagree, comebacks are diluting and the headline should switch to this.
   */
  firstPuttDirectionBias: BiasResult<LineError>;
  /** Pace tendency: fast/slow, over every putt struck. */
  speedBias: BiasResult<SpeedError>;
  /** Read tendency: high/low vs the break. First putts on breaking putts only. */
  readBias: BiasResult<MissSide>;

  // --- self-reported vs measured ------------------------------------------
  misreadLineCount: number;
  misreadSpeedCount: number;
  /**
   * First putts that finished on the low (amateur) side without the player
   * flagging a line misread.
   *
   * The interesting number in the whole summary: it's where the measured read
   * and the self-reported read disagree. Consistently missing low while never
   * noticing means you're misreading the green and don't know it — which is a
   * far more actionable finding than either signal alone.
   */
  unflaggedLowMisses: number;
}

/** Bands by called distance. Fixed bounds so sessions stay comparable. */
const BANDS: { max: number; label: string }[] = [
  { max: 6, label: "Under 6 ft" },
  { max: 9, label: "6–9 ft" },
  { max: 12, label: "9–12 ft" },
  { max: Infinity, label: "12 ft+" },
];

const mean = (xs: number[]) =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * The 3×3 miss grid over first putts.
 *
 * Always returns all nine cells, including empty ones, so the grid renders as
 * a stable shape rather than reflowing as a session fills in.
 *
 * The centre counts `made` **explicitly**, rather than inferring it from both
 * errors being null. The two are equivalent for well-formed data — the centre
 * button *is* "Made!", so a miss always carries at least one error — but
 * inferring it would let a malformed row (missed, no error recorded) land in
 * the centre and silently overstate how many putts were holed. A data bug
 * should lose a row from the grid, never invent a make.
 */
function buildMissMap(attempts: PuttAttempt[]): MissCell[] {
  const speeds: (SpeedError | null)[] = ["fast", null, "slow"];
  const lines: (LineError | null)[] = ["left", null, "right"];
  return speeds.flatMap((speed) =>
    lines.map((line) => {
      const isCentre = speed == null && line == null;
      return {
        speed,
        line,
        count: isCentre
          ? attempts.filter((a) => a.made).length
          : attempts.filter(
              (a) => !a.made && a.speedError === speed && a.lineError === line,
            ).length,
      };
    }),
  );
}

function buildBands(results: PuttAttemptResult[]): PuttDistanceBand[] {
  return BANDS.map((b) => ({ ...b, items: [] as PuttAttemptResult[] }))
    .map((bucket, i, all) => {
      const lower = i === 0 ? -Infinity : all[i - 1].max;
      const items = results.filter(
        (r) => r.distanceFt >= lower && r.distanceFt < bucket.max,
      );
      return { ...bucket, items };
    })
    .filter((b) => b.items.length > 0)
    .map((b) => ({
      label: b.label,
      attempts: b.items.length,
      made: b.items.filter((r) => r.made).length,
      makePercent: b.items.filter((r) => r.made).length / b.items.length,
      averageSg: mean(b.items.map((r) => r.holeSg)),
    }));
}

/**
 * Everything the summary screen shows.
 *
 * Each figure draws from a deliberately chosen population — see
 * plans/03-puttmaxx.md. Comebacks are short and exist only *because* a putt
 * was missed, so pooling them everywhere would quietly inflate make % and
 * shrink the average miss. They are included where their shortness is an
 * advantage (the stroke gauge, since a 3 ft putt barely breaks and so isolates
 * face angle) and excluded where it isn't (the read gauge, make %).
 */
export function summarizeSession(attempts: PuttAttempt[]): PuttSessionSummary {
  const results = attempts.map(scoreAttempt);
  const missedFirst = results.filter((r) => !r.made);

  // Direction and speed: every putt struck, first putts and comebacks alike —
  // EXCEPT a miss the player flagged as a misread on that axis.
  //
  // The flag is the player's own attribution, and it's the one piece of
  // information the statistics can't recover: "I read it wrong" and "I read it
  // right and stroked it badly" look identical in the outcome. If they say the
  // line was misread, that miss describes their green reading, not their face
  // angle, so counting it as a direction tendency would be attributing it to
  // the wrong fault. Same argument on the speed axis.
  //
  // It only goes one way, though. An *unflagged* miss isn't proof the read was
  // good — misreading without realising is the commonest case of all, which is
  // what `unflaggedLowMisses` exists to surface.
  const firstLineErrors: LineError[] = results
    .filter((r) => !r.misreadLine)
    .map((r) => r.lineError)
    .filter((e): e is LineError => e != null);
  const lineErrors: LineError[] = [
    ...firstLineErrors,
    // Comebacks carry no misread flag of their own.
    ...results.map((r) => r.comebackLineError),
  ].filter((e): e is LineError => e != null);
  const speedErrors: SpeedError[] = [
    ...results.filter((r) => !r.misreadSpeed).map((r) => r.speedError),
    ...results.map((r) => r.comebackSpeedError),
  ].filter((e): e is SpeedError => e != null);

  // Read: first putts only, and only where there was a break to misread.
  const sides: MissSide[] = results
    .map((r) => missSide(r.lineError, r.breakDirection))
    .filter((s): s is MissSide => s != null);

  const count = <T>(xs: T[], v: T) => xs.filter((x) => x === v).length;
  const comebackLeaves = missedFirst
    .map((r) => r.comebackDistanceFt)
    .filter((d): d is number => d != null);

  return {
    attempts: results,
    attemptCount: results.length,

    totalSg: results.reduce((s, r) => s + r.holeSg, 0),
    averageSg: mean(results.map((r) => r.holeSg)),

    firstPuttsMade: results.filter((r) => r.made).length,
    makePercent:
      results.length === 0
        ? 0
        : results.filter((r) => r.made).length / results.length,
    missMap: buildMissMap(results),
    bands: buildBands(results),

    onePutts: count(
      results.map((r) => r.puttsTaken),
      1,
    ),
    twoPutts: count(
      results.map((r) => r.puttsTaken),
      2,
    ),
    threePutts: count(
      results.map((r) => r.puttsTaken),
      3,
    ),

    comebacks: missedFirst.length,
    comebacksMade: missedFirst.filter((r) => r.comebackMade === true).length,
    averageComebackFt:
      comebackLeaves.length === 0 ? null : mean(comebackLeaves),

    directionBias: detectBias(["left", "right"] as const, [
      count(lineErrors, "left"),
      count(lineErrors, "right"),
    ]),
    firstPuttDirectionBias: detectBias(["left", "right"] as const, [
      count(firstLineErrors, "left"),
      count(firstLineErrors, "right"),
    ]),
    speedBias: detectBias(["fast", "slow"] as const, [
      count(speedErrors, "fast"),
      count(speedErrors, "slow"),
    ]),
    readBias: detectBias(["high", "low"] as const, [
      count(sides, "high"),
      count(sides, "low"),
    ]),

    misreadLineCount: results.filter((r) => r.misreadLine).length,
    misreadSpeedCount: results.filter((r) => r.misreadSpeed).length,
    unflaggedLowMisses: results.filter(
      (r) => r.missSide === "low" && !r.misreadLine,
    ).length,
  };
}
