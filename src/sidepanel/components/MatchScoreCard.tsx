import type { MatchResult } from "../../matching/scoreProfile";

interface MatchScoreCardProps {
  result: MatchResult | null;
}

export function MatchScoreCard({ result }: MatchScoreCardProps) {
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
    <div className="match-score">
      <div className="match-score__value">{result.scorePercent}%</div>
      {!result.complete && (
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
