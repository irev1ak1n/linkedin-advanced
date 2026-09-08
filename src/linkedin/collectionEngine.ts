// The state machine behind scroll-based collection — deliberately separate from both the DOM
// adapter (profileAdapter.ts, which only ever answers "what does the page look like right
// now") and the chrome.runtime messaging glue (content.ts). Every real side effect (reading
// the DOM, checking scroll position, the clock) is injected, so this file can be unit-tested
// with no jsdom, no timers, and no chrome APIs at all — the same dependency-injection
// discipline used elsewhere in this codebase for exactly that reason.
import { foundSections } from "../models/profile";
import type { LinkedInProfile } from "../models/profile";
import type { CollectionState } from "../models/collection";

/** No further change observed for this long before a profile can be considered settled — a
 * STABILITY signal (nothing new has appeared), not a blind "N seconds since the page loaded"
 * timer: it resets every time the extracted profile actually changes, so a slow-loading
 * profile that's still gaining content never gets cut off early. */
const QUIET_PERIOD_MS = 2500;

export interface CollectionEngineDeps {
  now: () => number;
  extractProfile: () => LinkedInProfile;
  getProfileKey: () => string | null;
  /** True once the user has scrolled at or near the bottom of the page — combined with the
   * quiet period so "settled" reflects both "nothing new is appearing" AND "there was a real
   * chance to see more," not either alone. */
  isNearDocumentEnd: () => boolean;
  onUpdate: (profileKey: string, profile: LinkedInProfile, collection: CollectionState) => void;
  onReset: (profileKey: string) => void;
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

export function createCollectionEngine(deps: CollectionEngineDeps): CollectionEngine {
  let profileKey: string | null = null;
  let lastProfile: LinkedInProfile | null = null;
  let collection: CollectionState = { status: "collecting", sectionsFound: [], lastChangedAt: deps.now(), reachedDocumentEnd: false };

  function resetFor(newKey: string): void {
    profileKey = newKey;
    lastProfile = null;
    collection = { status: "collecting", sectionsFound: [], lastChangedAt: deps.now(), reachedDocumentEnd: false };
    deps.onReset(newKey);
  }

  function tick(): void {
    const currentKey = deps.getProfileKey();
    if (currentKey === null) {
      // Not a supported profile page right now — nothing to collect; leave any prior state
      // alone rather than reset it away (the user may just be mid-navigation).
      return;
    }
    if (currentKey !== profileKey) {
      resetFor(currentKey);
    }

    const profile = deps.extractProfile();
    const now = deps.now();
    let changed = false;

    if (!lastProfile || !sameProfile(lastProfile, profile)) {
      lastProfile = profile;
      collection = {
        ...collection,
        sectionsFound: foundSections(profile),
        lastChangedAt: now,
        status: "collecting", // any real change means we are, by definition, still collecting
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
