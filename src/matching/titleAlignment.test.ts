import { describe, expect, it } from "vitest";
import { assessTitleAlignment } from "./titleAlignment";
import type { LinkedInProfile } from "../models/profile";

function profile(overrides: Partial<LinkedInProfile>): LinkedInProfile {
  return {
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    organizations: [],
    volunteering: [],
    extracted: true,
    ...overrides,
  };
}

describe("assessTitleAlignment", () => {
  it("reports unclear when there is no headline yet", () => {
    const result = assessTitleAlignment("FRC mentor", profile({}));
    expect(result.level).toBe("unclear");
  });

  it("reports aligned when every goal keyword appears in the headline", () => {
    const result = assessTitleAlignment("FRC mentor", profile({ headline: "FRC mentor and robotics coach" }));
    expect(result.level).toBe("aligned");
  });

  it("reports aligned across a simple inflection (mentor vs mentoring)", () => {
    const result = assessTitleAlignment("FRC mentoring", profile({ headline: "FRC mentor and robotics coach" }));
    expect(result.level).toBe("aligned");
  });

  it("reports partial when only some goal keywords appear", () => {
    const result = assessTitleAlignment(
      "FRC mentor in Charlotte",
      profile({ headline: "Software Engineer in Charlotte" }),
    );
    expect(result.level).toBe("partial");
  });

  it("reports unclear when no goal keyword appears in the headline at all", () => {
    const result = assessTitleAlignment("FRC mentor", profile({ headline: "Marketing Manager" }));
    expect(result.level).toBe("unclear");
  });
});
