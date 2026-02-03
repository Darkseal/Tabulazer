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
      var target = event.target;
      if (!target || !target.closest) {
        tabulazer.lastTableId = null;
        return;
      }

      // If the table has been replaced by Tabulazer, right-clicks happen inside the Tabulator UI.
      // In that case, resolve the tableId from the host container.
      var host = target.closest("[data-tabulazer-host-id]");
      if (host) {
        tabulazer.lastTableId = host.getAttribute("data-tabulazer-host-id") || null;
        return;
      }

      // Otherwise resolve the nearest real table.
      var table = target.closest("table");
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
