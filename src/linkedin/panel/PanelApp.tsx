import { useState } from "react";
import { useCollectionData } from "./useCollectionData";
import { useActiveGoal } from "./useActiveGoal";
import { ScanningView } from "./ScanningView";
import { AnalysisView } from "./AnalysisView";
import { scoreProfileAgainstGoal } from "../../matching/scoreProfile";

interface PanelAppProps {
  onClose: () => void;
}

/**
 * The in-page LinkWise panel's whole UI. The opener (and this panel) mount on every LinkedIn
 * page, but `profileKey` is only ever non-null while the current URL is a `/in/...` profile
 * (see collectionEngine.ts's `onLeaveProfile`) — everywhere else this shows a plain neutral
 * state rather than pretending there's a profile to analyze. On a profile, exactly two states:
 * Scanning (collection incomplete) and Analysis (collection settled, or the user asked to
 * analyze early) — never a third "in-between" view, and never a final score shown while still
 * Scanning.
 */
export function PanelApp({ onClose }: PanelAppProps) {
  const { profileKey, profile, collection } = useCollectionData();
  const { goal, loaded: goalsLoaded } = useActiveGoal();
  const [forcedKeys, setForcedKeys] = useState<Set<string>>(new Set());

  const forced = profileKey !== null && forcedKeys.has(profileKey);
  const isFinal = forced || collection?.status === "settled";

  const result = goal && profile ? scoreProfileAgainstGoal(goal, profile) : null;

  function handleAnalyzeNow(): void {
    if (!profileKey) return;
    setForcedKeys((prev) => new Set(prev).add(profileKey));
  }

  function renderBody() {
    if (profileKey === null) {
      return <p className="lw-empty">Open a LinkedIn profile to analyze it.</p>;
    }
    if (!profile || !collection) {
      return <p className="lw-empty">Reading this profile…</p>;
    }
    if (!goalsLoaded) {
      return <p className="lw-empty">Loading your goal…</p>;
    }
    if (!goal) {
      return <p className="lw-empty">No active goal set. Click the LinkWise icon in your toolbar to create one.</p>;
    }
    if (!isFinal) {
      return (
        <ScanningView
          profileName={profile.name}
          goalName={goal.name}
          collection={collection}
          onAnalyzeNow={handleAnalyzeNow}
        />
      );
    }
    if (result) {
      return <AnalysisView result={result} goalName={goal.name} profile={profile} />;
    }
    return null;
  }

  return (
    <div className="lw-panel">
      <header className="lw-panel__header">
        <span className="lw-panel__brand">LinkWise</span>
        <button type="button" className="lw-panel__close" aria-label="Close LinkWise panel" onClick={onClose}>
          ✕
        </button>
      </header>
      <div className="lw-panel__body">{renderBody()}</div>
    </div>
  );
}
