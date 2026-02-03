const tabulazer = {
  rootMenuId: "tabulazer-root",

  toggleMenuId: "tabulazer-toggle",
  pickMenuId: "tabulazer-pick",
  openPanelMenuId: "tabulazer-open-panel",

  copyRootMenuId: "tabulazer-copy-root",
  downloadRootMenuId: "tabulazer-download-root",

  copyCsvMenuId: "tabulazer-copy-csv",
  copyXlsxMenuId: "tabulazer-copy-xlsx",
  copyXmlMenuId: "tabulazer-copy-xml",

  downloadCsvMenuId: "tabulazer-download-csv",
  downloadXlsxMenuId: "tabulazer-download-xlsx",
  downloadXmlMenuId: "tabulazer-download-xml",
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

  // Best-effort: keep last target in the content script so other actions (copy/export)
  // can fall back when a table isn't right-clicked.
  if (tableId) {
    chrome.tabs.sendMessage(tab.id, { type: "setLastTableTarget", tableId }, () => {});
  }
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
  // Prefer opening the side panel when the user clicks the action button.
  try {
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  } catch (e) {}

  // Rebuild context menus (avoids duplicates across reloads/updates).
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create(
      {
        id: tabulazer.rootMenuId,
        type: "normal",
        title: "Tabulazer",
        contexts: ["page"],
      },
      () => {
        const err = chrome.runtime.lastError;
        if (err && !/duplicate/i.test(err.message || "")) {
          console.warn("Tabulazer: contextMenus.create(root)", err.message);
        }

        // Children
        [
          { id: tabulazer.toggleMenuId, title: "Toggle Table" },
          { id: tabulazer.pickMenuId, title: "Pick Table" },
          { id: tabulazer.openPanelMenuId, title: "Open Side Panel" },

          { id: tabulazer.copyRootMenuId, title: "Copy Table to Clipboard" },
          { id: tabulazer.downloadRootMenuId, title: "Download Table as" },
        ].forEach((item) => {
          chrome.contextMenus.create(
            {
              id: item.id,
              parentId: tabulazer.rootMenuId,
              type: "normal",
              title: item.title,
              contexts: ["page"],
            },
            () => {
              const e2 = chrome.runtime.lastError;
              if (e2 && !/duplicate/i.test(e2.message || "")) {
                console.warn("Tabulazer: contextMenus.create(child)", item.id, e2.message);
              }
            }
          );
        });

        // Copy submenu
        [
          { id: tabulazer.copyCsvMenuId, title: "CSV" },
          { id: tabulazer.copyXlsxMenuId, title: "XLSX" },
          { id: tabulazer.copyXmlMenuId, title: "XML" },
        ].forEach((item) => {
          chrome.contextMenus.create(
            {
              id: item.id,
              parentId: tabulazer.copyRootMenuId,
              type: "normal",
              title: item.title,
              contexts: ["page"],
            },
            () => {
              const e2 = chrome.runtime.lastError;
              if (e2 && !/duplicate/i.test(e2.message || "")) {
                console.warn("Tabulazer: contextMenus.create(copy)", item.id, e2.message);
              }
            }
          );
        });

        // Download submenu
        [
          { id: tabulazer.downloadCsvMenuId, title: "CSV" },
          { id: tabulazer.downloadXlsxMenuId, title: "XLSX" },
          { id: tabulazer.downloadXmlMenuId, title: "XML" },
        ].forEach((item) => {
          chrome.contextMenus.create(
            {
              id: item.id,
              parentId: tabulazer.downloadRootMenuId,
              type: "normal",
              title: item.title,
              contexts: ["page"],
            },
            () => {
              const e2 = chrome.runtime.lastError;
              if (e2 && !/duplicate/i.test(e2.message || "")) {
                console.warn("Tabulazer: contextMenus.create(download)", item.id, e2.message);
              }
            }
          );
        });
      }
    );
  });
});

async function openSidePanelForTab(tabId) {
  try {
    if (tabId && chrome.sidePanel && chrome.sidePanel.open) {
      await chrome.sidePanel.open({ tabId });
    }
  } catch (e) {
    // ignore
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  await openSidePanelForTab(tab.id);
});

