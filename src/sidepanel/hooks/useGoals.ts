import { useCallback, useEffect, useState } from "react";
import { createCriterion, createGoal, type Criterion, type CriterionImportance, type Goal } from "../../models/goal";
import { loadGoals, loadSelectedGoalId, saveGoals, saveSelectedGoalId } from "../../storage/goalsRepository";

export interface UseGoalsResult {
  goals: Goal[];
  selectedGoal: Goal | null;
  loaded: boolean;
  selectGoal: (goalId: string) => void;
  addGoal: (name: string) => void;
  renameGoal: (goalId: string, name: string) => void;
  removeGoal: (goalId: string) => void;
  addCriterion: (goalId: string, label: string, importance: CriterionImportance) => void;
  updateCriterion: (goalId: string, criterionId: string, updates: Partial<Pick<Criterion, "label" | "importance">>) => void;
  removeCriterion: (goalId: string, criterionId: string) => void;
}

export function useGoals(): UseGoalsResult {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const [loadedGoals, storedSelectedId] = await Promise.all([loadGoals(), loadSelectedGoalId()]);
      setGoals(loadedGoals);
      setSelectedGoalId(storedSelectedId ?? loadedGoals[0]?.id);
      setLoaded(true);
    })();
  }, []);

  const persist = useCallback((next: Goal[]) => {
    setGoals(next);
    void saveGoals(next);
  }, []);

  const selectGoal = useCallback((goalId: string) => {
    setSelectedGoalId(goalId);
    void saveSelectedGoalId(goalId);
  }, []);

  const addGoal = useCallback(
    (name: string) => {
      const goal = createGoal(name);
      persist([...goals, goal]);
      selectGoal(goal.id);
    },
    [goals, persist, selectGoal],
  );

  const renameGoal = useCallback(
    (goalId: string, name: string) => {
      persist(goals.map((g) => (g.id === goalId ? { ...g, name } : g)));
    },
    [goals, persist],
  );

  const removeGoal = useCallback(
    (goalId: string) => {
      const next = goals.filter((g) => g.id !== goalId);
      persist(next);
      if (selectedGoalId === goalId) selectGoal(next[0]?.id ?? "");
    },
    [goals, persist, selectGoal, selectedGoalId],
  );

  const addCriterion = useCallback(
    (goalId: string, label: string, importance: CriterionImportance) => {
      const trimmed = label.trim();
      if (!trimmed) return;
      persist(
        goals.map((g) => (g.id === goalId ? { ...g, criteria: [...g.criteria, createCriterion(trimmed, importance)] } : g)),
      );
    },
    [goals, persist],
  );

  const updateCriterion = useCallback(
    (goalId: string, criterionId: string, updates: Partial<Pick<Criterion, "label" | "importance">>) => {
      persist(
        goals.map((g) =>
          g.id === goalId
            ? { ...g, criteria: g.criteria.map((c) => (c.id === criterionId ? { ...c, ...updates } : c)) }
            : g,
        ),
      );
    },
    [goals, persist],
  );

  const removeCriterion = useCallback(
    (goalId: string, criterionId: string) => {
      persist(goals.map((g) => (g.id === goalId ? { ...g, criteria: g.criteria.filter((c) => c.id !== criterionId) } : g)));
    },
    [goals, persist],
  );

  const selectedGoal = goals.find((g) => g.id === selectedGoalId) ?? null;

  return {
    goals,
    selectedGoal,
    loaded,
    selectGoal,
    addGoal,
    renameGoal,
    removeGoal,
    addCriterion,
    updateCriterion,
    removeCriterion,
  };
}
