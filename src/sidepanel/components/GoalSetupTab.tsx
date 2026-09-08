import { useState } from "react";
import type { CriterionImportance, Goal } from "../../models/goal";
import { GOAL_TEXT_MAX_LENGTH, condenseForGoalText, parseGoalDraftFromText } from "../../nlp/goalTextParser";
import { readDocumentText } from "../../documents/readDocumentText";
import { GoalSelector } from "./GoalSelector";
import { CriteriaEditor } from "./CriteriaEditor";

interface GoalSetupTabProps {
  goals: Goal[];
  selectedGoal: Goal | null;
  onSelectGoal: (goalId: string) => void;
  onAddGoal: (name: string) => void;
  onAddGoalFromCriteria: (name: string, criteria: { label: string; importance: CriterionImportance }[]) => void;
  onRenameGoal: (goalId: string, name: string) => void;
  onRemoveGoal: (goalId: string) => void;
  onAddCriterion: (goalId: string, label: string, importance: CriterionImportance) => void;
  onUpdateCriterion: (goalId: string, criterionId: string, updates: Partial<{ label: string; importance: CriterionImportance }>) => void;
  onRemoveCriterion: (goalId: string, criterionId: string) => void;
}

interface DraftCriterionRow {
  id: string;
  label: string;
  importance: CriterionImportance;
}

let draftRowCounter = 0;
function makeDraftRow(label: string, importance: CriterionImportance): DraftCriterionRow {
  draftRowCounter += 1;
  return { id: `draft_${draftRowCounter}`, label, importance };
}

const IMPORTANCE_OPTIONS: { value: CriterionImportance; label: string }[] = [
  { value: "MUST_HAVE", label: "Must Have" },
  { value: "PREFERRED", label: "Preferred" },
  { value: "OPTIONAL", label: "Optional" },
  { value: "EXCLUDED", label: "Excluded" },
];

