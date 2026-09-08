import { describe, expect, it } from "vitest";
import { normalizeText, significantKeywords, splitSentences, truncateSnippet } from "./textNormalize";

describe("normalizeText", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeText("FRC Mentor, Robotics!")).toBe("frc mentor robotics");
  });

  it("collapses repeated whitespace", () => {
    expect(normalizeText("Software   Engineer\n\nII")).toBe("software engineer ii");
  });
});

describe("significantKeywords", () => {
  it("removes stopwords", () => {
    expect(significantKeywords("Experience in the field of robotics")).toEqual(["experience", "field", "robotics"]);
  });

  it("deduplicates repeated words", () => {
    expect(significantKeywords("mentor mentor robotics")).toEqual(["mentor", "robotics"]);
  });

  it("returns an empty array for an all-stopword string", () => {
    expect(significantKeywords("the of in")).toEqual([]);
  });

  it("is deterministic across repeated calls", () => {
    const a = significantKeywords("FRC mentor for robotics teams");
    const b = significantKeywords("FRC mentor for robotics teams");
    expect(a).toEqual(b);
  });
});

describe("splitSentences", () => {
  it("splits on sentence punctuation", () => {
    expect(splitSentences("I lead a team. I mentor students!")).toEqual(["I lead a team.", "I mentor students!"]);
  });
});

describe("truncateSnippet", () => {
  it("returns short text unchanged", () => {
    expect(truncateSnippet("short text")).toBe("short text");
  });

  it("truncates long text around the match index", () => {
    const long = "a".repeat(300) + "MATCH" + "b".repeat(300);
    const result = truncateSnippet(long, 300);
    expect(result.length).toBeLessThan(long.length);
    expect(result).toContain("MATCH");
  });
});