async function resolveTargetTableId(tab) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, { type: "getLastTableTarget" }, (resp) => {
      const tableId = resp && resp.value ? resp.value.tableId : null;
      resolve(tableId || null);
    });
  });
}

function showNoTableSelected(tab) {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      alert("Tabulazer: No table selected");
    },
  });
}

async function ensureSheetJs(tab) {
  // Inject SheetJS only when needed (XLSX actions).
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["lib/sheetjs/0.18.5/xlsx.full.min.js"],
    });
  } catch (e) {
    // ignore; execution below will surface missing XLSX.
  }
}

async function exportFromPage(tab, tableId, format, mode) {
  // format: csv|xml|xlsx
  // mode: copy|download
  await injectScripts(tab);

  if (format === "xlsx") {
    await ensureSheetJs(tab);
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [tableId, format, mode],
    func: async (tableIdArg, formatArg, modeArg) => {
      function escapeCsv(v) {
        const s = (v == null) ? "" : String(v);
        if (/[\n\r,\"]/g.test(s)) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      }

      function tableElFromId(id) {
        if (!id) return null;
        // Prefer host/table in the live DOM
        let el = document.querySelector('[data-tabulazer-host-id="' + id + '"]') ||
          document.querySelector('table[data-tabulazer-table-id="' + id + '"]');
        if (el) return el;

        // If active, the original <table> is stored in common.js registry.
        try {
          if (typeof window.tabulazerGetOriginalHtmlById === "function") {
            const html = window.tabulazerGetOriginalHtmlById(id);
            if (html) {
              const doc = document.implementation.createHTMLDocument("tabulazer-export");
              doc.body.innerHTML = html;
              return doc.querySelector("table");
            }
          }
        } catch (e) {}

        return null;
      }

      function extractGrid(tableEl) {
        const rows = Array.from(tableEl.querySelectorAll("tr"));
        return rows.map((tr) => Array.from(tr.querySelectorAll("th,td")).map((c) => (c.innerText || c.textContent || "").trim()));
      }

      function toXml(grid) {
        const esc = (s) => String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&apos;");

        let out = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<table>\n";
        grid.forEach((row) => {
          out += "  <row>\n";
          row.forEach((cell) => {
            out += "    <cell>" + esc(cell) + "</cell>\n";
          });
          out += "  </row>\n";
        });
        out += "</table>\n";
        return out;
      }

      function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.style.display = "none";
        document.documentElement.appendChild(a);
        a.click();
        setTimeout(() => {
          try { URL.revokeObjectURL(url); } catch (e) {}
          try { a.remove(); } catch (e) {}
        }, 1500);
      }

      async function copyBlob(blob, mime) {
        if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
          throw new Error("Clipboard API not available");
        }
        const item = new ClipboardItem({ [mime]: blob });
        await navigator.clipboard.write([item]);
      }

      const tableEl = tableElFromId(tableIdArg);
      if (!tableEl) {
        alert("Tabulazer: No table selected");
        return;
      }

      const ts = new Date().toISOString().replace(/[:.]/g, "-");

      if (formatArg === "csv") {
        const grid = extractGrid(tableEl);
        const csv = grid.map((row) => row.map(escapeCsv).join(",")).join("\n") + "\n";
        if (modeArg === "copy") {
          await navigator.clipboard.writeText(csv);
        } else {
          downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `tabulazer-${ts}.csv`);
        }
        return;
      }

      if (formatArg === "xml") {
        const grid = extractGrid(tableEl);
        const xml = toXml(grid);
        if (modeArg === "copy") {
          await navigator.clipboard.writeText(xml);
        } else {
          downloadBlob(new Blob([xml], { type: "application/xml;charset=utf-8" }), `tabulazer-${ts}.xml`);
        }
        return;
      }

      if (formatArg === "xlsx") {
        // SheetJS global
        if (typeof XLSX === "undefined" || !XLSX.utils || !XLSX.write) {
          alert("Tabulazer: XLSX export is not available (SheetJS missing)");
          return;
        }

        const wb = XLSX.utils.table_to_book(tableEl, { sheet: "Table" });
        const arr = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([arr], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        if (modeArg === "copy") {
          try {
            await copyBlob(blob, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          } catch (e) {
            // Clipboard for binary types is still flaky in some Chromium builds.
            // Fall back to download.
            downloadBlob(blob, `tabulazer-${ts}.xlsx`);
          }
        } else {
          downloadBlob(blob, `tabulazer-${ts}.xlsx`);
        }
        return;
      }
    },
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;

  if (info.menuItemId === tabulazer.openPanelMenuId) {
    openSidePanelForTab(tab.id);
    return;
  }

  if (info.menuItemId === tabulazer.pickMenuId) {
    // Start overlay picker and open the side panel for quick access to controls.
    openSidePanelForTab(tab.id);
    chrome.tabs.sendMessage(tab.id, { type: "startPicker" }, () => {
      const err = chrome.runtime.lastError;
      if (err) console.warn("Tabulazer: startPicker failed", err.message);
    });
    return;
  }

  if (info.menuItemId === tabulazer.toggleMenuId) {
    openSidePanelForTab(tab.id);
    const tableId = await resolveTargetTableId(tab);
    renderTable(tab, tableId);
    return;
  }

  const copyMap = {
    [tabulazer.copyCsvMenuId]: { format: "csv", mode: "copy" },
    [tabulazer.copyXlsxMenuId]: { format: "xlsx", mode: "copy" },
    [tabulazer.copyXmlMenuId]: { format: "xml", mode: "copy" },
    [tabulazer.downloadCsvMenuId]: { format: "csv", mode: "download" },
    [tabulazer.downloadXlsxMenuId]: { format: "xlsx", mode: "download" },
    [tabulazer.downloadXmlMenuId]: { format: "xml", mode: "download" },
  };

  const action = copyMap[info.menuItemId];
  if (!action) return;

  const tableId = await resolveTargetTableId(tab);
  if (!tableId) {
    showNoTableSelected(tab);
    return;
  }

  await exportFromPage(tab, tableId, action.format, action.mode);
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
        // State comes from the page DOM (hosts == active).
        const withState = tables.map((t) => ({ ...t, active: !!t.active }));
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
      openSidePanelForTab(tab.id);
      chrome.tabs.sendMessage(tab.id, { type: "startPicker" }, () => {
        const err = chrome.runtime.lastError;
        if (err) {
          sendResponse({ ok: false, error: err.message || "Unable to start picker" });
        } else {
          sendResponse({ ok: true });
        }
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
      openSidePanelForTab(tab.id);
      await renderTable(tab, null);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (kind === "popupSelectById") {
    const tableId = request && request.tableId;
    getActiveTab((tab) => {
      if (!tab || !tab.id) {
        sendResponse({ ok: false, error: "No active tab" });
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: "selectTable", tableId: tableId }, (resp) => {
        const err = chrome.runtime.lastError;
        if (err) {
          sendResponse({ ok: false, error: err.message || "Unable to select table" });
          return;
        }
        if (resp && resp.ok) {
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, error: "Table not found on this page." });
        }
      });
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

  if (kind === "activateAll") {
    getActiveTab(async (tab) => {
      if (!tab || !tab.id) {
        sendResponse({ ok: false, error: "No active tab" });
        return;
      }

      // List tables/hosts from the page and activate all inactive real tables.
      chrome.tabs.sendMessage(tab.id, { type: "listTables" }, async (resp) => {
        const tables = (resp && resp.tables) ? resp.tables : [];
        const inactive = tables.filter((t) => t && !t.active);

        await injectScripts(tab);

        inactive.forEach((t) => {
          callToggle(tab, t.id); // activate (activateById toggles off if active; these are inactive)
        });

        sendResponse({ ok: true, count: inactive.length });
      });
    });
    return true;
  }

  if (kind === "deactivateAll") {
    getActiveTab(async (tab) => {
      if (!tab || !tab.id) {
        sendResponse({ ok: false, error: "No active tab" });
        return;
      }

      // List tables/hosts from the page and deactivate all active hosts.
      chrome.tabs.sendMessage(tab.id, { type: "listTables" }, async (resp) => {
        const tables = (resp && resp.tables) ? resp.tables : [];
        const active = tables.filter((t) => t && t.active);

        await injectScripts(tab);

        active.forEach((t) => {
          callDeactivateById(tab, t.id);
        });

        sendResponse({ ok: true, count: active.length });
      });
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

});
