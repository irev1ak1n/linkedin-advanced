// A short, deterministic comparison of a goal's own name against a profile's headline — NOT a
// criterion match (that's scoreProfileAgainstGoal's job), just a quick "does this person's
// stated role look related to what I'm looking for" signal for the top of the analysis view.
// Purely keyword-based, using the same normalization/stemming as the rest of the matcher — no
// AI/LLM call, no invented semantic understanding.
import type { LinkedInProfile } from "../models/profile";
import { significantKeywords, stem } from "./textNormalize";

export type TitleAlignmentLevel = "aligned" | "partial" | "unclear";

export interface TitleAlignmentResult {
  level: TitleAlignmentLevel;
  summary: string;
}

export function assessTitleAlignment(goalName: string, profile: LinkedInProfile): TitleAlignmentResult {
  const headline = profile.headline;
  if (!headline) {
    return { level: "unclear", summary: "No headline available yet to compare against your goal." };
  }

  const goalKeywords = significantKeywords(goalName).map(stem);
  if (goalKeywords.length === 0) {
    return { level: "unclear", summary: "Your goal name doesn't have specific enough terms to compare." };
  }

  const headlineWords = new Set(significantKeywords(headline).map(stem));
  const matchedCount = goalKeywords.filter((keyword) => headlineWords.has(keyword)).length;

  if (matchedCount === goalKeywords.length) {
    return { level: "aligned", summary: `"${headline}" closely matches "${goalName}".` };
  }
  if (matchedCount > 0) {
    return { level: "partial", summary: `"${headline}" is partially related to "${goalName}".` };
  }
  return { level: "unclear", summary: `"${headline}" doesn't obviously relate to "${goalName}" by title alone.` };
}
