// LinkedIn profile content script — the only place that turns "the page changed" into
// collection updates. Reads only what LinkedIn has already rendered; never fetches another
// page, never clicks anything, never scrolls or navigates on the user's behalf. Initializes on
// any supported profile page and accumulates evidence as the user scrolls normally.
import { createCollectionEngine } from "./collectionEngine";
import { extractLinkedInProfile, profileIdentityKey } from "./profileAdapter";
import type { FinderMessage, ProfileResetMessage, ProfileUpdatedMessage } from "../messaging/protocol";

/** How close to the bottom of the page counts as "reached the end," in pixels — tolerates
 * LinkedIn's footer/recommendation chrome without requiring a scroll to the literal last pixel. */
const DOCUMENT_END_MARGIN_PX = 600;
/** LinkedIn's own DOM mutates frequently on its own (ads, badges, carousels); a short debounce
 * here made extraction run on nearly every mutation and visibly degraded page responsiveness
 * during testing, so this is deliberately wide. */
const MUTATION_DEBOUNCE_MS = 900;
const TICK_INTERVAL_MS = 2500;
/** Once settled, back off the safety-net tick — further changes are rare and a real navigation
 * is still caught faster by the mutation/scroll listeners below. */
const SETTLED_TICK_INTERVAL_MS = 6000;

function isNearDocumentEnd(): boolean {
  const scrollBottom = window.scrollY + window.innerHeight;
  return scrollBottom >= document.documentElement.scrollHeight - DOCUMENT_END_MARGIN_PX;
}

let contextInvalidated = false;

/** Reloading the extension orphans any content script already injected in an open tab —
 * `chrome.runtime` becomes undefined and `chrome.runtime.sendMessage(...)` throws synchronously,
 * before a `.catch()` can attach. Nothing useful to do at that point but stop trying. */
function broadcast(message: FinderMessage): void {
  if (contextInvalidated) return;
  try {
    // eslint-disable-next-line no-console
    console.log("[Finder DEBUG] broadcasting", message.type);
    chrome.runtime.sendMessage(message).catch(() => {
      // The side panel may not be open right now — this is a best-effort proactive push; the
      // panel also actively requests a fresh read on its own mount/tab-switch.
    });
  } catch {
    contextInvalidated = true;
  }
}

const engine = createCollectionEngine({
  now: () => Date.now(),
  extractProfile: () => extractLinkedInProfile(document),
  getProfileKey: () => profileIdentityKey(location.href),
  isNearDocumentEnd,
  onUpdate: (profileKey, profile, collection) => {
    const message: ProfileUpdatedMessage = { type: "FINDER_PROFILE_UPDATED", profileKey, profile, collection };
    broadcast(message);
  },
  onReset: (profileKey) => {
    const message: ProfileResetMessage = { type: "FINDER_PROFILE_RESET", profileKey };
    broadcast(message);
  },
});

function watchForChanges(): void {
  let debounceHandle: ReturnType<typeof setTimeout> | null = null;
  const scheduleTick = () => {
    if (debounceHandle) clearTimeout(debounceHandle);
    debounceHandle = setTimeout(() => engine.tick(), MUTATION_DEBOUNCE_MS);
  };

  // Debounced: covers both new content loading in as the user scrolls and LinkedIn's own
  // client-side navigation to a different profile.
  new MutationObserver(scheduleTick).observe(document.body, { childList: true, subtree: true });

  // Scroll position matters for "has the user reached the end" independent of DOM mutations.
  window.addEventListener("scroll", scheduleTick, { passive: true });

  // Periodic safety net: catches the settle transition, which depends on elapsed quiet time
  // rather than any mutation or scroll event firing on its own.
  let intervalHandle = setInterval(runIntervalTick, TICK_INTERVAL_MS);
  function runIntervalTick(): void {
    const wasSettled = engine.getCollectionState().status === "settled";
    // eslint-disable-next-line no-console
    console.log("[Finder DEBUG] interval tick", new Date().toLocaleTimeString());
    engine.tick();
    const isSettled = engine.getCollectionState().status === "settled";
    if (isSettled !== wasSettled) {
      clearInterval(intervalHandle);
      intervalHandle = setInterval(runIntervalTick, isSettled ? SETTLED_TICK_INTERVAL_MS : TICK_INTERVAL_MS);
    }
  }
}

chrome.runtime.onMessage.addListener((message: FinderMessage, _sender, sendResponse) => {
  if (message.type === "FINDER_REQUEST_PROFILE") {
    const collection = engine.getCollectionState();
    // eslint-disable-next-line no-console
    console.log("[Finder DEBUG] responding to FINDER_REQUEST_PROFILE", {
      sectionsFound: collection.sectionsFound,
      status: collection.status,
    });
    sendResponse({
      profileKey: engine.getProfileKey(),
      profile: extractLinkedInProfile(document),
      collection,
    });
  }
  return false;
});

// eslint-disable-next-line no-console
console.log("[Finder DEBUG] content script injected", location.href);
engine.tick();
watchForChanges();
