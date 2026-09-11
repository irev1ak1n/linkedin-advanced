import { useGoals } from "./hooks/useGoals";
import { GoalSetupTab } from "./components/GoalSetupTab";

/**
 * The browser side panel is Goal Setup only now — defining a goal, generating/editing its
 * criteria, and managing saved goals. The actual profile-match experience lives on the
 * LinkedIn page itself, as an in-page panel the LinkWise button opens (see
 * linkedin/panel/PanelApp.tsx); it reads the same goals straight from chrome.storage, so
 * anything changed here recalculates there immediately.
 */
export default function App() {
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

  return (
    <div className="app">
      <header className="app__header">
        <h1>LinkWise</h1>
        <p className="section-hint">
          Set up your goal here. Open a LinkedIn profile and click the LinkWise tab on the page
          to see the match analysis.
        </p>
      </header>

      {!loaded ? (
        <p className="section-empty">Loading your goals…</p>
      ) : (
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
      )}
    </div>
  );
}
