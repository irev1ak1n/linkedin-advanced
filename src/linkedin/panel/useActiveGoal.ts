import { useSyncExternalStore } from "react";
import { getGoalStoreState, initGoalStore, subscribeGoalStore, type GoalStoreState } from "./goalStore";

/**
 * The currently-selected goal, live — edits made in the side panel's Goal Setup UI (a different
 * criterion, or switching which goal is active) reach this within one chrome.storage.onChanged
 * tick, and PanelApp recomputes the score on the next render since it derives the result fresh
 * from (goal, profile) rather than caching it anywhere.
 */
export function useActiveGoal(): GoalStoreState {
  initGoalStore();
  return useSyncExternalStore(subscribeGoalStore, getGoalStoreState);
}
