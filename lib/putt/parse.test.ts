import { describe, expect, it } from "vitest";
import { parsePutts } from "./parse";

/**
 * parsePutts is the one place a `jsonb` column crosses into typed code. The DB
 * guarantees valid JSON and nothing about its shape, so a session written by
 * an older build — or a hand-edited row — could hold anything, and a malformed
 * entry would otherwise surface as a crash mid-round on a practice green.
 */
describe("parsePutts", () => {
  const good = { distanceFt: 8, elevation: "uphill", breakDirection: "l2r" };

  it("accepts a well-formed sequence", () => {
    expect(parsePutts([good])).toEqual([good]);
  });

  it("treats anything that isn't an array as empty", () => {
    expect(parsePutts(null)).toEqual([]);
    expect(parsePutts(undefined)).toEqual([]);
    expect(parsePutts({})).toEqual([]);
    expect(parsePutts("[]")).toEqual([]);
  });

  it("drops entries with a bad or missing distance", () => {
    expect(parsePutts([{ ...good, distanceFt: "8" }])).toEqual([]);
    expect(parsePutts([{ ...good, distanceFt: NaN }])).toEqual([]);
    expect(parsePutts([{ elevation: "flat", breakDirection: "l2r" }])).toEqual(
      [],
    );
  });

  it("drops entries with an unrecognised elevation or break", () => {
    expect(parsePutts([{ ...good, elevation: "sideways" }])).toEqual([]);
    expect(parsePutts([{ ...good, breakDirection: "both" }])).toEqual([]);
  });

  it("drops nulls and primitives mixed into the array", () => {
    expect(parsePutts([null, 7, "x", good])).toEqual([good]);
  });

  it("keeps the good entries rather than discarding the whole session", () => {
    // One corrupt putt shouldn't cost the player the other seventeen; the
    // caller falls back to rolling a fresh putt for the gap.
    const parsed = parsePutts([good, { bogus: true }, good]);
    expect(parsed).toHaveLength(2);
  });
});
