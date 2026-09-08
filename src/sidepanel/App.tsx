import { useMemo } from "react";
import { useActiveProfile } from "./hooks/useActiveProfile";
import { useGoals } from "./hooks/useGoals";
import { scoreProfileAgainstGoal } from "../matching/scoreProfile";
import { GoalSelector } from "./components/GoalSelector";
import { CriteriaEditor } from "./components/CriteriaEditor";
import { MatchScoreCard } from "./components/MatchScoreCard";
import { MatchReasonsList } from "./components/MatchReasonsList";
import { MissingList } from "./components/MissingList";
import { ProfileBanner } from "./components/ProfileBanner";

export default function App() {
  const { status, profile } = useActiveProfile();
  const {
    goals,
    selectedGoal,
    loaded,
    selectGoal,
    addGoal,
    renameGoal,
    removeGoal,
    addCriterion,
    updateCriterion,
    removeCriterion,
  } = useGoals();

  const result = useMemo(() => {
    if (!selectedGoal || !profile) return null;
    return scoreProfileAgainstGoal(selectedGoal, profile);
  }, [selectedGoal, profile]);

  return (
    <div className="app">
      <header className="app__header">
        <h1>Finder</h1>
      </header>

      <ProfileBanner status={status} profile={profile} />

      {!loaded ? (
        <p className="section-empty">Loading your goals…</p>
      ) : (
        <>
          <GoalSelector
            goals={goals}
            selectedGoal={selectedGoal}
            onSelect={selectGoal}
            onAdd={addGoal}
            onRename={renameGoal}
            onRemove={removeGoal}
          />

          {selectedGoal && (
            <>
              <section className="app__section">
                <h2>Criteria</h2>
                <CriteriaEditor
                  goal={selectedGoal}
                  onAdd={addCriterion}
                  onUpdate={updateCriterion}
                  onRemove={removeCriterion}
                />
              </section>

              <section className="app__section">
                <h2>Match %</h2>
                <MatchScoreCard result={result} />
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
        </>
      )}
    </div>
  );
}
