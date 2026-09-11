// Development-only tooling: lets a test harness (or a developer's own devtools console)
// trigger an extension reload and inspect the content script's current internal state, without
// clicking through chrome://extensions or touching the LinkedIn tab by hand.
//
// Two separate bridges are involved here, for two different reasons:
//   1. window.postMessage, page (MAIN) world <-> this content script (isolated world) — a test
//      driver's injected script runs in the page's own world and cannot reach an isolated-world
//      content script's `chrome.*` bindings at all; postMessage is the standard way across
//      that boundary.
//   2. chrome.runtime.sendMessage, this content script <-> the background service worker —
//      content scripts get only a REDUCED `chrome.runtime` (messaging/lifecycle only).
//      `chrome.runtime.reload()` is not part of that reduced surface and throws
//      "chrome.runtime.reload is not a function" if called from here directly (confirmed live).
//      Only the background service worker has the full runtime API, so the actual reload must
//      happen there — this content script only ever relays the request to it.
//
// Gated behind DEV_TOOLING_ENABLED, which should be flipped to false before this extension is
// ever distributed anywhere real.
const DEV_TOOLING_ENABLED = true;

const RELOAD_REQUEST = "__linkwise_dev_reload__";
const SNAPSHOT_REQUEST = "__linkwise_dev_snapshot_request__";
const SNAPSHOT_RESPONSE = "__linkwise_dev_snapshot_response__";

/** Returns an unsubscribe function — the caller (content.ts) registers it with the same
 * teardown mechanism as everything else, so a re-injected instance doesn't leave a previous
 * instance's listener behind. */
export function installDevTooling(getSnapshot: () => unknown): () => void {
  if (!DEV_TOOLING_ENABLED) return () => {};

  function handleMessage(event: MessageEvent): void {
    if (event.source !== window) return;
    const data = event.data as { type?: unknown } | undefined;
    if (!data || typeof data !== "object") return;

    if (data.type === RELOAD_REQUEST) {
      // Relay only — this content script cannot perform the reload itself.
      chrome.runtime.sendMessage({ type: RELOAD_REQUEST }).catch(() => {
        // Background may be mid-restart already; nothing useful to do about a lost relay.
      });
    }
    if (data.type === SNAPSHOT_REQUEST) {
      window.postMessage({ type: SNAPSHOT_RESPONSE, snapshot: getSnapshot() }, "*");
    }
  }

  window.addEventListener("message", handleMessage);
  return () => window.removeEventListener("message", handleMessage);
}
