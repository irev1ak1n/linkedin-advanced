// Lifecycle/orchestration only — no product business logic here.
// Makes clicking the Finder toolbar action open the Side Panel instead of doing nothing.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
    console.error("Finder: failed to configure side panel behavior", error);
  });
});
