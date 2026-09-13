// A user-authored goal ("what kind of person am I looking for") and its editable criteria.
// Criteria are free-text and user-defined — there is no fixed taxonomy — matched
// deterministically against profile text by src/matching (never by an AI call).

export type CriterionImportance = "MUST_HAVE" | "PREFERRED" | "OPTIONAL" | "EXCLUDED";

/** What KIND of fact a criterion represents — display-only, never read by matching (see
 * src/matching), which only ever looks at `label`/`importance`. Lets the in-page panel's
 * compact "Your ideal match" card show a short, readable heading ("Role", "Location", ...)
 * instead of a flat list, while the actual criterion driving the score stays exactly the same
 * object. Set by the NLP parser when it recognizes which extraction pattern produced a
 * criterion; left unset for manually-added criteria, which fall back to an importance-based
 * heading instead (see linkedin/panel/criterionDisplay.ts). */
export type CriterionCategory = "role" | "location" | "experience" | "context" | "other";

export interface Criterion {
  id: string;
  /** Free text the user typed, e.g. "FRC mentor", "Python", "still in college". */
  label: string;
  importance: CriterionImportance;
  category?: CriterionCategory;
  /** Display-only — links criteria that came from the same "X or Y" alternative phrase in the
   * original description (see nlp/goalTextParser.ts's expandSharedTailAlternatives), so the
   * panel can show them as one bullet joined by "or" instead of implying two independent
   * requirements. Never read by matching: each criterion is still scored on its own. */
  groupId?: string;
}

export interface Goal {
  id: string;
  name: string;
  criteria: Criterion[];
  /** Free-form notes the user attaches to this search intent — persisted alongside the goal,
   * never read by matching/scoring. Purely a place to jot context for themselves. */
  notes?: string;
}

let idCounter = 0;

/** Timestamp-plus-counter id — unique within a single session, which is all that's needed
 * since goals/criteria are only ever referenced from local storage, never shared or synced
 * across devices in this milestone. */
export function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

export function createCriterion(
  label: string,
  importance: CriterionImportance,
  options?: { category?: CriterionCategory; groupId?: string },
): Criterion {
  return { id: generateId("criterion"), label, importance, ...options };
}

export function createGoal(name: string): Goal {
  return { id: generateId("goal"), name, criteria: [] };
}

/** Starter examples, matching the mission's own suggestions — fully editable and deletable,
 * never treated as fixed/built-in by any code path. Seeded only the first time the extension
 * runs (see storage/goalsRepository.ts), so a user who deletes them never sees them return. */
export function defaultGoals(): Goal[] {
  return [
    {
      id: generateId("goal"),
      name: "FRC mentor",
      criteria: [
        createCriterion("FRC mentor", "MUST_HAVE"),
        createCriterion("engineering background", "PREFERRED"),
        createCriterion("robotics", "OPTIONAL"),
      ],
    },
    {
      id: generateId("goal"),
      name: "AI collaborator",
      criteria: [
        createCriterion("machine learning", "PREFERRED"),
        createCriterion("research", "OPTIONAL"),
        createCriterion("recruiter", "EXCLUDED"),
      ],
    },
    {
      id: generateId("goal"),
      name: "Internship advice",
      criteria: [
        createCriterion("software engineer", "PREFERRED"),
        createCriterion("intern", "OPTIONAL"),
      ],
    },
    {
      id: generateId("goal"),
      name: "College connection",
      criteria: [createCriterion("student", "PREFERRED"), createCriterion("computer science", "OPTIONAL")],
    },
  ];
}
