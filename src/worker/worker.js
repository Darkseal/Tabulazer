const tabulazer = {
  menuItemId: "tabulazer-activate",
};

// Keep per-tab active state so the popup can show on/off toggles.
// Key: tabId -> Set<tableId>
const activeByTab = new Map();

function setActive(tabId, tableId, active) {
  if (!tabId || !tableId) return;
  let set = activeByTab.get(tabId);
  if (!set) {
    set = new Set();
    activeByTab.set(tabId, set);
  }
  if (active) set.add(tableId);
  else set.delete(tableId);
}

function callToggle(tab, tableId) {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [tableId],
    func: (tableIdArg) => {
      if (tableIdArg && typeof window.tabulazerActivateById === "function") {
        window.tabulazerActivateById(tableIdArg);
        return;
      }

      // Fallback: if we couldn't resolve a tableId (some pages stop the contextmenu event
      // after Tabulator renders), try toggling off the last activated table.
      if (typeof window.tabulazerToggleLast === "function") {
        const ok = window.tabulazerToggleLast();
        if (!ok) {
          console.warn("Tabulazer: no tableId and nothing to toggle");
        }
        return;
      }

      console.warn("Tabulazer: common.js not loaded (missing API)");
    },
  });
}

async function renderTable(tab, tableId) {
  await injectScripts(tab);
  callToggle(tab, tableId);
}

function callDeactivateById(tab, tableId) {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [tableId],
    func: (tableIdArg) => {
      if (!tableIdArg) return;
      if (typeof window.tabulazerDeactivateById === "function") {
        window.tabulazerDeactivateById(tableIdArg);
      } else {
        console.warn("Tabulazer: common.js not loaded (missing tabulazerDeactivateById)");
      }
    },
  });
}

function injectScripts(tab) {
  return new Promise((resolve) => {
    const extVersion = chrome.runtime.getManifest().version;

    chrome.tabs.sendMessage(tab.id, { type: "getInjected" }, (e2) => {
      const injected = e2 && e2.value ? e2.value.injected : false;
      const injectedVersion = e2 && e2.value ? e2.value.version : null;

      if (injected && injectedVersion === extVersion) {
        resolve();
        return;
      }

      Promise.all([
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            "lib/jquery/3.4.1/jquery.min.js",
            "lib/tabulator/6.3.0/js/tabulator.min.js",
            "src/common/common.js",
          ],
        }),
        chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: [
            "lib/tabulator/6.3.0/css/tabulator_simple.min.css",
            "src/common/common.css",
          ],
        }),
      ])
        .then(() => {
          chrome.tabs.sendMessage(tab.id, { type: "setInjected", version: extVersion });
          resolve();
        })
        .catch((err) => {
          console.error("Tabulazer: injectScripts failed", err);
          resolve();
        });
    });
  });
}

// Important: create context menus in onInstalled (recommended & most reliable in MV3)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create(
    {
      id: tabulazer.menuItemId,
      type: "normal",
      title: "Tabulazer - Table Filter and Sorter",
      contexts: ["page"],
    },
    () => {
      // Ignore duplicate id errors on reloads.
      const err = chrome.runtime.lastError;
      if (err && !/duplicate/i.test(err.message || "")) {
        console.warn("Tabulazer: contextMenus.create", err.message);
      }
    }
  );
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== tabulazer.menuItemId) return;

  chrome.tabs.sendMessage(tab.id, { type: "getLastTableTarget" }, (resp) => {
    const tableId = resp && resp.value ? resp.value.tableId : null;
    // tableId may be null (e.g., right-click outside a table). In that case, we still
    // try a "toggle last" fallback inside the page.
    renderTable(tab, tableId);
  });
});

function getActiveTab(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    callback(tab || null);
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const kind = request && request.type;

  if (kind === "popupListTables") {
    getActiveTab((tab) => {
      if (!tab || !tab.id) {
        sendResponse({ ok: false, error: "No active tab" });
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: "listTables" }, (resp) => {
        const tables = (resp && resp.tables) ? resp.tables : [];
        const activeSet = activeByTab.get(tab.id) || new Set();
        const withState = tables.map((t) => ({ ...t, active: activeSet.has(t.id) }));
        sendResponse({ ok: true, tables: withState });
      });
    });
    return true;
  }

  if (kind === "popupStartPicker") {
    getActiveTab((tab) => {
      if (!tab || !tab.id) {
        sendResponse({ ok: false, error: "No active tab" });
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: "startPicker" }, () => {
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  if (kind === "popupToggleLast") {
    getActiveTab(async (tab) => {
      if (!tab || !tab.id) {
        sendResponse({ ok: false, error: "No active tab" });
        return;
      }
      await renderTable(tab, null);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (kind === "activateById") {
    const tableId = request && request.tableId;
    getActiveTab(async (tab) => {
      if (!tab || !tab.id) {
        sendResponse({ ok: false, error: "No active tab" });
        return;
      }
      await renderTable(tab, tableId);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (kind === "deactivateById") {
    const tableId = request && request.tableId;
    getActiveTab(async (tab) => {
      if (!tab || !tab.id) {
        sendResponse({ ok: false, error: "No active tab" });
        return;
      }
      await injectScripts(tab);
      callDeactivateById(tab, tableId);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (kind === "pickerSelected") {
    // Content script notifies us of chosen table.
    const tableId = request && request.tableId;
    const tabId = sender && sender.tab ? sender.tab.id : null;
    if (!tabId || !tableId) return;

    const tab = { id: tabId };
    renderTable(tab, tableId);
    return;
  }

  if (kind === "tabulazerStatus") {
    const tabId = sender && sender.tab ? sender.tab.id : null;
    const tableId = request && request.tableId;
    const active = !!(request && request.active);
    setActive(tabId, tableId, active);
  }
});
