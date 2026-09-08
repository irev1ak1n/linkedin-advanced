import { useState } from "react";
import type { Criterion, CriterionImportance, Goal } from "../../models/goal";

interface CriteriaEditorProps {
  goal: Goal;
  onAdd: (goalId: string, label: string, importance: CriterionImportance) => void;
  onUpdate: (goalId: string, criterionId: string, updates: Partial<Pick<Criterion, "label" | "importance">>) => void;
  onRemove: (goalId: string, criterionId: string) => void;
}

const GROUPS: { importance: CriterionImportance; title: string; hint: string }[] = [
  { importance: "MUST_HAVE", title: "Must Have", hint: "Required — a low/uncertain match here caps the score" },
  { importance: "PREFERRED", title: "Preferred", hint: "Boosts the score when present" },
  { importance: "OPTIONAL", title: "Optional", hint: "A small bonus when present" },
  { importance: "EXCLUDED", title: "Excluded", hint: "Finding this disqualifies the match entirely" },
];

export function CriteriaEditor({ goal, onAdd, onUpdate, onRemove }: CriteriaEditorProps) {
  return (
    <div className="criteria-editor">
      {GROUPS.map((group) => (
        <CriterionGroup
          key={group.importance}
          goal={goal}
          importance={group.importance}
          title={group.title}
          hint={group.hint}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

interface CriterionGroupProps extends CriteriaEditorProps {
  importance: CriterionImportance;
  title: string;
  hint: string;
}

function CriterionGroup({ goal, importance, title, hint, onAdd, onUpdate, onRemove }: CriterionGroupProps) {
  const [draft, setDraft] = useState("");
  const criteria = goal.criteria.filter((c) => c.importance === importance);

  return (
    <div className={`criterion-group criterion-group--${importance.toLowerCase()}`}>
      <div className="criterion-group__header">
        <span className="criterion-group__title">{title}</span>
        <span className="criterion-group__hint">{hint}</span>
      </div>

      <ul className="criterion-list">
        {criteria.map((criterion) => (
          <li key={criterion.id} className="criterion-chip">
            <select
              className="criterion-chip__importance"
              value={criterion.importance}
              onChange={(e) => onUpdate(goal.id, criterion.id, { importance: e.target.value as CriterionImportance })}
              aria-label={`Importance for ${criterion.label}`}
            >
              {GROUPS.map((g) => (
                <option key={g.importance} value={g.importance}>
                  {g.title}
                </option>
              ))}
            </select>
            <span className="criterion-chip__label">{criterion.label}</span>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove ${criterion.label}`}
              onClick={() => onRemove(goal.id, criterion.id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <form
        className="criterion-group__add"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(goal.id, draft, importance);
          setDraft("");
        }}
      >
        <input
          className="text-input text-input--small"
          placeholder={`Add a ${title.toLowerCase()} criterion…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="icon-button icon-button--add" aria-label={`Add ${title} criterion`}>
          +
        </button>
      </form>
    </div>
  );
}
