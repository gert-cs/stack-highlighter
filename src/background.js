/**
 * Background service worker.
 *
 * Handles first-run orientation and side-panel plumbing.
 */
chrome.runtime.onInstalled.addListener((details) => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  if (shouldOpenWelcomePage(details)) {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") }).catch(() => {});
  }
});

function shouldOpenWelcomePage(details) {
  if (details.reason === "install") return true;
  if (details.reason !== "update") return false;

  const current = parseVersion(chrome.runtime.getManifest().version);
  const previous = parseVersion(details.previousVersion);
  if (!current || !previous) return false;

  return current.major === 0 && current.patch === 0 && current.minor !== previous.minor;
}

function parseVersion(version) {
  const match = String(version || "").match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.windowId) return;
  await chrome.sidePanel.open({ windowId: tab.windowId });
});
