import { scanReadyModePage } from "./collector.js";

chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
chrome.action.onClicked.addListener(async (tab) => {
  const scanId = crypto.randomUUID();
  let scan;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scanReadyModePage,
    });
    if (!results[0]?.result)
      throw new Error(results[0]?.error?.message || "No calls found on this page.");
    scan = { ...results[0].result, tab_id: tab.id };
  } catch (error) {
    scan = { calls: [], error: error.message || "Open ReadyMode Call Logs and click BYLDA again." };
  }
  // Call data lasts only for this browser session. Connection token stays in trusted extension storage.
  await chrome.storage.session.set({ [scanId]: scan });
  await chrome.tabs.create({ url: chrome.runtime.getURL(`importer.html?scan=${scanId}`) });
});
