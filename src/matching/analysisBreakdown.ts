// Groups an existing MatchResult's reasons/missing items into the "Must-Have Skills" /
// "Nice-to-Have / Preferred" chip breakdown the analysis view renders — pure presentation
// mapping over data scoreProfileAgainstGoal already computed; no new matching logic here.
import type { CriterionImportance } from "../models/goal";
import type { MatchResult } from "./scoreProfile";

export interface BreakdownChip {
  label: string;
  matched: boolean;
  /** Evidence snippet for a matched chip, or a related-but-inconclusive note for a missing
   * one — never invented, always passed straight through from the underlying MatchResult. */
  detail?: string;
}

export type BreakdownGroupKey = "must_have" | "preferred";

export interface BreakdownGroup {
  key: BreakdownGroupKey;
  title: string;
  chips: BreakdownChip[];
}

const GROUP_IMPORTANCE: Record<BreakdownGroupKey, CriterionImportance[]> = {
  must_have: ["MUST_HAVE"],
  preferred: ["PREFERRED", "OPTIONAL"],
};

const GROUP_TITLES: Record<BreakdownGroupKey, string> = {
  must_have: "Must-Have Skills",
  preferred: "Nice-to-Have / Preferred",
};

/** Only ever returns groups that actually have at least one criterion in them — an empty goal
 * (or a goal with only Excluded criteria) yields no groups at all, never a padded empty shell. */
export function buildMatchBreakdown(result: MatchResult): BreakdownGroup[] {
  const keys: BreakdownGroupKey[] = ["must_have", "preferred"];
  return keys
    .map((key) => {
      const importances = GROUP_IMPORTANCE[key];
      const matchedChips: BreakdownChip[] = result.reasons
        .filter((reason) => importances.includes(reason.criterion.importance))
        .map((reason) => ({ label: reason.criterion.label, matched: true, detail: reason.evidence.snippet }));
      const missingChips: BreakdownChip[] = result.missing
        .filter((item) => importances.includes(item.criterion.importance))
        .map((item) => ({ label: item.criterion.label, matched: false, detail: item.note }));
      return { key, title: GROUP_TITLES[key], chips: [...matchedChips, ...missingChips] };
    })
    .filter((group) => group.chips.length > 0);
}
