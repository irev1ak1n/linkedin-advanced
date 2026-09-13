// The ONE place that decides what color/label a Match % renders as. Every UI surface that
// shows a score (the summary card today, anything else added later) must go through
// `matchDisplayState` rather than re-deriving thresholds itself — the mission is explicit that
// a 25% score must never render green, and the only way to guarantee that across components is
// to centralize the thresholds instead of letting each component pick its own.
import type { MatchResult } from "./scoreProfile";

export type MatchBand = "low" | "potential" | "strong";

/** 0-39 = Low Match (red), 40-69 = Potential Match (amber), 70-100 = Strong Match (green).
 * A starting point per the mission — recalibrate here, and only here, if real-profile testing
 * shows these bands feel wrong; every consumer picks it up automatically. */
const STRONG_THRESHOLD = 70;
const POTENTIAL_THRESHOLD = 40;

/** Below this evidence confidence (see scoreProfile.ts's MatchResult.confidence), a numeric
 * score is too speculative to present as a precise percentage — the UI shows "Limited profile
 * information" instead (see matchDisplayState's `low_confidence` state). */
const LOW_CONFIDENCE_THRESHOLD = 0.4;

export function matchBand(scorePercent: number): MatchBand {
  if (scorePercent >= STRONG_THRESHOLD) return "strong";
  if (scorePercent >= POTENTIAL_THRESHOLD) return "potential";
  return "low";
}

export const MATCH_BAND_LABELS: Record<MatchBand, string> = {
  low: "Low Match",
  potential: "Potential Match",
  strong: "Strong Match",
};

/** Hex colors for the three bands — used directly by inline-styled UI (the shadow-DOM panel
 * doesn't use a CSS framework) so a color change here is guaranteed to reach every consumer. */
export const MATCH_BAND_COLORS: Record<MatchBand, string> = {
  low: "#c0392b",
  potential: "#8a6d00",
  strong: "#057642",
};

/** The full set of states a score display can be in — a superset of MatchBand covering the
 * cases where showing a colored percentage at all would be misleading. */
export type MatchDisplayState =
  | { kind: "excluded" }
  | { kind: "not_enough_info" }
  | { kind: "low_confidence"; scorePercent: number; band: MatchBand }
  | { kind: MatchBand; scorePercent: number };

export function matchDisplayState(result: MatchResult): MatchDisplayState {
  if (result.disqualified) return { kind: "excluded" };
  if (result.scorePercent === null) return { kind: "not_enough_info" };

  const band = matchBand(result.scorePercent);
  if (result.confidence < LOW_CONFIDENCE_THRESHOLD) {
    return { kind: "low_confidence", scorePercent: result.scorePercent, band };
  }
  return { kind: band, scorePercent: result.scorePercent };
}

export function matchDisplayLabel(state: MatchDisplayState): string {
  switch (state.kind) {
    case "excluded":
      return "Excluded";
    case "not_enough_info":
      return "Not Enough Info";
    case "low_confidence":
      return "Limited Profile Information";
    default:
      return MATCH_BAND_LABELS[state.kind];
  }
}

export function matchDisplayColor(state: MatchDisplayState): string {
  switch (state.kind) {
    case "excluded":
      return "#c0392b";
    case "not_enough_info":
      return "#56687a";
    case "low_confidence":
      return "#56687a";
    default:
      return MATCH_BAND_COLORS[state.kind];
  }
}
