import { describe, expect, it } from "vitest";
import { buildContactGuidance } from "./contactGuidance";

describe("buildContactGuidance", () => {
  it("recommends contact and saving for a strong candidate", () => {
    expect(buildContactGuidance("Strong candidate — worth contacting")).toEqual({ contact: "Recommended", save: "Save" });
  });

  it("gives a maybe/consider-saving signal for something worth investigating", () => {
    expect(buildContactGuidance("Consider / investigate further")).toEqual({ contact: "Maybe", save: "Consider saving" });
  });

  it("recommends against contact and skipping for a non-priority profile", () => {
    expect(buildContactGuidance("Not worth prioritizing for this goal")).toEqual({ contact: "Not recommended", save: "Skip" });
  });

  it("is a pure function of the recommendation label alone", () => {
    expect(buildContactGuidance("Low priority")).toEqual(buildContactGuidance("Low priority"));
  });
});
