import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_DISTANCE_FT,
  DEFAULT_MIN_DISTANCE_FT,
  DEFAULT_PUTT_COUNT,
  MAX_PUTTS,
  validateSessionParams,
} from "./session-params";
import { expectedPutts } from "./engine";

describe("validateSessionParams", () => {
  it("accepts the defaults", () => {
    expect(
      validateSessionParams(
        DEFAULT_PUTT_COUNT,
        DEFAULT_MIN_DISTANCE_FT,
        DEFAULT_MAX_DISTANCE_FT,
      ),
    ).toBeNull();
  });

  it("rejects a non-integer, zero or oversized putt count", () => {
    expect(validateSessionParams(0, 5, 12)).not.toBeNull();
    expect(validateSessionParams(7.5, 5, 12)).not.toBeNull();
    expect(validateSessionParams(MAX_PUTTS + 1, 5, 12)).not.toBeNull();
  });

  it("rejects a max below the min", () => {
    expect(validateSessionParams(18, 12, 5)).not.toBeNull();
  });

  it("allows min === max — a single-distance drill is legitimate", () => {
    expect(validateSessionParams(18, 8, 8)).toBeNull();
  });

  it("rejects distances outside the supported range", () => {
    expect(validateSessionParams(18, 0, 12)).not.toBeNull();
    expect(validateSessionParams(18, 5, 999)).not.toBeNull();
  });
});

describe("the default range is chosen for information, not difficulty", () => {
  it("straddles the ~50% make distance where misses are most informative", () => {
    // Make% ≈ 2 − expectedPutts for short putts. The default range must sit
    // either side of the coin-flip point: too easy and a session yields too
    // few misses to detect a bias at all.
    const makePct = (ft: number) => 2 - expectedPutts(ft);
    expect(makePct(DEFAULT_MIN_DISTANCE_FT)).toBeGreaterThan(0.5);
    expect(makePct(DEFAULT_MAX_DISTANCE_FT)).toBeLessThan(0.5);
  });

  it("stays short of the range where the drill becomes lag putting", () => {
    expect(DEFAULT_MAX_DISTANCE_FT).toBeLessThanOrEqual(15);
  });
});
