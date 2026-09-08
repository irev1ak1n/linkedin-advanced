// Deterministic, local, LinkedIn-independent criterion matcher — pure function of a
// Criterion and a LinkedInProfile. No AI/LLM call, no network request, no randomness: the
// same criterion and profile always produce the same result.
//
// Design goal: precision over recall, on purpose. A criterion that could match almost
// anything (a single loose keyword, matched anywhere in the profile) would make "FRC mentor"
// and "general robotics experience" indistinguishable — exactly the false positive the
// mission calls out. Two tiers, both requiring real specificity:
//   1. MET_EXACT   — the criterion's own normalized phrase appears verbatim in one field.
//   2. MET_KEYWORDS — every significant word in the criterion appears in the SAME field
//                     (not scattered across unrelated fields, which would let two
//                     coincidentally-nearby but unrelated mentions count as a match).
// Anything short of that is UNCONFIRMED — never "failed," since a LinkedIn profile's visible
// text can never prove a trait is absent, only that it wasn't mentioned.
import type { Criterion } from "../models/goal";
import { type LinkedInProfile, profileTextFields } from "../models/profile";
import { normalizeText, significantKeywords, truncateSnippet } from "./textNormalize";

export type CriterionMatchStatus = "MET_EXACT" | "MET_KEYWORDS" | "UNCONFIRMED";

export interface CriterionEvidence {
  fieldLabel: string;
  snippet: string;
}

export interface CriterionMatchResult {
  status: CriterionMatchStatus;
  evidence?: CriterionEvidence;
  /** Only ever set when status is UNCONFIRMED and at least one (but not all) significant
   * keyword was found somewhere — a related-but-inconclusive signal, kept distinct from "no
   * signal at all" so the UI can be honest about the difference. */
  partialEvidence?: CriterionEvidence;
}

export function matchCriterionAgainstProfile(
  criterion: Criterion,
  profile: LinkedInProfile,
): CriterionMatchResult {
  const keywords = significantKeywords(criterion.label);
  if (keywords.length === 0) {
    return { status: "UNCONFIRMED" };
  }

  const normalizedCriterion = normalizeText(criterion.label);
  const fields = profileTextFields(profile);

  for (const field of fields) {
    const normalizedField = normalizeText(field.text);
    const matchIndex = normalizedField.indexOf(normalizedCriterion);
    if (matchIndex !== -1) {
      return {
        status: "MET_EXACT",
        evidence: { fieldLabel: field.label, snippet: truncateSnippet(field.text, matchIndex) },
      };
    }
  }

  let bestPartial: { field: (typeof fields)[number]; matchedCount: number } | null = null;

  for (const field of fields) {
    const fieldWords = new Set(normalizeText(field.text).split(" ").filter(Boolean));
    const matchedCount = keywords.filter((keyword) => fieldWords.has(keyword)).length;
    if (matchedCount === keywords.length) {
      return {
        status: "MET_KEYWORDS",
        evidence: { fieldLabel: field.label, snippet: truncateSnippet(field.text) },
      };
    }
    if (matchedCount > 0 && (!bestPartial || matchedCount > bestPartial.matchedCount)) {
      bestPartial = { field, matchedCount };
    }
  }

  if (bestPartial) {
    return {
      status: "UNCONFIRMED",
      partialEvidence: {
        fieldLabel: bestPartial.field.label,
        snippet: truncateSnippet(bestPartial.field.text),
      },
    };
  }

  return { status: "UNCONFIRMED" };
}
