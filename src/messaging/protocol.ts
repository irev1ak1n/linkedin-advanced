// The message shapes exchanged between the LinkedIn content script and the side panel, via
// chrome.runtime messaging. Kept as one shared file so both sides can never drift apart.
import type { LinkedInProfile } from "../models/profile";

export interface RequestProfileMessage {
  type: "FINDER_REQUEST_PROFILE";
}

export interface ProfileUpdatedMessage {
  type: "FINDER_PROFILE_UPDATED";
  profile: LinkedInProfile;
}

export type FinderMessage = RequestProfileMessage | ProfileUpdatedMessage;

export function isProfileUpdatedMessage(message: unknown): message is ProfileUpdatedMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "FINDER_PROFILE_UPDATED"
  );
}
