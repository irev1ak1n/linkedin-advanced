import { describe, expect, it } from "vitest";
import { scoreProfileAgainstGoal } from "./scoreProfile";
import { createCriterion, createGoal, type Goal } from "../models/goal";
import type { LinkedInProfile } from "../models/profile";

function makeProfile(overrides: Partial<LinkedInProfile>): LinkedInProfile {
  return { experience: [], education: [], skills: [], extracted: true, ...overrides };
}

function makeGoal(name: string, criteria: Goal["criteria"]): Goal {
  return { ...createGoal(name), criteria };
}

describe("scoreProfileAgainstGoal - basic scoring", () => {
  it("gives a full score when every criterion is met", () => {
    const goal = makeGoal("Test", [
      createCriterion("Python", "MUST_HAVE"),
      createCriterion("robotics", "PREFERRED"),
    ]);
    const profile = makeProfile({ about: "I write Python and build robotics systems." });
    const result = scoreProfileAgainstGoal(goal, profile);
    expect(result.scorePercent).toBe(100);
    expect(result.complete).toBe(true);
    expect(result.reasons).toHaveLength(2);
  });

  it("returns null when the goal has no scoreable criteria", () => {
    const goal = makeGoal("Empty", []);
    const profile = makeProfile({ about: "Anything" });
    const result = scoreProfileAgainstGoal(goal, profile);
    expect(result.scorePercent).toBeNull();
  });

  it("weighs MUST_HAVE more than PREFERRED, and PREFERRED more than OPTIONAL", () => {
    const goal = makeGoal("Weights", [
      createCriterion("Python", "MUST_HAVE"),
      createCriterion("Java", "PREFERRED"),
      createCriterion("Ruby", "OPTIONAL"),
    ]);
    // Only the OPTIONAL one is met — should score much lower than if only MUST_HAVE were met.
    const optionalOnly = scoreProfileAgainstGoal(goal, makeProfile({ about: "I use Ruby." }));
    const mustHaveOnly = scoreProfileAgainstGoal(goal, makeProfile({ about: "I use Python." }));
    expect(mustHaveOnly.scorePercent!).toBeGreaterThan(optionalOnly.scorePercent!);
  });
});

describe("scoreProfileAgainstGoal - unmet MUST_HAVE never reads as a confirmed failure", () => {
  it("caps but never zeroes the score when a MUST_HAVE is unconfirmed", () => {
    const goal = makeGoal("Test", [
      createCriterion("FRC mentor", "MUST_HAVE"),
      createCriterion("robotics", "PREFERRED"),
    ]);
    const profile = makeProfile({ about: "I build robotics systems." });
    const result = scoreProfileAgainstGoal(goal, profile);
    expect(result.scorePercent).not.toBe(0);
    expect(result.scorePercent).toBeLessThanOrEqual(60);
    expect(result.complete).toBe(false);
    expect(result.missing.some((m) => m.criterion.label === "FRC mentor")).toBe(true);
  });
});

describe("scoreProfileAgainstGoal - excluded criteria disqualify", () => {
  it("forces the score to 0 and marks disqualified when an excluded trait is found", () => {
    const goal = makeGoal("Test", [
      createCriterion("machine learning", "PREFERRED"),
      createCriterion("recruiter", "EXCLUDED"),
    ]);
    const profile = makeProfile({ headline: "Technical Recruiter", about: "I work in machine learning." });
    const result = scoreProfileAgainstGoal(goal, profile);
    expect(result.disqualified).toBe(true);
    expect(result.scorePercent).toBe(0);
  });

  it("does not disqualify when the excluded trait is merely unconfirmed", () => {
    const goal = makeGoal("Test", [
      createCriterion("machine learning", "PREFERRED"),
      createCriterion("recruiter", "EXCLUDED"),
    ]);
    const profile = makeProfile({ about: "I work in machine learning." });
    const result = scoreProfileAgainstGoal(goal, profile);
    expect(result.disqualified).toBe(false);
    expect(result.scorePercent).toBe(100);
  });
});

describe("scoreProfileAgainstGoal - the mission's own goal-change example", () => {
  const profile = makeProfile({
    headline: "Robotics Engineer",
    about: "I build autonomous robots and mentor students in general STEM projects.",
  });

  it("scores differently for FRC mentor vs AI collaborator on the SAME profile", () => {
    const frcGoal = makeGoal("FRC mentor", [createCriterion("FRC mentor", "MUST_HAVE")]);
    const aiGoal = makeGoal("AI collaborator", [createCriterion("machine learning", "MUST_HAVE")]);

    const frcResult = scoreProfileAgainstGoal(frcGoal, profile);
    const aiResult = scoreProfileAgainstGoal(aiGoal, profile);

    // Neither is confirmed on this profile, but they are independently evaluated —
    // different criteria produce different (here, identically-absent) reasons/missing sets,
    // proving the score is recomputed from the actual goal, not cached from a prior one.
    expect(frcResult.missing[0].criterion.label).toBe("FRC mentor");
    expect(aiResult.missing[0].criterion.label).toBe("machine learning");
  });

  it("does not give general robotics experience a high match when FRC mentorship is a Must Have", () => {
    const goal = makeGoal("FRC mentor", [createCriterion("FRC mentor", "MUST_HAVE")]);
    const result = scoreProfileAgainstGoal(goal, profile);
    expect(result.scorePercent).toBeLessThanOrEqual(60);
    expect(result.reasons).toHaveLength(0);
  });
});

describe("scoreProfileAgainstGoal - determinism", () => {
  it("produces identical output across repeated calls with the same goal and profile", () => {
    const goal = makeGoal("Test", [
      createCriterion("Python", "MUST_HAVE"),
      createCriterion("robotics", "PREFERRED"),
      createCriterion("recruiter", "EXCLUDED"),
    ]);
    const profile = makeProfile({ about: "I write Python and build robotics systems." });
    const first = scoreProfileAgainstGoal(goal, profile);
    const second = scoreProfileAgainstGoal(goal, profile);
    expect(second).toEqual(first);
  });
});

describe("scoreProfileAgainstGoal - honest incomplete state", () => {
  it("reports an unextracted profile as incomplete rather than a misleading percentage", () => {
    const goal = makeGoal("Test", [createCriterion("Python", "MUST_HAVE")]);
    const profile: LinkedInProfile = { experience: [], education: [], skills: [], extracted: false };
    const result = scoreProfileAgainstGoal(goal, profile);
    expect(result.profileExtracted).toBe(false);
    expect(result.complete).toBe(false);
  });
});
