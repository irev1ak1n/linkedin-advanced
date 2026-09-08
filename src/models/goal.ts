// A user-authored goal ("what kind of person am I looking for") and its editable criteria.
// Criteria are free-text and user-defined — there is no fixed taxonomy — matched
// deterministically against profile text by src/matching (never by an AI call).

export type CriterionImportance = "MUST_HAVE" | "PREFERRED" | "OPTIONAL" | "EXCLUDED";

export interface Criterion {
  id: string;
  /** Free text the user typed, e.g. "FRC mentor", "Python", "still in college". */
  label: string;
  importance: CriterionImportance;
}

export interface Goal {
  id: string;
  name: string;
  criteria: Criterion[];
}

let idCounter = 0;

/** Timestamp-plus-counter id — unique within a single session, which is all that's needed
 * since goals/criteria are only ever referenced from local storage, never shared or synced
 * across devices in this milestone. */
export function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

export function createCriterion(label: string, importance: CriterionImportance): Criterion {
  return { id: generateId("criterion"), label, importance };
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
