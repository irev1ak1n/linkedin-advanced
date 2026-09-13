// Deterministic scoring engine — combines semanticMatcher's per-criterion evidence strength
// into one Match %, with full evidence preserved. Pure function of a Goal and a LinkedInProfile:
// no AI/LLM call, no network request, no hidden state. The same goal and profile always
// produce the same MatchResult.
//
// No neural embedding model is used for the underlying evidence matching (see
// semanticMatcher.ts). Benchmarked before deciding: bundling Transformers.js plus a small
// quantized embedding model (Xenova/all-MiniLM-L6-v2) would add roughly 30-35MB — the JS
// runtime package alone is ~9.5MB unpacked, and the model's own quantized ONNX weights are
// ~22-25MB (its fp32 weights, measured directly, are 90MB) — against a content-script bundle
// that is currently ~215KB. Under this project's current architecture the in-page panel (and
// therefore this scoring engine) runs INSIDE the LinkedIn content script, so a model that size
// would need to load and run WASM inference on every profile page visit, which is exactly the
// kind of heavy main-thread work that caused a real page-freeze bug earlier in this project.
// The deterministic concept graph in semanticMatcher.ts handles every distinction this
// milestone's own examples call for without that cost; a real embedding-based layer would be a
// reasonable future addition, but only running in an isolated context (the side panel or a
// background/offscreen document) reached by message-passing, not inside the content script.
import type { Criterion, CriterionImportance, Goal } from "../models/goal";
import type { LinkedInProfile } from "../models/profile";
import type { EvidenceStrength } from "../models/evidence";
import { buildProfileEvidence } from "../evidence/buildProfileEvidence";
import { evaluateCriterion, type SemanticEvidence } from "./semanticMatcher";

export interface MatchReason {
  criterion: Criterion;
  /** Only ever "strong" or "moderate" here — weaker evidence lives in `missing` instead, so
   * "why they match" never lists something barely relevant as if it were a real strength. */
  strength: Extract<EvidenceStrength, "strong" | "moderate">;
  evidence: SemanticEvidence;
  explanation: string;
}

export interface MissingItem {
  criterion: Criterion;
  /** "weak" (some related-but-inconclusive context), "missing" (confirmed absent from a
   * reasonably-read profile), or "unknown" (not enough of the profile has loaded to judge) —
   * kept distinct so the UI never presents "we haven't looked yet" as "this isn't there". */
  strength: Extract<EvidenceStrength, "weak" | "missing" | "unknown">;
  note?: string;
}

export interface MatchResult {
  /** null only when the goal has no scoreable (non-EXCLUDED) criteria at all — there is
   * nothing to compute a percentage from, so showing 0% or 100% would both be misleading. */
  scorePercent: number | null;
  /** True when an EXCLUDED criterion was found with STRONG confirmed evidence — moderate/weak
   * evidence for an excluded trait is not confident enough to disqualify on its own. */
  disqualified: boolean;
  reasons: MatchReason[];
  missing: MissingItem[];
  /** False whenever at least one MUST_HAVE criterion did not resolve to strong/moderate
   * evidence — the "show an honest incomplete state rather than a misleading percentage"
   * requirement. The UI uses this to caveat the score rather than presenting it as final. */
  complete: boolean;
  /** Mirrors LinkedInProfile.extracted — lets the UI distinguish "scored, but incomplete
   * because required info is missing" from "nothing could be read from this page at all." */
  profileExtracted: boolean;
  /**
   * 0-1: how much of the goal's total weighted importance was actually assessable (not
   * "unknown") — a 75% score built on full evidence is not the same claim as 75% built on a
   * headline alone. The UI shows "Limited profile information" instead of a bare percentage
   * when this is low (see matchColors.ts's `isLowConfidence`).
   */
  confidence: number;
}

/** Starting weight allocation across the three scoreable importance tiers — a fixed
 * percentage split, not a per-criterion count-based weight, specifically so that adding more
 * Optional criteria can never dilute how much a missing Must-Have costs (see the scoring walk
 * below). Divided evenly among however many criteria exist in each tier. */