export function GoalSetupTab(props: GoalSetupTabProps) {
  const { goals, selectedGoal, onSelectGoal, onAddGoal, onAddGoalFromCriteria, onRenameGoal, onRemoveGoal } = props;

  const [text, setText] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftRows, setDraftRows] = useState<DraftCriterionRow[] | null>(null);
  const [newDraftLabel, setNewDraftLabel] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileStatus, setFileStatus] = useState<string | null>(null);

  function generateFromText(sourceText: string): void {
    const draft = parseGoalDraftFromText(sourceText);
    setDraftName(draft.name);
    setDraftRows(draft.criteria.map((c) => makeDraftRow(c.label, c.importance)));
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setFileError(null);
    setFileStatus(`Reading ${file.name}…`);
    const result = await readDocumentText(file);
    if (result.error) {
      setFileError(result.error);
      setFileStatus(null);
      return;
    }

    const fullText = result.text ?? "";
    const condensed = fullText.length > GOAL_TEXT_MAX_LENGTH ? condenseForGoalText(fullText) : fullText;
    setText(condensed);
    generateFromText(condensed);
    setFileStatus(
      fullText.length > GOAL_TEXT_MAX_LENGTH
        ? `Read ${file.name} — condensed the most relevant parts of this longer document into the draft below.`
        : `Read ${file.name}.`,
    );
  }

  function updateDraftRow(id: string, updates: Partial<Pick<DraftCriterionRow, "label" | "importance">>): void {
    setDraftRows((rows) => rows?.map((r) => (r.id === id ? { ...r, ...updates } : r)) ?? null);
  }

  function removeDraftRow(id: string): void {
    setDraftRows((rows) => rows?.filter((r) => r.id !== id) ?? null);
  }

  function addDraftRow(): void {
    const label = newDraftLabel.trim();
    if (!label) return;
    setDraftRows((rows) => [...(rows ?? []), makeDraftRow(label, "PREFERRED")]);
    setNewDraftLabel("");
  }

  function saveDraft(): void {
    if (!draftRows) return;
    onAddGoalFromCriteria(
      draftName.trim() || "New goal",
      draftRows.map((r) => ({ label: r.label, importance: r.importance })),
    );
    setDraftRows(null);
    setDraftName("");
    setText("");
    setFileStatus(null);
  }

  function discardDraft(): void {
    setDraftRows(null);
    setDraftName("");
  }

  return (
    <div className="goal-setup">
      <section className="app__section">
        <h2>Describe who you're looking for</h2>
        <p className="section-hint">
          Plain English is fine, e.g. "I am looking for FRC mentors in Charlotte with mechanical or
          aerospace engineering experience who could advise our robotics team." Finder uses simple,
          local pattern matching to draft criteria — this is not AI understanding, so always review
          the result below before saving.
        </p>
        <textarea
          className="text-area"
          value={text}
          maxLength={GOAL_TEXT_MAX_LENGTH}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe the kind of person you're looking for…"
          rows={4}
        />
        <div className="goal-setup__textarea-footer">
          <span className="char-count">
            {text.length} / {GOAL_TEXT_MAX_LENGTH}
          </span>
          <button type="button" className="button" disabled={!text.trim()} onClick={() => generateFromText(text)}>
            Generate draft criteria
          </button>
        </div>

        <div className="goal-setup__upload">
          <label className="button button--secondary goal-setup__upload-label">
            Upload a document instead
            <input type="file" accept=".txt,.md,.pdf,.docx" onChange={(e) => void handleFileChange(e)} hidden />
          </label>
          {fileStatus && <span className="goal-setup__file-status">{fileStatus}</span>}
          {fileError && <span className="goal-setup__file-error">{fileError}</span>}
        </div>
      </section>

      {draftRows && (
        <section className="app__section draft-review">
          <h2>Review draft criteria</h2>
          <p className="section-hint">
            Generated from your text — nothing is saved yet. Edit, remove, or add criteria, then
            save as a new goal.
          </p>
          <label className="field-label" htmlFor="draft-goal-name">
            Goal name
          </label>
          <input
            id="draft-goal-name"
            className="text-input"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
          />

          <ul className="criterion-list draft-review__list">
            {draftRows.map((row) => (
              <li key={row.id} className="criterion-chip">
                <select
                  className="criterion-chip__importance"
                  value={row.importance}
                  onChange={(e) => updateDraftRow(row.id, { importance: e.target.value as CriterionImportance })}
                >
                  {IMPORTANCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  className="text-input text-input--small criterion-chip__label-input"
                  value={row.label}
                  onChange={(e) => updateDraftRow(row.id, { label: e.target.value })}
                />
                <button type="button" className="icon-button" aria-label={`Remove ${row.label}`} onClick={() => removeDraftRow(row.id)}>
                  ✕
                </button>
              </li>
            ))}
            {draftRows.length === 0 && (
              <li className="section-empty">No criteria were recognized — add some manually below.</li>
            )}
          </ul>

          <form
            className="criterion-group__add"
            onSubmit={(e) => {
              e.preventDefault();
              addDraftRow();
            }}
          >
            <input
              className="text-input text-input--small"
              placeholder="Add a criterion…"
              value={newDraftLabel}
              onChange={(e) => setNewDraftLabel(e.target.value)}
            />
            <button type="submit" className="icon-button icon-button--add" aria-label="Add criterion">
              +
            </button>
          </form>

          <div className="draft-review__actions">
            <button type="button" className="button" onClick={saveDraft}>
              Save as new goal
            </button>
            <button type="button" className="button button--secondary" onClick={discardDraft}>
              Discard
            </button>
          </div>
        </section>
      )}

      <section className="app__section">
        <h2>Saved goals</h2>
        <GoalSelector
          goals={goals}
          selectedGoal={selectedGoal}
          onSelect={onSelectGoal}
          onAdd={onAddGoal}
          onRename={onRenameGoal}
          onRemove={onRemoveGoal}
        />
      </section>

      {selectedGoal && (
        <section className="app__section">
          <h2>Criteria for "{selectedGoal.name}"</h2>
          <CriteriaEditor
            goal={selectedGoal}
            onAdd={props.onAddCriterion}
            onUpdate={props.onUpdateCriterion}
            onRemove={props.onRemoveCriterion}
          />
        </section>
      )}
    </div>
  );
}
