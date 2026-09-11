import { describe, expect, it } from "vitest";
import { matchLevel } from "./matchLevel";
import type { MatchResult } from "./scoreProfile";

function result(overrides: Partial<MatchResult>): MatchResult {
  return {
    scorePercent: 0,
    disqualified: false,
    reasons: [],
    missing: [],
    complete: true,
    profileExtracted: true,
    ...overrides,
  };
}

describe("matchLevel", () => {
  it("returns excluded whenever the result is disqualified, regardless of score", () => {
    expect(matchLevel(result({ disqualified: true, scorePercent: 0 }))).toBe("excluded");
  });

  it("returns not_enough_info when there is nothing scoreable", () => {
    expect(matchLevel(result({ scorePercent: null }))).toBe("not_enough_info");
  });

  it("returns low below the good threshold", () => {
    expect(matchLevel(result({ scorePercent: 44 }))).toBe("low");
  });

  it("returns good at and above the good threshold, below the strong threshold", () => {
    expect(matchLevel(result({ scorePercent: 45 }))).toBe("good");
    expect(matchLevel(result({ scorePercent: 74 }))).toBe("good");
  });

  it("returns strong at and above the strong threshold", () => {
    expect(matchLevel(result({ scorePercent: 75 }))).toBe("strong");
    expect(matchLevel(result({ scorePercent: 100 }))).toBe("strong");
  });
});
