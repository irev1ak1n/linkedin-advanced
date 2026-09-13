import { describe, expect, it } from "vitest";
import { buildCriterionBullets, headingFor } from "./criterionDisplay";
import { createCriterion } from "../../models/goal";

describe("headingFor", () => {
  it("uses the category heading when one is set", () => {
    expect(headingFor({ importance: "MUST_HAVE", category: "role" })).toBe("Role");
    expect(headingFor({ importance: "PREFERRED", category: "location" })).toBe("Location");
    expect(headingFor({ importance: "PREFERRED", category: "experience" })).toBe("Experience");
    expect(headingFor({ importance: "OPTIONAL", category: "context" })).toBe("Can help with");
  });

  it("always reads Exclude for an excluded criterion, regardless of category", () => {
    expect(headingFor({ importance: "EXCLUDED", category: "role" })).toBe("Exclude");
    expect(headingFor({ importance: "EXCLUDED" })).toBe("Exclude");
  });

  it("falls back to an importance-based heading when there is no category (e.g. manually added)", () => {
    expect(headingFor({ importance: "MUST_HAVE" })).toBe("Must have");
    expect(headingFor({ importance: "PREFERRED" })).toBe("Preferred");
    expect(headingFor({ importance: "OPTIONAL" })).toBe("Optional");
    expect(headingFor({ importance: "PREFERRED", category: "other" })).toBe("Preferred");
  });
});

describe("buildCriterionBullets", () => {
  it("gives every ungrouped criterion its own bullet, in order", () => {
    const criteria = [
      createCriterion("FRC mentor", "MUST_HAVE", { category: "role" }),
      createCriterion("Charlotte", "PREFERRED", { category: "location" }),
    ];
    const bullets = buildCriterionBullets(criteria);
    expect(bullets).toHaveLength(2);
    expect(bullets[0]).toMatchObject({ heading: "Role", text: "FRC mentor", importance: "MUST_HAVE" });
    expect(bullets[1]).toMatchObject({ heading: "Location", text: "Charlotte", importance: "PREFERRED" });
  });

  it("joins criteria sharing a groupId into one bullet with 'or', preserving the alternative meaning", () => {
    const criteria = [
      createCriterion("mechanical engineering", "PREFERRED", { category: "experience", groupId: "experience-alternatives" }),
      createCriterion("aerospace engineering", "PREFERRED", { category: "experience", groupId: "experience-alternatives" }),
    ];
    const bullets = buildCriterionBullets(criteria);
    expect(bullets).toHaveLength(1);
    expect(bullets[0].text).toBe("Mechanical engineering or aerospace engineering");
    expect(bullets[0].heading).toBe("Experience");
    expect(bullets[0].memberIds).toHaveLength(2);
  });

  it("never merges independently-found criteria that happen to share a category but not a groupId", () => {
    const criteria = [
      createCriterion("robotics", "OPTIONAL", { category: "context" }),
      createCriterion("software", "OPTIONAL", { category: "context" }),
    ];
    const bullets = buildCriterionBullets(criteria);
    expect(bullets).toHaveLength(2);
    expect(bullets.map((b) => b.text)).toEqual(["Robotics", "Software"]);
  });

  it("keeps an excluded criterion as its own distinct bullet", () => {
    const criteria = [
      createCriterion("software engineer", "PREFERRED", { category: "role" }),
      createCriterion("recruiter", "EXCLUDED"),
    ];
    const bullets = buildCriterionBullets(criteria);
    expect(bullets.find((b) => b.text === "Recruiter")?.heading).toBe("Exclude");
  });

  it("never fabricates words beyond what the underlying criteria's labels contain", () => {
    const criteria = [createCriterion("mentor", "MUST_HAVE", { category: "role" })];
    const bullets = buildCriterionBullets(criteria);
    expect(bullets[0].text.toLowerCase()).toBe("mentor");
  });
});
