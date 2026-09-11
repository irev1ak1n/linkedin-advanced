// A coarse, human-readable label for a MatchResult's score — used only by the analysis view's
// summary card, never by the scoring engine itself (scoreProfile.ts remains the one source of
// the actual percentage). Deterministic, pure function of a MatchResult.
import type { MatchResult } from "./scoreProfile";

export type MatchLevel = "excluded" | "not_enough_info" | "low" | "good" | "strong";

export const MATCH_LEVEL_LABELS: Record<MatchLevel, string> = {
  excluded: "Excluded",
  not_enough_info: "Not Enough Info",
  low: "Low Match",
  good: "Good Match",
  strong: "Strong Match",
};

/** A simple, fixed threshold scheme — not calibrated against any hiring/mentoring outcome
 * data, just a readable way to group the same underlying deterministic score into bands for
 * display. The score itself (and how it was computed) is unaffected. */
const STRONG_THRESHOLD = 75;
const GOOD_THRESHOLD = 45;

export function matchLevel(result: MatchResult): MatchLevel {
  if (result.disqualified) return "excluded";
  if (result.scorePercent === null) return "not_enough_info";
  if (result.scorePercent >= STRONG_THRESHOLD) return "strong";
  if (result.scorePercent >= GOOD_THRESHOLD) return "good";
  return "low";
}
