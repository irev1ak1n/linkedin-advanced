import { describe, expect, it } from "vitest";
import { buildMatchBreakdown } from "./analysisBreakdown";
import { createCriterion } from "../models/goal";
import type { MatchResult } from "./scoreProfile";

function evidence(snippet: string) {
  return { fieldLabel: "About", snippet };
}

describe("buildMatchBreakdown", () => {
  it("splits MUST_HAVE into its own group, separate from PREFERRED/OPTIONAL", () => {
    const result: MatchResult = {
      scorePercent: 66,
      disqualified: false,
      complete: true,
      profileExtracted: true,
      reasons: [
        { criterion: createCriterion("FRC mentor", "MUST_HAVE"), status: "MET", confidence: "high", evidence: evidence("FRC mentor") },
        { criterion: createCriterion("Python", "PREFERRED"), status: "MET", confidence: "high", evidence: evidence("Python") },
      ],
      missing: [{ criterion: createCriterion("robotics", "OPTIONAL") }],
    };

    const groups = buildMatchBreakdown(result);
    expect(groups.map((g) => g.key)).toEqual(["must_have", "preferred"]);

    const mustHave = groups.find((g) => g.key === "must_have")!;
    expect(mustHave.chips).toEqual([{ label: "FRC mentor", matched: true, detail: "FRC mentor" }]);

    const preferred = groups.find((g) => g.key === "preferred")!;
    expect(preferred.chips).toHaveLength(2);
    expect(preferred.chips.find((c) => c.label === "Python")?.matched).toBe(true);
    expect(preferred.chips.find((c) => c.label === "robotics")?.matched).toBe(false);
  });

  it("omits a group entirely when the goal has no criteria of that importance", () => {
    const result: MatchResult = {
      scorePercent: 100,
      disqualified: false,
      complete: true,
      profileExtracted: true,
      reasons: [{ criterion: createCriterion("Python", "PREFERRED"), status: "MET", confidence: "high", evidence: evidence("Python") }],
      missing: [],
    };
    const groups = buildMatchBreakdown(result);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("preferred");
  });

  it("passes the missing item's related-mention note through as the chip's detail", () => {
    const result: MatchResult = {
      scorePercent: 0,
      disqualified: false,
      complete: false,
      profileExtracted: true,
      reasons: [],
      missing: [{ criterion: createCriterion("FRC mentor", "MUST_HAVE"), note: 'Related mention found, but not a clear match: "robotics club"' }],
    };
    const groups = buildMatchBreakdown(result);
    expect(groups[0].chips[0].detail).toContain("robotics club");
  });

  it("returns no groups at all for a goal with no scoreable criteria", () => {
    const result: MatchResult = {
      scorePercent: null,
      disqualified: false,
      complete: true,
      profileExtracted: true,
      reasons: [],
      missing: [],
    };
    expect(buildMatchBreakdown(result)).toEqual([]);
  });
});
