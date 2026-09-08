import { useState } from "react";
import type { Goal } from "../../models/goal";

interface GoalSelectorProps {
  goals: Goal[];
  selectedGoal: Goal | null;
  onSelect: (goalId: string) => void;
  onAdd: (name: string) => void;
  onRename: (goalId: string, name: string) => void;
  onRemove: (goalId: string) => void;
}

export function GoalSelector({ goals, selectedGoal, onSelect, onAdd, onRename, onRemove }: GoalSelectorProps) {
  const [newGoalName, setNewGoalName] = useState("");
  const [editingName, setEditingName] = useState(false);

  return (
    <div className="goal-selector">
      <label className="field-label" htmlFor="goal-select">
        Goal
      </label>
      <div className="goal-selector__row">
        <select
          id="goal-select"
          value={selectedGoal?.id ?? ""}
          onChange={(e) => onSelect(e.target.value)}
        >
          {goals.length === 0 && <option value="">No goals yet</option>}
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.name}
            </option>
          ))}
        </select>
        {selectedGoal && (
          <button
            type="button"
            className="icon-button"
            aria-label="Rename goal"
            onClick={() => setEditingName((v) => !v)}
          >
            ✎
          </button>
        )}
        {selectedGoal && goals.length > 1 && (
          <button type="button" className="icon-button" aria-label="Delete goal" onClick={() => onRemove(selectedGoal.id)}>
            ✕
          </button>
        )}
      </div>

      {editingName && selectedGoal && (
        <input
          className="text-input"
          autoFocus
          defaultValue={selectedGoal.name}
          onBlur={(e) => {
            const value = e.target.value.trim();
            if (value) onRename(selectedGoal.id, value);
            setEditingName(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      )}

      <form
        className="goal-selector__add"
        onSubmit={(e) => {
          e.preventDefault();
          const name = newGoalName.trim();
          if (!name) return;
          onAdd(name);
          setNewGoalName("");
        }}
      >
        <input
          className="text-input"
          placeholder="New goal name, e.g. Startup founder"
          value={newGoalName}
          onChange={(e) => setNewGoalName(e.target.value)}
        />
        <button type="submit" className="button button--secondary">
          Add goal
        </button>
      </form>
    </div>
  );
}
