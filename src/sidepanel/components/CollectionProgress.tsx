import type { CollectionState } from "../../models/collection";
import type { ProfileSectionName } from "../../models/profile";

interface CollectionProgressProps {
  collection: CollectionState | null;
  forcedAnalysis: boolean;
  onAnalyzeNow: () => void;
}

const SECTION_LABELS: Record<ProfileSectionName, string> = {
  headline: "Headline",
  location: "Location",
  about: "About",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
};

export function CollectionProgress({ collection, forcedAnalysis, onAnalyzeNow }: CollectionProgressProps) {
  if (!collection) return null;

  const isFinal = collection.status === "settled" || forcedAnalysis;
  const foundLabels = collection.sectionsFound.map((s) => SECTION_LABELS[s]);

  return (
    <div className="collection-progress">
      <div className="collection-progress__row">
        <span className={`collection-progress__badge ${isFinal ? "collection-progress__badge--final" : "collection-progress__badge--live"}`}>
          {isFinal ? "Collection complete" : "Collecting as you scroll…"}
        </span>
        {!isFinal && (
          <button type="button" className="button button--secondary button--small" onClick={onAnalyzeNow}>
            Analyze available information
          </button>
        )}
      </div>
      <div className="collection-progress__sections">
        {foundLabels.length > 0 ? (
          <>Found so far: {foundLabels.join(", ")}</>
        ) : (
          <>Reading this profile…</>
        )}
      </div>
      {!isFinal && (
        <p className="collection-progress__hint">
          Keep scrolling the LinkedIn page normally — Finder reads new sections as they load. The
          Match % below will stay marked Provisional until collection settles, or you click
          "Analyze available information."
        </p>
      )}
    </div>
  );
}
