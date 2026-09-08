import { useCallback, useEffect, useRef, useState } from "react";
import type { LinkedInProfile } from "../../models/profile";
import type { CollectionState } from "../../models/collection";
import type { ProfileResetMessage, ProfileUpdatedMessage, RequestProfileMessage } from "../../messaging/protocol";
import { isProfileResetMessage, isProfileUpdatedMessage } from "../../messaging/protocol";
import { profileIdentityKey } from "../../linkedin/profileAdapter";

export type ActiveProfileStatus = "loading" | "unsupported" | "ready";

export interface ActiveProfileState {
  status: ActiveProfileStatus;
  profileKey: string | null;
  profile: LinkedInProfile | null;
  collection: CollectionState | null;
  /** True once the user has explicitly asked to score whatever is currently collected for
   * THIS profile, via `forceAnalyze()` — lets the UI present a final (not provisional) score
   * even while `collection.status` is still "collecting", for a sparse/short profile that may
   * never naturally reach a settled state (see the mission's "Analyze available information"
   * requirement). Resets automatically when the profile identity changes. */
  forcedAnalysis: boolean;
  forceAnalyze: () => void;
  /** Diagnostic only (temporary): timestamp of the last successful read from the content
   * script, via either channel — proves the update pipeline is alive independent of whether
   * the extracted content itself happened to change. Remove once live-scroll updates are
   * confirmed working end-to-end. */
  lastRefreshedAt: number | null;
  /** Diagnostic only (temporary): how many times the poll interval has fired this session. */
  pollAttempts: number;
}

const PROFILE_URL_PATTERN = /^https:\/\/[^/]*\.linkedin\.com\/in\//;
/** The content script's proactive push isn't fully trusted to always reach this hook during
 * ordinary scrolling, so this hook also actively polls the content script via the same
 * request/response channel used on tab switch/reload, while collection hasn't settled yet.
 * Stops once settled, since nothing further is expected to change. */
const POLL_INTERVAL_MS = 2000;

interface CachedSnapshot {
  profile: LinkedInProfile;
  collection: CollectionState;
}

/**
 * Tracks the profile on whichever tab is currently active in the current window — re-reads on
 * tab switch/navigation and live-updates from the content script, without requiring the side
 * panel or the LinkedIn tab to be reloaded.
 *
 * Keeps a small session cache (`Map<profileKey, snapshot>`) so switching back to an
 * already-visited profile shows its last-known evidence immediately, while a fresh request
 * reconciles in the background. A `FINDER_PROFILE_RESET` message (the content script's signal
 * that the user navigated to a different profile) clears the displayed profile immediately, so
 * two people's evidence are never shown mixed together.
 */
export function useActiveProfile(): ActiveProfileState {
  const [status, setStatus] = useState<ActiveProfileStatus>("loading");
  const [profileKey, setProfileKey] = useState<string | null>(null);
  const [profile, setProfile] = useState<LinkedInProfile | null>(null);
  const [collection, setCollection] = useState<CollectionState | null>(null);
  const [forcedKeys, setForcedKeys] = useState<Set<string>>(new Set());
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [pollAttempts, setPollAttempts] = useState(0);

  const activeTabIdRef = useRef<number | null>(null);
  const activeKeyRef = useRef<string | null>(null);
  const cacheRef = useRef<Map<string, CachedSnapshot>>(new Map());
  const settledRef = useRef(false);

  const applySnapshot = useCallback((key: string, snap: CachedSnapshot) => {
    cacheRef.current.set(key, snap);
    if (activeKeyRef.current !== key) return; // a stale response for a profile we've since left
    settledRef.current = snap.collection.status === "settled";
    setProfileKey(key);
    setProfile(snap.profile);
    setCollection(snap.collection);
    setStatus("ready");
  }, []);

  useEffect(() => {
    let cancelled = false;

    /** The proven-reliable path: ask the content script directly and apply what it returns.
     * Reused by the initial load, tab switches/updates, AND the polling fallback below. */
    async function requestFromContentScript(tabId: number): Promise<void> {
      try {
        const request: RequestProfileMessage = { type: "FINDER_REQUEST_PROFILE" };
        const response = (await chrome.tabs.sendMessage(tabId, request)) as
          | { profileKey: string | null; profile: LinkedInProfile; collection: CollectionState }
          | undefined;
        if (cancelled || activeTabIdRef.current !== tabId) return;
        if (response?.profileKey) {
          setLastRefreshedAt(Date.now());
          applySnapshot(response.profileKey, { profile: response.profile, collection: response.collection });
        }
      } catch {
        // Content script not yet injected (page still loading, or navigated away) — the
        // tab-update listener will trigger another attempt once it reports "complete".
      }
    }

    async function refresh(): Promise<void> {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (cancelled) return;

      if (!tab?.id || !tab.url || !PROFILE_URL_PATTERN.test(tab.url)) {
        activeTabIdRef.current = null;
        activeKeyRef.current = null;
        setStatus("unsupported");
        setProfileKey(null);
        setProfile(null);
        setCollection(null);
        return;
      }

      activeTabIdRef.current = tab.id;
      const urlKey = profileIdentityKey(tab.url);
      activeKeyRef.current = urlKey;

      // Show cached evidence for this exact profile immediately, if we have it, while the
      // live request below reconciles in the background — never shown for a DIFFERENT key.
      const cached = urlKey ? cacheRef.current.get(urlKey) : undefined;
      if (cached) {
        setProfileKey(urlKey);
        setProfile(cached.profile);
        setCollection(cached.collection);
        setStatus("ready");
      } else {
        setStatus((prev) => (prev === "ready" ? "loading" : prev));
      }

      await requestFromContentScript(tab.id);
    }

    function handleRuntimeMessage(message: unknown, sender: chrome.runtime.MessageSender): void {
      if (sender.tab?.id !== activeTabIdRef.current) return; // not the tab we're currently showing

      if (isProfileResetMessage(message)) {
        const reset = message as ProfileResetMessage;
        activeKeyRef.current = reset.profileKey;
        cacheRef.current.delete(reset.profileKey);
        setProfileKey(reset.profileKey);
        setProfile(null);
        setCollection(null);
        setStatus("ready");
        return;
      }

      if (isProfileUpdatedMessage(message)) {
        const update = message as ProfileUpdatedMessage;
        setLastRefreshedAt(Date.now());
        applySnapshot(update.profileKey, { profile: update.profile, collection: update.collection });
      }
    }

    function handleTabActivated(): void {
      void refresh();
    }

    function handleTabUpdated(tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo): void {
      if (tabId === activeTabIdRef.current && changeInfo.status === "complete") void refresh();
    }

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    chrome.tabs.onActivated.addListener(handleTabActivated);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);
    void refresh();

    const pollHandle = setInterval(() => {
      setPollAttempts((n) => n + 1); // diagnostic: proves this interval is actually firing
      if (settledRef.current) return; // nothing further expected to change — stop polling
      if (activeTabIdRef.current === null) return; // not currently on a supported profile tab
      void requestFromContentScript(activeTabIdRef.current);
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollHandle);
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      chrome.tabs.onActivated.removeListener(handleTabActivated);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
    };
  }, [applySnapshot]);

  const forceAnalyze = useCallback(() => {
    if (!profileKey) return;
    setForcedKeys((prev) => new Set(prev).add(profileKey));
  }, [profileKey]);

  return {
    status,
    profileKey,
    profile,
    collection,
    forcedAnalysis: profileKey !== null && forcedKeys.has(profileKey),
    forceAnalyze,
    lastRefreshedAt,
    pollAttempts,
  };
}
