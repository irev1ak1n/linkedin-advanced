// Describes HOW MUCH of a profile has been read so far, kept deliberately separate from the
// profile content itself — the UI needs to know "are we still collecting or has this settled"
// independent of what was found, so it never presents a score as final while the page is
// still loading sections underneath it.
import type { ProfileSectionName } from "./profile";

export type CollectionStatus = "collecting" | "settled";

export interface CollectionState {
  status: CollectionStatus;
  /** Sections actually found so far, for progress display — never a checklist the profile is
   * required to complete; some profiles genuinely lack a section forever. */
  sectionsFound: ProfileSectionName[];
  /** Epoch ms of the last time the extracted profile actually changed — used to judge
   * stability (see the quiet-period logic in linkedin/collectionEngine.ts), never a fixed
   * page-load timer. */
  lastChangedAt: number;
  /** True once the user has scrolled at or near the bottom of the page. Required, alongside
   * the quiet period, before collection can be considered settled — lets the UI distinguish
   * "still loading" from "nothing more below." */
  reachedDocumentEnd: boolean;
}

export function initialCollectionState(now: number): CollectionState {
  return { status: "collecting", sectionsFound: [], lastChangedAt: now, reachedDocumentEnd: false };
}
