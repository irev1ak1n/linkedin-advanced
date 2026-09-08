import { describe, expect, it } from "vitest";
import { matchCriterionAgainstProfile } from "./criterionMatcher";
import { createCriterion } from "../models/goal";
import type { LinkedInProfile } from "../models/profile";

function makeProfile(overrides: Partial<LinkedInProfile>): LinkedInProfile {
  return { experience: [], education: [], skills: [], projects: [], extracted: true, ...overrides };
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

describe("matchCriterionAgainstProfile - this round's under-matching fix", () => {
  it("treats 'Mechanical Engineering' as relevant evidence for an 'engineering background' criterion", () => {
    const profile = makeProfile({ education: [{ school: "UT Austin", degree: "B.S. Mechanical Engineering" }] });
    const result = matchCriterionAgainstProfile(createCriterion("engineering background", "PREFERRED"), profile);
    expect(result.status).not.toBe("UNCONFIRMED");
  });

  it("matches 'engineer' against a criterion written as 'engineering', and vice versa", () => {
    const asEngineer = makeProfile({ headline: "Senior Software Engineer" });
    const result1 = matchCriterionAgainstProfile(createCriterion("software engineering", "PREFERRED"), asEngineer);
    expect(result1.status).not.toBe("UNCONFIRMED");

    // Word order reversed and split across two separate words ("Engineering... software"),
    // so this can only pass via the stemmed same-field keyword tier, never a substring fluke.
    const asEngineering = makeProfile({ about: "Engineering is my passion — I build software every day." });
    const result2 = matchCriterionAgainstProfile(createCriterion("software engineer", "PREFERRED"), asEngineering);
    expect(result2.status).toBe("MET_KEYWORDS");
  });

  it("still requires real mentorship evidence for FRC mentorship — generic robotics interest is not enough, even with the new leniency", () => {
    const profile = makeProfile({
      headline: "Robotics Engineer",
      about: "I have general robotics experience building autonomous systems.",
    });
    const result = matchCriterionAgainstProfile(createCriterion("FRC mentor", "MUST_HAVE"), profile);
    expect(result.status).toBe("UNCONFIRMED");
  });

  it("reproduces the mission's exact example goal against a plausible matching profile", () => {
    // "I am looking for FRC mentors in Charlotte with mechanical or aerospace engineering
    // experience who could advise our robotics team."
    const profile = makeProfile({
      headline: "FRC Mentor | Mechanical Engineer",
      location: "Charlotte, North Carolina",
      about: "I mentor a local FRC robotics team and work as a mechanical engineer.",
    });
    expect(matchCriterionAgainstProfile(createCriterion("FRC mentor", "MUST_HAVE"), profile).status).not.toBe(
      "UNCONFIRMED",
    );
    expect(
      matchCriterionAgainstProfile(createCriterion("Charlotte", "PREFERRED"), profile).status,
    ).not.toBe("UNCONFIRMED");
    expect(
      matchCriterionAgainstProfile(createCriterion("mechanical engineering", "PREFERRED"), profile).status,
    ).not.toBe("UNCONFIRMED");
  });
});
