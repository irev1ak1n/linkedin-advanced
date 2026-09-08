// Local-only persistence for goals/criteria via chrome.storage.local — never synced to any
// server, since no Finder-operated server exists. Seeds the starter example goals exactly
// once, on first-ever run; a user who deletes them never sees them silently return.
import { defaultGoals, type Goal } from "../models/goal";

const STORAGE_KEY = "finder.goals.v1";
const SEEDED_KEY = "finder.goalsSeeded.v1";

interface GoalsStorageShape {
  [STORAGE_KEY]?: Goal[];
  [SEEDED_KEY]?: boolean;
}

export async function loadGoals(): Promise<Goal[]> {
  const stored = (await chrome.storage.local.get([STORAGE_KEY, SEEDED_KEY])) as GoalsStorageShape;
  if (stored[SEEDED_KEY]) {
    return stored[STORAGE_KEY] ?? [];
  }

  const seeded = defaultGoals();
  await chrome.storage.local.set({ [STORAGE_KEY]: seeded, [SEEDED_KEY]: true });
  return seeded;
}

export async function saveGoals(goals: Goal[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: goals });
}

export async function loadSelectedGoalId(): Promise<string | undefined> {
  const stored = await chrome.storage.local.get("finder.selectedGoalId.v1");
  return stored["finder.selectedGoalId.v1"] as string | undefined;
}

export async function saveSelectedGoalId(goalId: string): Promise<void> {
  await chrome.storage.local.set({ "finder.selectedGoalId.v1": goalId });
}
