// The active-goal half of the in-page panel's state — deliberately separate from panelStore.ts
// (which holds collected profile evidence). Keeping these as two independent stores, rather
// than one combined state object, is what makes "changing the goal recalculates instantly from
// already-collected evidence" fall out for free: PanelApp derives the score fresh on every
// render from `scoreProfileAgainstGoal(goal, profile)` — nothing here ever caches a score, only
// the goal itself, so a goal change can never leave a stale percentage behind.
//
// Reads straight from chrome.storage.local (the same storage the side panel's Goal Setup UI
// writes to) and re-reads on chrome.storage.onChanged — an external store polled by React via
// useSyncExternalStore, not a useEffect+useState hook, specifically so the update path has no
// dependency array or stale-closure surface to get wrong.
import type { Goal } from "../../models/goal";
import { GOALS_STORAGE_KEYS, loadGoals, loadSelectedGoalId } from "../../storage/goalsRepository";

export interface GoalStoreState {
  goal: Goal | null;
  loaded: boolean;
}

type Listener = () => void;

let state: GoalStoreState = { goal: null, loaded: false };
const listeners = new Set<Listener>();

function setState(next: GoalStoreState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export function getGoalStoreState(): GoalStoreState {
  return state;
}

export function subscribeGoalStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function refresh(): Promise<void> {
  const [goals, selectedId] = await Promise.all([loadGoals(), loadSelectedGoalId()]);
  const goal = goals.find((g) => g.id === (selectedId ?? goals[0]?.id)) ?? null;
  setState({ goal, loaded: true });
}

function handleStorageChange(changes: Record<string, chrome.storage.StorageChange>, areaName: string): void {
  if (areaName !== "local") return;
  if (GOALS_STORAGE_KEYS.goals in changes || GOALS_STORAGE_KEYS.selectedGoalId in changes) void refresh();
}

let initialized = false;

/** Idempotent — safe to call from every render of every consumer. Starts the storage listener
 * and the first read exactly once, at whichever moment the panel first needs goal data. */
export function initGoalStore(): void {
  if (initialized) return;
  initialized = true;
  chrome.storage.onChanged.addListener(handleStorageChange);
  void refresh();
}
