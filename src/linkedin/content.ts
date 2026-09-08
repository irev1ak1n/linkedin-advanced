// LinkedIn profile content script — reads the currently-rendered page via profileAdapter and
// reports it to the side panel. Never fetches another page, never clicks anything, never
// performs hidden navigation; purely reactive to whatever LinkedIn has already rendered.
import { extractLinkedInProfile } from "./profileAdapter";
import type { FinderMessage, ProfileUpdatedMessage } from "../messaging/protocol";
import type { LinkedInProfile } from "../models/profile";

const RECHECK_INTERVAL_MS = 800;

let lastSent: string | null = null;
let lastUrl = location.href;

function sendIfChanged(profile: LinkedInProfile): void {
  const serialized = JSON.stringify(profile);
  if (serialized === lastSent) return;
  lastSent = serialized;
  const message: ProfileUpdatedMessage = { type: "FINDER_PROFILE_UPDATED", profile };
  chrome.runtime.sendMessage(message).catch(() => {
    // The side panel may not be open — that's fine, this is a best-effort push. The panel
    // also actively requests a fresh read on its own mount (see the message listener below).
  });
}

function reconcile(): void {
  sendIfChanged(extractLinkedInProfile(document));
}

// LinkedIn is a client-side-routed SPA: navigating between two profiles never triggers a real
// page load, so a MutationObserver alone can fire constantly during any DOM churn while never
// reliably signaling "this is now a different profile." Polling the URL alongside it is the
// simple, deterministic way to notice a real profile change without depending on LinkedIn's
// own (unstable, undocumented) router internals.
function watchForChanges(): void {
  let debounceHandle: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (debounceHandle) clearTimeout(debounceHandle);
    debounceHandle = setTimeout(reconcile, 400);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastSent = null; // force a fresh push even if the new profile briefly reads identically
      reconcile();
    }
  }, RECHECK_INTERVAL_MS);
}

chrome.runtime.onMessage.addListener((message: FinderMessage, _sender, sendResponse) => {
  if (message.type === "FINDER_REQUEST_PROFILE") {
    sendResponse({ profile: extractLinkedInProfile(document) });
  }
  return false;
});

reconcile();
watchForChanges();
