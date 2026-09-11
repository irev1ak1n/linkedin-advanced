// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Goal } from "../../models/goal";

type StorageChange = { oldValue?: unknown; newValue?: unknown };
type ChangeListener = (changes: Record<string, StorageChange>, areaName: string) => void;

/** A minimal fake of the two chrome.storage.local pieces goalStore.ts actually uses — enough to
 * prove the store reacts to a real chrome.storage.onChanged event the way the side panel's own
 * writes would trigger it, without needing a real browser. */
function installFakeChromeStorage(initial: Record<string, unknown>) {
  const data: Record<string, unknown> = { ...initial };
  const listeners: ChangeListener[] = [];

  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: (keys: string | string[]) =>
          Promise.resolve(
            (Array.isArray(keys) ? keys : [keys]).reduce<Record<string, unknown>>((acc, key) => {
              if (key in data) acc[key] = data[key];
              return acc;
            }, {}),
          ),
        set: (items: Record<string, unknown>) => {
          const changes: Record<string, StorageChange> = {};
          for (const [key, value] of Object.entries(items)) {
            changes[key] = { oldValue: data[key], newValue: value };
            data[key] = value;
          }
          listeners.forEach((listener) => listener(changes, "local"));
          return Promise.resolve();
        },
      },
      onChanged: {
        addListener: (listener: ChangeListener) => listeners.push(listener),
        removeListener: (listener: ChangeListener) => {
          const index = listeners.indexOf(listener);
          if (index !== -1) listeners.splice(index, 1);
        },
      },
    },
  };
}

function goal(id: string, name: string): Goal {
  return { id, name, criteria: [] };
}

async function waitUntil(predicate: () => boolean, timeoutMs = 500): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitUntil timed out");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("goalStore", () => {
  beforeEach(() => {
    // goalStore.ts keeps module-level state — force a fresh module instance per test so one
    // test's chrome.storage.onChanged subscription never leaks into the next.
    vi.resetModules();
  });

  it("loads the initially-selected goal on init", async () => {
    installFakeChromeStorage({
      "finder.goalsSeeded.v1": true,
      "finder.goals.v1": [goal("g1", "Goal A"), goal("g2", "Goal B")],
      "finder.selectedGoalId.v1": "g1",
    });

    const { initGoalStore, getGoalStoreState } = await import("./goalStore");
    initGoalStore();
    await waitUntil(() => getGoalStoreState().loaded);

    expect(getGoalStoreState().goal?.name).toBe("Goal A");
  });

  it("picks up a goal switch made elsewhere (the side panel) via chrome.storage.onChanged, with no re-collection involved", async () => {
    installFakeChromeStorage({
      "finder.goalsSeeded.v1": true,
      "finder.goals.v1": [goal("g1", "Goal A"), goal("g2", "Goal B")],
      "finder.selectedGoalId.v1": "g1",
    });

    const { initGoalStore, getGoalStoreState } = await import("./goalStore");
    initGoalStore();
    await waitUntil(() => getGoalStoreState().loaded);
    expect(getGoalStoreState().goal?.name).toBe("Goal A");

    // Simulate the side panel writing a new selection — the exact write useGoals.ts performs.
    await chrome.storage.local.set({ "finder.selectedGoalId.v1": "g2" });
    await waitUntil(() => getGoalStoreState().goal?.name === "Goal B");

    expect(getGoalStoreState().goal?.id).toBe("g2");
  });

  it("picks up an edited criterion for the currently-active goal", async () => {
    const goalA: Goal = { id: "g1", name: "Goal A", criteria: [{ id: "c1", label: "Python", importance: "MUST_HAVE" }] };
    installFakeChromeStorage({
      "finder.goalsSeeded.v1": true,
      "finder.goals.v1": [goalA],
      "finder.selectedGoalId.v1": "g1",
    });

    const { initGoalStore, getGoalStoreState } = await import("./goalStore");
    initGoalStore();
    await waitUntil(() => getGoalStoreState().loaded);
    expect(getGoalStoreState().goal?.criteria[0].label).toBe("Python");

    const updatedGoalA: Goal = { ...goalA, criteria: [{ id: "c1", label: "Java", importance: "MUST_HAVE" }] };
    await chrome.storage.local.set({ "finder.goals.v1": [updatedGoalA] });
    await waitUntil(() => getGoalStoreState().goal?.criteria[0].label === "Java");

    expect(getGoalStoreState().goal?.criteria[0].label).toBe("Java");
  });
});