const CATEGORY_WEIGHT: Record<Exclude<CriterionImportance, "EXCLUDED">, number> = {
  MUST_HAVE: 55,
  PREFERRED: 30,
  OPTIONAL: 15,
};

/** How much of a criterion's allocated weight it earns, by evidence strength. "unknown" has no
 * entry here on purpose — it is excluded from both the earned and possible totals entirely
 * (see the weighted-average walk below), never treated as a confirmed 0. */
const STRENGTH_MULTIPLIER: Record<Extract<EvidenceStrength, "strong" | "moderate" | "weak" | "missing">, number> = {
  strong: 1.0,
  moderate: 0.7,
  weak: 0.35,
  missing: 0.0,
};

function isReasonStrength(strength: EvidenceStrength): strength is "strong" | "moderate" {
  return strength === "strong" || strength === "moderate";
}

export function scoreProfileAgainstGoal(goal: Goal, profile: LinkedInProfile): MatchResult {
  const evidence = buildProfileEvidence(profile);
  const reasons: MatchReason[] = [];
  const missing: MissingItem[] = [];

  const excludedCriteria = goal.criteria.filter((c) => c.importance === "EXCLUDED");
  for (const criterion of excludedCriteria) {
    const result = evaluateCriterion(criterion, profile, evidence);
    if (result.strength === "strong" && result.evidence) {
      return {
        scorePercent: 0,
        disqualified: true,
        reasons: [],
        missing: [],
        complete: profile.extracted,
        profileExtracted: profile.extracted,
        confidence: 1,
      };
    }
  }

  const scoreable = goal.criteria.filter(
    (c): c is Criterion & { importance: Exclude<CriterionImportance, "EXCLUDED"> } => c.importance !== "EXCLUDED",
  );

  if (scoreable.length === 0) {
    return {
      scorePercent: null,
      disqualified: false,
      reasons,
      missing,
      complete: profile.extracted,
      profileExtracted: profile.extracted,
      confidence: 0,
    };
  }

  const countByCategory: Record<Exclude<CriterionImportance, "EXCLUDED">, number> = {
    MUST_HAVE: 0,
    PREFERRED: 0,
    OPTIONAL: 0,
  };
  for (const criterion of scoreable) countByCategory[criterion.importance] += 1;

  let mustHaveUnsatisfied = false;
  let knownWeightSum = 0;
  let knownEarnedSum = 0;
  let totalWeightSum = 0;

  for (const criterion of scoreable) {
    const nominalWeight = CATEGORY_WEIGHT[criterion.importance] / countByCategory[criterion.importance];
    totalWeightSum += nominalWeight;

    const result = evaluateCriterion(criterion, profile, evidence);

    if (isReasonStrength(result.strength)) {
      reasons.push({ criterion, strength: result.strength, evidence: result.evidence!, explanation: result.explanation });
    } else {
      missing.push({ criterion, strength: result.strength, note: result.partialEvidence?.snippet ?? result.explanation });
    }

    if (criterion.importance === "MUST_HAVE" && !isReasonStrength(result.strength)) {
      mustHaveUnsatisfied = true;
    }

    if (result.strength === "unknown") continue; // excluded from both sums — never a confirmed 0, never free credit

    knownWeightSum += nominalWeight;
    knownEarnedSum += nominalWeight * STRENGTH_MULTIPLIER[result.strength];
  }

  const scorePercent = knownWeightSum > 0 ? Math.round((knownEarnedSum / knownWeightSum) * 100) : null;
  const confidence = totalWeightSum > 0 ? knownWeightSum / totalWeightSum : 0;

  return {
    scorePercent,
    disqualified: false,
    reasons,
    missing,
    complete: profile.extracted && !mustHaveUnsatisfied,
    profileExtracted: profile.extracted,
    confidence,
  };
}
