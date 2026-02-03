// Tabulazer content script
// Responsibilities:
// - Track the last right-clicked table (if any)
// - Provide injection bookkeeping (simple) for the service worker

var tabulazer = {
  lastTableId: null,
  isInjected: false,
  injectedVersion: null,
};

function ensureTableId(tableEl) {
  if (!tableEl) return null;
  var attr = "data-tabulazer-table-id";
  var id = tableEl.getAttribute(attr);
  if (!id) {
    id = "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    tableEl.setAttribute(attr, id);
  }
  return id;
}

document.addEventListener(
  "contextmenu",
  function (event) {
    try {
      var table = event.target && event.target.closest ? event.target.closest("table") : null;
      tabulazer.lastTableId = ensureTableId(table);
    } catch (e) {
      tabulazer.lastTableId = null;
    }
  },
  true
);

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  // Backward compatible with old string-based messages.
  var kind = (typeof request === "string") ? request : (request && request.type);
  switch (kind) {
    case "getLastTableTarget":
      sendResponse({ value: { tableId: tabulazer.lastTableId } });
      break;
    case "getInjected":
      sendResponse({ value: { injected: tabulazer.isInjected, version: tabulazer.injectedVersion } });
      break;
    case "setInjected":
      tabulazer.isInjected = true;
      tabulazer.injectedVersion = (request && request.version) ? request.version : tabulazer.injectedVersion;
      break;
  }
});
