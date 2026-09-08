// The message shapes exchanged between the LinkedIn content script and the side panel, via
// chrome.runtime messaging. Kept as one shared file so both sides can never drift apart.
import type { CollectionState } from "../models/collection";
import type { LinkedInProfile } from "../models/profile";

export interface RequestProfileMessage {
  type: "FINDER_REQUEST_PROFILE";
}

/** Sent proactively by the content script whenever the extracted profile or its collection
 * state changes, AND in response to FINDER_REQUEST_PROFILE. `profileKey` is the stable
 * identity (see linkedin/profileAdapter.ts's `profileIdentityKey`) so the side panel can tell
 * "this update is for the profile I'm currently showing" from a stale in-flight response for
 * a profile the user has already navigated away from. */
export interface ProfileUpdatedMessage {
  type: "FINDER_PROFILE_UPDATED";
  profileKey: string;
  profile: LinkedInProfile;
  collection: CollectionState;
}

/** Sent the instant the content script detects the user has navigated to a DIFFERENT profile
 * (a new profileKey) — lets the side panel clear the previous profile immediately rather than
 * showing it a moment longer while the new page's content is still being read, which would
 * otherwise mix evidence from two different people. */
export interface ProfileResetMessage {
  type: "FINDER_PROFILE_RESET";
  profileKey: string;
}

export type FinderMessage = RequestProfileMessage | ProfileUpdatedMessage | ProfileResetMessage;

export function isProfileUpdatedMessage(message: unknown): message is ProfileUpdatedMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "FINDER_PROFILE_UPDATED"
  );
}

export function isProfileResetMessage(message: unknown): message is ProfileResetMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "FINDER_PROFILE_RESET"
  );
}
