// Deterministic scoring engine — combines criterionMatcher's per-criterion results into one
// Match %, with full evidence preserved. Pure function of a Goal and a LinkedInProfile: no
// AI/LLM call, no network request, no hidden state. The same goal and profile always produce
// the same MatchResult.
import type { Criterion, CriterionImportance, Goal } from "../models/goal";
import type { LinkedInProfile } from "../models/profile";
import { type CriterionEvidence, matchCriterionAgainstProfile } from "./criterionMatcher";

export type MatchReasonStatus = "MET" | "EXCLUDED_MATCH";

export interface MatchReason {
  criterion: Criterion;
  status: MatchReasonStatus;
  /** "high" for an exact-phrase match, "moderate" for a same-field all-keywords match —
   * shown in the UI so a strong verbatim match and a looser keyword match are never
   * presented as equally certain. */
  confidence?: "high" | "moderate";
  evidence: CriterionEvidence;
}

export interface MissingItem {
  criterion: Criterion;
  /** A related-but-inconclusive mention, when one exists — never invented, only ever the
   * matcher's own partialEvidence passed straight through. */
  note?: string;
}

export interface MatchResult {
  /** null only when the goal has no scoreable (non-EXCLUDED) criteria at all — there is
   * nothing to compute a percentage from, so showing 0% or 100% would both be misleading. */
  scorePercent: number | null;
  /** True when an EXCLUDED criterion was actually found on the profile — the score is forced
   * to 0 and every other criterion is skipped, since a dealbreaker match makes the rest moot. */
  disqualified: boolean;
  reasons: MatchReason[];
  missing: MissingItem[];
  /** False whenever at least one MUST_HAVE criterion could not be confirmed — the mission's
   * "show an honest incomplete state rather than a misleading percentage" requirement. The UI
   * uses this to cap and label the score rather than presenting it as final. */
  complete: boolean;
  /** Mirrors LinkedInProfile.extracted — lets the UI distinguish "scored, but incomplete
   * because required info is missing" from "nothing could be read from this page at all." */
  profileExtracted: boolean;
}

const IMPORTANCE_WEIGHT: Record<Exclude<CriterionImportance, "EXCLUDED">, number> = {
  MUST_HAVE: 3,
  PREFERRED: 2,
  OPTIONAL: 1,
};

/** A profile missing even one MUST_HAVE can never be shown as a strong match, no matter how
 * well it scores on everything else — but it is also never zeroed outright, since "not
 * confirmed" is not "confirmed absent" (the mission's explicit distinction). */
const MUST_HAVE_UNCONFIRMED_CAP = 60;

export function scoreProfileAgainstGoal(goal: Goal, profile: LinkedInProfile): MatchResult {
  const reasons: MatchReason[] = [];
  const missing: MissingItem[] = [];

  const excludedCriteria = goal.criteria.filter((c) => c.importance === "EXCLUDED");
  for (const criterion of excludedCriteria) {
    const match = matchCriterionAgainstProfile(criterion, profile);
    if (match.status !== "UNCONFIRMED" && match.evidence) {
      return {
        scorePercent: 0,
        disqualified: true,
        reasons: [{ criterion, status: "EXCLUDED_MATCH", evidence: match.evidence }],
        missing: [],
        complete: profile.extracted,
        profileExtracted: profile.extracted,
      };
    }
  }

  const scoreable = goal.criteria.filter(
    (c): c is Criterion & { importance: Exclude<CriterionImportance, "EXCLUDED"> } => c.importance !== "EXCLUDED",
  );
  let totalWeight = 0;
  let earnedWeight = 0;
  let mustHaveUnconfirmed = false;

  for (const criterion of scoreable) {
    const weight = IMPORTANCE_WEIGHT[criterion.importance];
    totalWeight += weight;

    const match = matchCriterionAgainstProfile(criterion, profile);
    if (match.status === "MET_EXACT" || match.status === "MET_KEYWORDS") {
      earnedWeight += weight;
      reasons.push({
        criterion,
        status: "MET",
        confidence: match.status === "MET_EXACT" ? "high" : "moderate",
        evidence: match.evidence!,
      });
    } else {
      if (criterion.importance === "MUST_HAVE") mustHaveUnconfirmed = true;
      missing.push({
        criterion,
        note: match.partialEvidence
          ? `Related mention found, but not a clear match: "${match.partialEvidence.snippet}"`
          : undefined,
      });
    }
  }

  if (totalWeight === 0) {
    return {
      scorePercent: null,
      disqualified: false,
      reasons,
      missing,
      complete: profile.extracted,
      profileExtracted: profile.extracted,
    };
  }

  const rawScore = Math.round((earnedWeight / totalWeight) * 100);
  const scorePercent = mustHaveUnconfirmed ? Math.min(rawScore, MUST_HAVE_UNCONFIRMED_CAP) : rawScore;

  return {
    scorePercent,
    disqualified: false,
    reasons,
    missing,
    complete: profile.extracted && !mustHaveUnconfirmed,
    profileExtracted: profile.extracted,
  };
}
