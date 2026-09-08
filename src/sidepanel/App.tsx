import { useMemo, useState } from "react";
import { useActiveProfile } from "./hooks/useActiveProfile";
import { useGoals } from "./hooks/useGoals";
import { scoreProfileAgainstGoal } from "../matching/scoreProfile";
import { GoalSetupTab } from "./components/GoalSetupTab";
import { ProfileMatchTab } from "./components/ProfileMatchTab";

type TabName = "goal" | "match";

export default function App() {
  const [tab, setTab] = useState<TabName>("match");
  const { status, profile, collection, forcedAnalysis, forceAnalyze, lastRefreshedAt, pollAttempts } =
    useActiveProfile();
  const {
    goals,
    selectedGoal,
    loaded,
    selectGoal,
    addGoal,
    addGoalFromCriteria,
    renameGoal,
    removeGoal,
    addCriterion,
    updateCriterion,
    removeCriterion,
  } = useGoals();

  // Recomputed from whatever evidence is currently collected — never requires re-reading the
  // page, so switching goals or editing a filter updates the score immediately.
  const result = useMemo(() => {
    if (!selectedGoal || !profile) return null;
    return scoreProfileAgainstGoal(selectedGoal, profile);
  }, [selectedGoal, profile]);

  return (
    <div className="app">
      <header className="app__header">
        <h1>Finder</h1>
        <nav className="app__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "goal"}
            className={`app__tab ${tab === "goal" ? "app__tab--active" : ""}`}
            onClick={() => setTab("goal")}
          >
            Goal Setup
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "match"}
            className={`app__tab ${tab === "match" ? "app__tab--active" : ""}`}
            onClick={() => setTab("match")}
          >
            Profile Match
          </button>
        </nav>
      </header>

      {!loaded ? (
        <p className="section-empty">Loading your goals…</p>
      ) : tab === "goal" ? (
        <GoalSetupTab
          goals={goals}
          selectedGoal={selectedGoal}
          onSelectGoal={selectGoal}
          onAddGoal={addGoal}
          onAddGoalFromCriteria={addGoalFromCriteria}
          onRenameGoal={renameGoal}
          onRemoveGoal={removeGoal}
          onAddCriterion={addCriterion}
          onUpdateCriterion={updateCriterion}
          onRemoveCriterion={removeCriterion}
        />
      ) : (
        <ProfileMatchTab
          status={status}
          profile={profile}
          collection={collection}
          forcedAnalysis={forcedAnalysis}
          onAnalyzeNow={forceAnalyze}
          goals={goals}
          selectedGoal={selectedGoal}
          onSelectGoal={selectGoal}
          result={result}
          lastRefreshedAt={lastRefreshedAt}
          pollAttempts={pollAttempts}
        />
      )}
    </div>
  );
}
