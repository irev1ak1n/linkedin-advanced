// The state machine behind scroll-based collection — deliberately separate from both the DOM
// adapter (profileAdapter.ts, which only ever answers "what does the page look like right
// now") and the chrome.runtime messaging glue (content.ts). Every real side effect (reading
// the DOM, checking scroll position, the clock) is injected, so this file can be unit-tested
// with no jsdom, no timers, and no chrome APIs at all — the same dependency-injection
// discipline used elsewhere in this codebase for exactly that reason.
import { foundSections } from "../models/profile";
import type { LinkedInProfile, ProfileSectionName } from "../models/profile";
import { initialCollectionState, type CollectionState } from "../models/collection";

/** No further change observed for this long before a profile can be considered settled — a
 * STABILITY signal (nothing new has appeared), not a blind "N seconds since the page loaded"
 * timer: it resets every time the extracted profile actually changes, so a slow-loading
 * profile that's still gaining content never gets cut off early. */
const QUIET_PERIOD_MS = 2500;

export interface CollectionEngineDeps {
  now: () => number;
  extractProfile: () => LinkedInProfile;
  /** Which section headings currently exist in the DOM, regardless of whether their content
   * has been captured yet — the denominator half of collection progress (see
   * `CollectionState.sectionsDetected`). A separate call from `extractProfile` so each stays a
   * pure, single-purpose read of the page. */
  detectSections: () => ProfileSectionName[];
  getProfileKey: () => string | null;
  /** True once the user has scrolled at or near the bottom of the page — combined with the
   * quiet period so "settled" reflects both "nothing new is appearing" AND "there was a real
   * chance to see more," not either alone. */
  isNearDocumentEnd: () => boolean;
  onUpdate: (profileKey: string, profile: LinkedInProfile, collection: CollectionState) => void;
  onReset: (profileKey: string) => void;
  /** Called once, the moment the user navigates away from a profile page to anywhere else on
   * LinkedIn (feed, jobs, search, …) — never called repeatedly while already off a profile.
   * Lets the UI show an honest "nothing to analyze here" state instead of a stale profile's
   * last-known evidence, and stops any further collection work until a profile page is back. */
  onLeaveProfile: () => void;
}

export interface CollectionEngine {
  /** Re-reads the page and advances the state machine — call on every debounced mutation, on
   * every scroll-position check, and once immediately on startup. Cheap and idempotent. */
  tick: () => void;
  getCollectionState: () => CollectionState;
  getProfileKey: () => string | null;
}

function sameProfile(a: LinkedInProfile, b: LinkedInProfile): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sameSections(a: ProfileSectionName[], b: ProfileSectionName[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function createCollectionEngine(deps: CollectionEngineDeps): CollectionEngine {
  let profileKey: string | null = null;
  let lastProfile: LinkedInProfile | null = null;
  let collection: CollectionState = initialCollectionState(deps.now());

  function resetFor(newKey: string): void {
    profileKey = newKey;
    lastProfile = null;
    collection = initialCollectionState(deps.now());
    deps.onReset(newKey);
  }

  function tick(): void {
    const currentKey = deps.getProfileKey();
    if (currentKey === null) {
      if (profileKey !== null) {
        // Was on a profile, just navigated away (to /feed/, /jobs/, /search/, …) — stop
        // collecting and clear the stale evidence rather than leaving it displayed as if it
        // still applied to whatever the user is looking at now.
        profileKey = null;
        lastProfile = null;
        collection = initialCollectionState(deps.now());
        deps.onLeaveProfile();
      }
      return;
    }
    if (currentKey !== profileKey) {
      resetFor(currentKey);
    }

    const profile = deps.extractProfile();
    const now = deps.now();
    let changed = false;

    const profileChanged = !lastProfile || !sameProfile(lastProfile, profile);
    if (profileChanged) lastProfile = profile;

    // A section can be *detected* (its heading is visible) slightly before it is *found* (its
    // text has been captured) — sectionsDetected is always at least sectionsFound, so the
    // denominator of "Sections analyzed N / M" never lags behind the numerator.
    const sectionsFound = foundSections(profile);
    const sectionsDetected = Array.from(new Set([...deps.detectSections(), ...sectionsFound])) as ProfileSectionName[];
    const sectionsChanged =
      !sameSections(collection.sectionsFound, sectionsFound) ||
      !sameSections(collection.sectionsDetected, sectionsDetected);

    if (profileChanged || sectionsChanged) {
      collection = {
        ...collection,
        sectionsFound,
        sectionsDetected,
        lastChangedAt: now,
        status: "collecting", // any real forward progress means we are, by definition, still collecting
      };
      changed = true;
    }

    const reachedEnd = collection.reachedDocumentEnd || deps.isNearDocumentEnd();
    if (reachedEnd !== collection.reachedDocumentEnd) {
      collection = { ...collection, reachedDocumentEnd: reachedEnd };
      changed = true;
    }

    const quiet = now - collection.lastChangedAt >= QUIET_PERIOD_MS;
    const shouldBeSettled = quiet && collection.reachedDocumentEnd;
    if (shouldBeSettled && collection.status !== "settled") {
      collection = { ...collection, status: "settled" };
      changed = true;
    }

    if (changed && profileKey) {
      deps.onUpdate(profileKey, profile, collection);
    }
  }

  return {
    tick,
    getCollectionState: () => collection,
    getProfileKey: () => profileKey,
  };
}
