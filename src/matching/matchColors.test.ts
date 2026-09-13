import { describe, expect, it } from "vitest";
import { matchBand, matchDisplayLabel, matchDisplayState } from "./matchColors";
import type { MatchResult } from "./scoreProfile";

function result(overrides: Partial<MatchResult>): MatchResult {
  return {
    scorePercent: 0,
    disqualified: false,
    reasons: [],
    missing: [],
    complete: true,
    profileExtracted: true,
    confidence: 1,
    ...overrides,
  };
}

describe("matchBand thresholds", () => {
  it("never calls a score below 40 anything but low", () => {
    expect(matchBand(0)).toBe("low");
    expect(matchBand(25)).toBe("low");
    expect(matchBand(39)).toBe("low");
  });

  it("calls 40-69 potential", () => {
    expect(matchBand(40)).toBe("potential");
    expect(matchBand(69)).toBe("potential");
  });

  it("calls 70+ strong", () => {
    expect(matchBand(70)).toBe("strong");
    expect(matchBand(100)).toBe("strong");
  });
});

describe("matchDisplayState", () => {
  it("never presents a 25% score as a Strong Match", () => {
    const state = matchDisplayState(result({ scorePercent: 25, confidence: 1 }));
    expect(matchDisplayLabel(state)).not.toBe("Strong Match");
    expect(matchDisplayLabel(state)).toBe("Low Match");
  });

  it("prioritizes exclusion over the score", () => {
    const state = matchDisplayState(result({ disqualified: true, scorePercent: 0 }));
    expect(state.kind).toBe("excluded");
  });

  it("reports low confidence instead of a falsely-precise percentage on a sparse profile", () => {
    const state = matchDisplayState(result({ scorePercent: 75, confidence: 0.2 }));
    expect(state.kind).toBe("low_confidence");
    expect(matchDisplayLabel(state)).toBe("Limited Profile Information");
  });

  it("reports not_enough_info when nothing was scoreable", () => {
    const state = matchDisplayState(result({ scorePercent: null }));
    expect(state.kind).toBe("not_enough_info");
  });
});
