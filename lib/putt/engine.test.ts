import { describe, expect, it } from "vitest";
import {
  comebackRead,
  expectedPutts,
  firstPuttSg,
  holeSg,
  missSide,
  puttsTaken,
  scoreAttempt,
} from "./engine";
import type { PuttAttempt } from "./types";

function attempt(over: Partial<PuttAttempt> = {}): PuttAttempt {
  return {
    distanceFt: 8,
    elevation: "flat",
    breakDirection: "straight",
    made: false,
    speedError: null,
    lineError: null,
    misreadLine: false,
    misreadSpeed: false,
    comebackDistanceFt: null,
    comebackMade: null,
    comebackSpeedError: null,
    comebackLineError: null,
    ...over,
  };
}

describe("expectedPutts", () => {
  it("matches the Tour table at its anchor points", () => {
    expect(expectedPutts(4)).toBeCloseTo(1.13, 6);
    expect(expectedPutts(8)).toBeCloseTo(1.5, 6);
    expect(expectedPutts(10)).toBeCloseTo(1.61, 6);
  });

  it("is monotonic — longer putts are never easier", () => {
    for (let d = 2; d <= 30; d++) {
      expect(expectedPutts(d)).toBeGreaterThanOrEqual(expectedPutts(d - 1));
    }
  });

  it("treats a holed-out distance of zero as costing a putt, not negative", () => {
    expect(expectedPutts(0)).toBeGreaterThan(0);
    expect(expectedPutts(-5)).toBe(expectedPutts(0));
  });
});

describe("puttsTaken", () => {
  it("counts 1 made, 2 comeback holed, 3 comeback missed", () => {
    expect(puttsTaken(attempt({ made: true }))).toBe(1);
    expect(
      puttsTaken(attempt({ comebackDistanceFt: 2, comebackMade: true })),
    ).toBe(2);
    expect(
      puttsTaken(attempt({ comebackDistanceFt: 4, comebackMade: false })),
    ).toBe(3);
  });
});

describe("strokes gained", () => {
  // The headline arithmetic from the acceptance criteria: 8 ft = 1.50 expected.
  it("scores an 8-footer at +0.50 made, −0.50 two-putt, −1.50 three-putt", () => {
    expect(holeSg(attempt({ distanceFt: 8, made: true }))).toBeCloseTo(0.5, 6);
    expect(
      holeSg(
        attempt({ distanceFt: 8, comebackDistanceFt: 2, comebackMade: true }),
      ),
    ).toBeCloseTo(-0.5, 6);
    expect(
      holeSg(
        attempt({ distanceFt: 8, comebackDistanceFt: 4, comebackMade: false }),
      ),
    ).toBeCloseTo(-1.5, 6);
  });

  it("separates a tap-in leave from one that runs well past", () => {
    // Both are 2 putts to the hole, so holeSg can't tell them apart...
    const tapIn = attempt({ comebackDistanceFt: 1, comebackMade: true });
    const ranPast = attempt({ comebackDistanceFt: 6, comebackMade: true });
    expect(holeSg(tapIn)).toBeCloseTo(holeSg(ranPast), 10);
    // ...but the first-putt figure, which is the whole reason it exists, does.
    expect(firstPuttSg(tapIn)).toBeGreaterThan(firstPuttSg(ranPast));
  });

  it("does not credit the first putt for holing the comeback", () => {
    const holed = attempt({ comebackDistanceFt: 5, comebackMade: true });
    const missed = attempt({ comebackDistanceFt: 5, comebackMade: false });
    expect(firstPuttSg(holed)).toBeCloseTo(firstPuttSg(missed), 10);
    // The hole score still differs — the comeback counts there.
    expect(holeSg(holed)).toBeGreaterThan(holeSg(missed));
  });

  it("gives a made putt the same first-putt and hole score", () => {
    const made = attempt({ made: true, distanceFt: 11 });
    expect(firstPuttSg(made)).toBeCloseTo(holeSg(made), 10);
  });
});

describe("missSide — the read axis", () => {
  it("puts the low (amateur) side right on L2R and left on R2L", () => {
    expect(missSide("right", "l2r")).toBe("low");
    expect(missSide("left", "l2r")).toBe("high");
    expect(missSide("left", "r2l")).toBe("low");
    expect(missSide("right", "r2l")).toBe("high");
  });

  it("has no high/low on a straight putt or a putt that held its line", () => {
    expect(missSide("left", "straight")).toBeNull();
    expect(missSide(null, "l2r")).toBeNull();
  });

  it("maps one under-read fault onto OPPOSITE absolute misses", () => {
    // The reason direction and read are separate gauges: a player who always
    // misses low misses RIGHT on one break and LEFT on the other, so pooling
    // left/right absolutely would cancel the fault out entirely.
    expect(missSide("right", "l2r")).toBe("low");
    expect(missSide("left", "r2l")).toBe("low");
  });
});

describe("comebackRead", () => {
  it("reverses slope and break", () => {
    expect(
      comebackRead(attempt({ elevation: "uphill", breakDirection: "l2r" })),
    ).toEqual({ elevation: "downhill", breakDirection: "r2l" });
  });

  it("leaves flat and straight alone", () => {
    expect(
      comebackRead(attempt({ elevation: "flat", breakDirection: "straight" })),
    ).toEqual({ elevation: "flat", breakDirection: "straight" });
  });

  it("has nothing to describe when the putt dropped", () => {
    expect(comebackRead(attempt({ made: true }))).toBeNull();
  });
});

describe("scoreAttempt", () => {
  it("attaches every derived figure without mutating the input", () => {
    const input = attempt({
      distanceFt: 8,
      breakDirection: "l2r",
      lineError: "right",
      comebackDistanceFt: 3,
      comebackMade: true,
    });
    const r = scoreAttempt(input);
    expect(r.puttsTaken).toBe(2);
    expect(r.missSide).toBe("low");
    expect(r.holeSg).toBeCloseTo(-0.5, 6);
    expect(input).toEqual(
      attempt({
        distanceFt: 8,
        breakDirection: "l2r",
        lineError: "right",
        comebackDistanceFt: 3,
        comebackMade: true,
      }),
    );
  });
});
