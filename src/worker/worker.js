const tabulazer = {
  menuItemId: "tabulazer-activate",
};

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
    if (!tableId) {
      console.warn("Tabulazer: no table target captured (right-click was not on a table?)");
      return;
    }
    renderTable(tab, tableId);
  });
});
