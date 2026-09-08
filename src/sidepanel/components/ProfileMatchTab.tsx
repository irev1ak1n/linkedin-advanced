import type { Goal } from "../../models/goal";
import type { MatchResult } from "../../matching/scoreProfile";
import type { ActiveProfileStatus } from "../hooks/useActiveProfile";
import type { LinkedInProfile } from "../../models/profile";
import type { CollectionState } from "../../models/collection";
import { ProfileBanner } from "./ProfileBanner";
import { CollectionProgress } from "./CollectionProgress";
import { MatchScoreCard } from "./MatchScoreCard";
import { MatchReasonsList } from "./MatchReasonsList";
import { MissingList } from "./MissingList";

interface ProfileMatchTabProps {
  status: ActiveProfileStatus;
  profile: LinkedInProfile | null;
  collection: CollectionState | null;
  forcedAnalysis: boolean;
  onAnalyzeNow: () => void;
  goals: Goal[];
  selectedGoal: Goal | null;
  onSelectGoal: (goalId: string) => void;
  result: MatchResult | null;
  /** Diagnostic only (temporary) — see useActiveProfile.ts. */
  lastRefreshedAt: number | null;
  pollAttempts: number;
}

export function ProfileMatchTab({
  status,
  profile,
  collection,
  forcedAnalysis,
  onAnalyzeNow,
  goals,
  selectedGoal,
  onSelectGoal,
  result,
  lastRefreshedAt,
  pollAttempts,
}: ProfileMatchTabProps) {
  const isFinal = forcedAnalysis || collection?.status === "settled";

  return (
    <div className="profile-match">
      <ProfileBanner status={status} profile={profile} />

      <p className="section-hint" style={{ fontFamily: "monospace" }}>
        DEBUG: last refresh{" "}
        {lastRefreshedAt ? new Date(lastRefreshedAt).toLocaleTimeString() : "never"} · poll ticks:{" "}
        {pollAttempts}
      </p>

      {status === "ready" && (
        <>
          <section className="app__section">
            <label className="field-label" htmlFor="active-goal-select">
              Active goal
            </label>
            <select
              id="active-goal-select"
              value={selectedGoal?.id ?? ""}
              onChange={(e) => onSelectGoal(e.target.value)}
            >
              {goals.length === 0 && <option value="">No goals yet — set one up first</option>}
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.name}
                </option>
              ))}
            </select>
          </section>

          <section className="app__section">
            <h2>Collection</h2>
            <CollectionProgress collection={collection} forcedAnalysis={forcedAnalysis} onAnalyzeNow={onAnalyzeNow} />
          </section>

          <section className="app__section">
            <h2>Match %</h2>
            <MatchScoreCard result={result} isFinal={isFinal} />
          </section>

          <section className="app__section">
            <h2>Match Reasons</h2>
            <MatchReasonsList reasons={result?.reasons ?? []} />
          </section>

          <section className="app__section">
            <h2>Missing / Unconfirmed</h2>
            <MissingList missing={result?.missing ?? []} />
          </section>
        </>
      )}
    </div>
  );
}
