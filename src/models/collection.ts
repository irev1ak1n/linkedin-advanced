// Describes HOW MUCH of a profile has been read so far, kept deliberately separate from the
// profile content itself — the UI needs to know "are we still collecting or has this settled"
// independent of what was found, so it never presents a score as final while the page is
// still loading sections underneath it.
import type { ProfileSectionName } from "./profile";

export type CollectionStatus = "collecting" | "settled";

export interface CollectionState {
  status: CollectionStatus;
  /** Sections whose content has actually been captured — the numerator of "Sections analyzed
   * N / M". Never a checklist the profile is required to complete; some profiles genuinely
   * lack a section forever. */
  sectionsFound: ProfileSectionName[];
  /** Sections known to exist on this profile so far — a heading spotted in the DOM, or content
   * already captured for it — the denominator of "Sections analyzed N / M". Always a superset
   * of `sectionsFound`: a section can be detected (heading visible, content still loading)
   * before it is found. Can grow as the user scrolls further; never shrinks back down to a
   * fixed assumed total. */
  sectionsDetected: ProfileSectionName[];
  /** Epoch ms of the last time the extracted profile or detected sections actually changed —
   * used to judge stability (see the quiet-period logic in linkedin/collectionEngine.ts),
   * never a fixed page-load timer. */
  lastChangedAt: number;
  /** True once the user has scrolled at or near the bottom of the page. Required, alongside
   * the quiet period, before collection can be considered settled — lets the UI distinguish
   * "still loading" from "nothing more below." */
  reachedDocumentEnd: boolean;
}

export function initialCollectionState(now: number): CollectionState {
  return {
    status: "collecting",
    sectionsFound: [],
    sectionsDetected: [],
    lastChangedAt: now,
    reachedDocumentEnd: false,
  };
}
