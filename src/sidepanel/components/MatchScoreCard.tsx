import type { MatchResult } from "../../matching/scoreProfile";

interface MatchScoreCardProps {
  result: MatchResult | null;
  /** False while the content script is still actively collecting this profile and the user
   * hasn't asked to analyze early — the score is real (computed from whatever's collected so
   * far) but must never be presented as the final word while more content could still load. */
  isFinal: boolean;
}

export function MatchScoreCard({ result, isFinal }: MatchScoreCardProps) {
  if (!result) {
    return <div className="match-score match-score--empty">Open a LinkedIn profile to see a Match %.</div>;
  }

  if (result.disqualified) {
    return (
      <div className="match-score match-score--disqualified">
        <div className="match-score__value">Excluded</div>
        <div className="match-score__note">This profile matches an excluded criterion.</div>
      </div>
    );
  }

  if (result.scorePercent === null) {
    return (
      <div className="match-score match-score--empty">Add at least one criterion (other than Excluded) to score this profile.</div>
    );
  }

  return (
    <div className={`match-score ${isFinal ? "" : "match-score--provisional"}`}>
      {!isFinal && <div className="match-score__provisional-label">Provisional</div>}
      <div className="match-score__value">{result.scorePercent}%</div>
      {!isFinal && (
        <div className="match-score__note match-score__note--incomplete">
          Still collecting this profile's content — this number can change as more loads.
        </div>
      )}
      {isFinal && !result.complete && (
        <div className="match-score__note match-score__note--incomplete">
          Incomplete — a required (Must Have) criterion couldn't be confirmed from this profile. The
          score is capped until it is.
        </div>
      )}
      {!result.profileExtracted && (
        <div className="match-score__note match-score__note--incomplete">
          This profile hasn't finished rendering, so this score is based on very little information.
        </div>
      )}
    </div>
  );
}
