import type { MatchResult } from "../../matching/scoreProfile";
import { matchLevel, MATCH_LEVEL_LABELS } from "../../matching/matchLevel";
import { buildMatchBreakdown } from "../../matching/analysisBreakdown";
import { assessTitleAlignment } from "../../matching/titleAlignment";
import type { LinkedInProfile } from "../../models/profile";

interface AnalysisViewProps {
  result: MatchResult;
  goalName: string;
  profile: LinkedInProfile;
}

/** State B of the two-stage panel: the final, non-provisional Match Breakdown — only ever
 * rendered once collection has settled (or the user explicitly asked to analyze early), never
 * shown as a preview of an in-progress read. */
export function AnalysisView({ result, goalName, profile }: AnalysisViewProps) {
  const level = matchLevel(result);
  const groups = buildMatchBreakdown(result);
  const titleAlignment = assessTitleAlignment(goalName, profile);

  return (
    <div className="lw-analysis">
      <div className={`lw-summary-card lw-summary-card--${level}`}>
        <div className="lw-summary-card__level">{MATCH_LEVEL_LABELS[level]}</div>
        {result.scorePercent !== null && <div className="lw-summary-card__score">{result.scorePercent}%</div>}
        <div className="lw-summary-card__target">For: {goalName}</div>
        {result.scorePercent !== null && !result.complete && (
          <p className="lw-summary-card__note">
            Score capped — a Must-Have criterion could not be confirmed on this profile.
          </p>
        )}
        {result.scorePercent === null && (
          <p className="lw-summary-card__note">Add at least one criterion (other than Excluded) to score this profile.</p>
        )}
      </div>

      <section className="lw-section">
        <h3>Title Alignment</h3>
        <p className={`lw-title-alignment lw-title-alignment--${titleAlignment.level}`}>{titleAlignment.summary}</p>
      </section>

      {groups.map((group) => (
        <section className="lw-section" key={group.key}>
          <h3>{group.title}</h3>
          <div className="lw-chips">
            {group.chips.map((chip) => (
              <span
                key={chip.label}
                className={`lw-chip ${chip.matched ? "lw-chip--matched" : "lw-chip--missing"}`}
                title={chip.detail}
              >
                {chip.matched ? "✓" : "✕"} {chip.label}
              </span>
            ))}
          </div>
        </section>
      ))}

      {groups.length === 0 && <p className="lw-empty">No criteria to evaluate for this goal yet.</p>}
    </div>
  );
}
