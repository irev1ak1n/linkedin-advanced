import { useEffect, useRef, useState } from "react";
import type { LinkedInProfile } from "../../models/profile";
import type { ProfileUpdatedMessage, RequestProfileMessage } from "../../messaging/protocol";
import { isProfileUpdatedMessage } from "../../messaging/protocol";

export type ActiveProfileStatus = "loading" | "unsupported" | "ready";

export interface ActiveProfileState {
  status: ActiveProfileStatus;
  profile: LinkedInProfile | null;
}

const PROFILE_URL_PATTERN = /^https:\/\/[^/]*\.linkedin\.com\/in\//;

/** Tracks the profile on whichever tab is currently active in the current window — re-reads
 * on tab switch/navigation and live-updates from the content script's own proactive pushes,
 * without ever requiring the side panel itself to be closed/reopened. */
export function useActiveProfile(): ActiveProfileState {
  const [state, setState] = useState<ActiveProfileState>({ status: "loading", profile: null });
  const activeTabIdRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh(): Promise<void> {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (cancelled) return;

      if (!tab?.id || !tab.url || !PROFILE_URL_PATTERN.test(tab.url)) {
        activeTabIdRef.current = null;
        setState({ status: "unsupported", profile: null });
        return;
      }

      activeTabIdRef.current = tab.id;
      setState((prev) => ({ status: prev.status === "ready" ? "ready" : "loading", profile: prev.profile }));

      try {
        const request: RequestProfileMessage = { type: "FINDER_REQUEST_PROFILE" };
        const response = (await chrome.tabs.sendMessage(tab.id, request)) as
          | { profile: LinkedInProfile }
          | undefined;
        if (cancelled || activeTabIdRef.current !== tab.id) return;
        setState({ status: "ready", profile: response?.profile ?? null });
      } catch {
        // Content script not yet injected (page still loading) — the tab-update listener
        // below will trigger another attempt once it reports "complete".
        if (!cancelled) setState({ status: "loading", profile: null });
      }
    }

    function handleRuntimeMessage(
      message: unknown,
      sender: chrome.runtime.MessageSender,
    ): void {
      if (!isProfileUpdatedMessage(message)) return;
      if (sender.tab?.id !== activeTabIdRef.current) return;
      setState({ status: "ready", profile: (message as ProfileUpdatedMessage).profile });
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

    return () => {
      cancelled = true;
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      chrome.tabs.onActivated.removeListener(handleTabActivated);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
    };
  }, []);

  return state;
}
