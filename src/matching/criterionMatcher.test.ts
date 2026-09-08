import { describe, expect, it } from "vitest";
import { matchCriterionAgainstProfile } from "./criterionMatcher";
import { createCriterion } from "../models/goal";
import type { LinkedInProfile } from "../models/profile";

function makeProfile(overrides: Partial<LinkedInProfile>): LinkedInProfile {
  return { experience: [], education: [], skills: [], extracted: true, ...overrides };
}

describe("matchCriterionAgainstProfile - exact phrase", () => {
  it("matches an exact phrase in the headline", () => {
    const profile = makeProfile({ headline: "FRC mentor and robotics coach" });
    const result = matchCriterionAgainstProfile(createCriterion("FRC mentor", "MUST_HAVE"), profile);
    expect(result.status).toBe("MET_EXACT");
    expect(result.evidence?.fieldLabel).toBe("Headline");
  });

  it("matches an exact phrase in the About section", () => {
    const profile = makeProfile({ about: "I have spent 8 years as an FRC mentor for my local team." });
    const result = matchCriterionAgainstProfile(createCriterion("FRC mentor", "MUST_HAVE"), profile);
    expect(result.status).toBe("MET_EXACT");
    expect(result.evidence?.fieldLabel).toBe("About");
  });
});

describe("matchCriterionAgainstProfile - the mission's own false-positive example", () => {
  it("never treats general robotics experience as a match for FRC mentorship", () => {
    const profile = makeProfile({
      headline: "Robotics Engineer",
      about: "I have general robotics experience building autonomous systems.",
    });
    const result = matchCriterionAgainstProfile(createCriterion("FRC mentor", "MUST_HAVE"), profile);
    expect(result.status).toBe("UNCONFIRMED");
  });

  it("surfaces the robotics mention as a partial signal without claiming a match", () => {
    const profile = makeProfile({ about: "I have general robotics experience." });
    const result = matchCriterionAgainstProfile(createCriterion("FRC mentor", "MUST_HAVE"), profile);
    expect(result.status).toBe("UNCONFIRMED");
    expect(result.partialEvidence).toBeUndefined(); // "robotics" isn't a keyword of "FRC mentor" at all
  });
});

describe("matchCriterionAgainstProfile - keyword match within one field", () => {
  it("matches when every significant keyword appears in the same field, out of order", () => {
    const profile = makeProfile({ about: "Mentor to several student robotics teams, including our FRC group." });
    const result = matchCriterionAgainstProfile(createCriterion("FRC mentor", "MUST_HAVE"), profile);
    expect(result.status).toBe("MET_KEYWORDS");
  });

  it("never matches when keywords are scattered across unrelated fields", () => {
    const profile = makeProfile({
      headline: "Volunteer mentor for local youth",
      experience: [{ title: "FRC judge", company: "Regional event" }],
    });
    const result = matchCriterionAgainstProfile(createCriterion("FRC mentor", "MUST_HAVE"), profile);
    // "mentor" is in the headline, "frc" is in experience — never co-located, so this must
    // stay UNCONFIRMED rather than falsely combining two unrelated mentions.
    expect(result.status).toBe("UNCONFIRMED");
    expect(result.partialEvidence).toBeDefined();
  });
});

describe("matchCriterionAgainstProfile - unconfirmed, never a confirmed failure", () => {
  it("returns UNCONFIRMED (not a negative status) when nothing supports the criterion", () => {
    const profile = makeProfile({ headline: "Product Manager" });
    const result = matchCriterionAgainstProfile(createCriterion("FRC mentor", "MUST_HAVE"), profile);
    expect(result.status).toBe("UNCONFIRMED");
  });

  it("returns UNCONFIRMED for a criterion that normalizes to no keywords at all", () => {
    const profile = makeProfile({ headline: "Anything at all" });
    const result = matchCriterionAgainstProfile(createCriterion("the of in", "OPTIONAL"), profile);
    expect(result.status).toBe("UNCONFIRMED");
  });
});

describe("matchCriterionAgainstProfile - determinism", () => {
  it("produces identical output across repeated calls with the same inputs", () => {
    const profile = makeProfile({ about: "Experienced Python developer and FRC mentor." });
    const criterion = createCriterion("Python", "PREFERRED");
    const first = matchCriterionAgainstProfile(criterion, profile);
    const second = matchCriterionAgainstProfile(criterion, profile);
    expect(second).toEqual(first);
  });
});

describe("matchCriterionAgainstProfile - excluded criteria", () => {
  it("detects an excluded trait using the same matching logic", () => {
    const profile = makeProfile({ headline: "Technical Recruiter at Acme" });
    const result = matchCriterionAgainstProfile(createCriterion("recruiter", "EXCLUDED"), profile);
    expect(result.status).toBe("MET_EXACT");
  });
});
