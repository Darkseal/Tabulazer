const tabulazer = {
  rootMenuId: "tabulazer-root",

  toggleMenuId: "tabulazer-toggle",
  pickMenuId: "tabulazer-pick",
  openPanelMenuId: "tabulazer-open-panel",

  copyRootMenuId: "tabulazer-copy-root",
  downloadRootMenuId: "tabulazer-download-root",

  copyCsvCurrentMenuId: "tabulazer-copy-csv-current",
  copyXlsxCurrentMenuId: "tabulazer-copy-xlsx-current",
  copyXmlCurrentMenuId: "tabulazer-copy-xml-current",
  copyCsvAllMenuId: "tabulazer-copy-csv-all",
  copyXlsxAllMenuId: "tabulazer-copy-xlsx-all",
  copyXmlAllMenuId: "tabulazer-copy-xml-all",

  downloadCsvCurrentMenuId: "tabulazer-download-csv-current",
  downloadXlsxCurrentMenuId: "tabulazer-download-xlsx-current",
  downloadXmlCurrentMenuId: "tabulazer-download-xml-current",
  downloadCsvAllMenuId: "tabulazer-download-csv-all",
  downloadXlsxAllMenuId: "tabulazer-download-xlsx-all",
  downloadXmlAllMenuId: "tabulazer-download-xml-all",
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

// Dynamically enable/disable context menu items based on where the user right-clicked.
// - If right-click is inside a table (or active Tabulazer host): enable Toggle Table, disable Pick Table
// - Otherwise: enable Pick Table, disable Toggle Table
try {
  chrome.contextMenus.onShown.addListener((info, tab) => {
    const tabId = (tab && tab.id) || (info && info.tabId);
    if (!tabId) return;

    chrome.tabs.sendMessage(tabId, { type: "getContextInfo" }, (resp) => {
      const err = chrome.runtime.lastError;
      const inTable = (!err && resp) ? !!resp.inTable : false;

      function applyUpdates() {
        chrome.contextMenus.update(tabulazer.toggleMenuId, { enabled: inTable }, () => {
          const e = chrome.runtime.lastError;
          if (e) console.warn("Tabulazer: contextMenus.update(toggle)", e.message);
        });
        chrome.contextMenus.update(tabulazer.pickMenuId, { enabled: !inTable }, () => {
          const e = chrome.runtime.lastError;
          if (e) console.warn("Tabulazer: contextMenus.update(pick)", e.message);
        });

        // Update the already-open menu.
        try { chrome.contextMenus.refresh(); } catch (e) {}
      }

      // If items are missing (service worker restarted before menus were created), rebuild then retry.
      chrome.contextMenus.update(tabulazer.rootMenuId, { title: "Tabulazer" }, () => {
        const e = chrome.runtime.lastError;
        if (e && /cannot find|not found/i.test(e.message || "")) {
          rebuildContextMenus();
          // Give Chrome a tick to recreate, then apply.
          setTimeout(applyUpdates, 50);
          return;
        }
        applyUpdates();
      });
    });
  });
} catch (e) {}

function rebuildContextMenus() {
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
          { id: tabulazer.toggleMenuId, title: "Toggle Table", enabled: false },
          { id: tabulazer.pickMenuId, title: "Pick Table", enabled: true },
          { id: tabulazer.openPanelMenuId, title: "Open Side Panel", enabled: true },

          { id: tabulazer.copyRootMenuId, title: "Copy Table to Clipboard" },
          { id: tabulazer.downloadRootMenuId, title: "Download Table as" },
        ].forEach((item) => {
          chrome.contextMenus.create(
            {
              id: item.id,
              parentId: tabulazer.rootMenuId,
              type: "normal",
              title: item.title,
              enabled: (item.enabled !== undefined) ? item.enabled : true,
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
          { id: tabulazer.copyCsvCurrentMenuId, title: "CSV (current view)" },
          { id: tabulazer.copyXlsxCurrentMenuId, title: "XLSX (current view)" },
          { id: tabulazer.copyXmlCurrentMenuId, title: "XML (current view)" },
          { id: tabulazer.copyCsvAllMenuId, title: "CSV (all rows)" },
          { id: tabulazer.copyXlsxAllMenuId, title: "XLSX (all rows)" },
          { id: tabulazer.copyXmlAllMenuId, title: "XML (all rows)" },
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
          { id: tabulazer.downloadCsvCurrentMenuId, title: "CSV (current view)" },
          { id: tabulazer.downloadXlsxCurrentMenuId, title: "XLSX (current view)" },
          { id: tabulazer.downloadXmlCurrentMenuId, title: "XML (current view)" },
          { id: tabulazer.downloadCsvAllMenuId, title: "CSV (all rows)" },
          { id: tabulazer.downloadXlsxAllMenuId, title: "XLSX (all rows)" },
          { id: tabulazer.downloadXmlAllMenuId, title: "XML (all rows)" },
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
}

// Ensure context menus exist even after service worker restarts.
try {
  chrome.runtime.onStartup.addListener(() => rebuildContextMenus());
} catch (e) {}

// Important: create context menus in onInstalled (recommended & most reliable in MV3)
chrome.runtime.onInstalled.addListener(() => {
  // Prefer opening the side panel when the user clicks the action button.
  try {
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  } catch (e) {}

  // Rebuild context menus (avoids duplicates across reloads/updates).
  rebuildContextMenus();
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

async function exportFromPage(tab, tableId, format, mode, scope) {
  // format: csv|xml|xlsx
  // mode: copy|download
  // scope: current|all
  await injectScripts(tab);

  if (format === "xlsx") {
    await ensureSheetJs(tab);
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [tableId, format, mode, scope],
    func: async (tableIdArg, formatArg, modeArg, scopeArg) => {
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

      function gridFromTabulator(instance, scope) {
        try {
          const cols = (typeof instance.getColumns === "function") ? instance.getColumns() : [];
          const headers = cols
            .map((c) => (c.getDefinition ? c.getDefinition() : null))
            .map((d) => (d && (d.title || d.field)) ? (d.title || d.field) : "")
            .filter((x) => x !== "");

          const fields = cols
            .map((c) => (c.getField ? c.getField() : null))
            .filter((x) => !!x);

          const data = (scope === "current" && typeof instance.getData === "function")
            ? instance.getData("active")
            : (typeof instance.getData === "function" ? instance.getData() : []);

          const grid = [headers.length ? headers : fields];
          (data || []).forEach((row) => {
            const out = [];
            fields.forEach((f) => {
              const v = (row && row[f] != null) ? row[f] : "";
              // Strip HTML for export
              const tmp = document.createElement("div");
              tmp.innerHTML = String(v);
              out.push((tmp.innerText || tmp.textContent || "").trim());
            });
            grid.push(out);
          });

          return grid;
        } catch (e) {
          return null;
        }
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

      const inst = (typeof window.tabulazerGetInstanceById === "function") ? window.tabulazerGetInstanceById(tableIdArg) : null;
      const isActive = !!inst;

      const tableEl = tableElFromId(tableIdArg);
      if (!tableEl && !isActive) {
        alert("Tabulazer: No table selected");
        return;
      }

      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const scopeLabel = (scopeArg === "current") ? "current" : "all";

      // Prefer Tabulator data when active so we can respect current view (filters/sort).
      const grid = (isActive ? gridFromTabulator(inst, scopeArg) : null) || (tableEl ? extractGrid(tableEl) : null);
      if (!grid) {
        alert("Tabulazer: unable to export table");
        return;
      }

      if (formatArg === "csv") {
        const csv = grid.map((row) => row.map(escapeCsv).join(",")).join("\n") + "\n";
        if (modeArg === "copy") {
          await navigator.clipboard.writeText(csv);
        } else {
          downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `tabulazer-${ts}-${scopeLabel}.csv`);
        }
        return;
      }

      if (formatArg === "xml") {
        const xml = toXml(grid);
        if (modeArg === "copy") {
          await navigator.clipboard.writeText(xml);
        } else {
          downloadBlob(new Blob([xml], { type: "application/xml;charset=utf-8" }), `tabulazer-${ts}-${scopeLabel}.xml`);
        }
        return;
      }

      if (formatArg === "xlsx") {
        // SheetJS global
        if (typeof XLSX === "undefined" || !XLSX.utils || !XLSX.write) {
          alert("Tabulazer: XLSX export is not available (SheetJS missing)");
          return;
        }

        const ws = XLSX.utils.aoa_to_sheet(grid);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Table");

        const arr = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([arr], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        if (modeArg === "copy") {
          try {
            await copyBlob(blob, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          } catch (e) {
            downloadBlob(blob, `tabulazer-${ts}-${scopeLabel}.xlsx`);
          }
        } else {
          downloadBlob(blob, `tabulazer-${ts}-${scopeLabel}.xlsx`);
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
    [tabulazer.copyCsvCurrentMenuId]: { format: "csv", mode: "copy", scope: "current" },
    [tabulazer.copyXlsxCurrentMenuId]: { format: "xlsx", mode: "copy", scope: "current" },
    [tabulazer.copyXmlCurrentMenuId]: { format: "xml", mode: "copy", scope: "current" },
    [tabulazer.copyCsvAllMenuId]: { format: "csv", mode: "copy", scope: "all" },
    [tabulazer.copyXlsxAllMenuId]: { format: "xlsx", mode: "copy", scope: "all" },
    [tabulazer.copyXmlAllMenuId]: { format: "xml", mode: "copy", scope: "all" },

    [tabulazer.downloadCsvCurrentMenuId]: { format: "csv", mode: "download", scope: "current" },
    [tabulazer.downloadXlsxCurrentMenuId]: { format: "xlsx", mode: "download", scope: "current" },
    [tabulazer.downloadXmlCurrentMenuId]: { format: "xml", mode: "download", scope: "current" },
    [tabulazer.downloadCsvAllMenuId]: { format: "csv", mode: "download", scope: "all" },
    [tabulazer.downloadXlsxAllMenuId]: { format: "xlsx", mode: "download", scope: "all" },
    [tabulazer.downloadXmlAllMenuId]: { format: "xml", mode: "download", scope: "all" },
  };

  const action = copyMap[info.menuItemId];
  if (!action) return;

  const tableId = await resolveTargetTableId(tab);
  if (!tableId) {
    showNoTableSelected(tab);
    return;
  }

  await exportFromPage(tab, tableId, action.format, action.mode, action.scope);
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

  if (kind === "setQuickFilter") {
    const query = request && request.query ? String(request.query) : "";
    getActiveTab(async (tab) => {
      if (!tab || !tab.id) {
        sendResponse({ ok: false, error: "No active tab" });
        return;
      }
      await injectScripts(tab);
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [query],
        func: (q) => {
          try {
            if (typeof window.tabulazerSetQuickFilter === "function") {
              window.tabulazerSetQuickFilter(q);
            }
          } catch (e) {}
        },
      });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (kind === "openColumnChooser") {
    const tableId = request && request.tableId;
    getActiveTab(async (tab) => {
      if (!tab || !tab.id) {
        sendResponse({ ok: false, error: "No active tab" });
        return;
      }
      await injectScripts(tab);
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [tableId],
        func: (id) => {
          try {
            const inst = (typeof window.tabulazerGetInstanceById === "function") ? window.tabulazerGetInstanceById(id) : null;
            if (!inst || typeof inst.getColumns !== "function") {
              alert("Tabulazer: Column chooser is available only for active tables.");
              return;
            }

            const existing = document.getElementById("tabulazer-columns-overlay");
            if (existing) existing.remove();

            const overlay = document.createElement("div");
            overlay.id = "tabulazer-columns-overlay";
            overlay.style.cssText = "position:fixed;z-index:2147483647;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;";

            const card = document.createElement("div");
            card.style.cssText = "width:min(420px,92vw);max-height:80vh;overflow:auto;background:#fff;color:#111;border-radius:12px;padding:12px;box-shadow:0 10px 30px rgba(0,0,0,.35);font:13px/1.3 system-ui, -apple-system, Segoe UI, Roboto, Arial;";

            const title = document.createElement("div");
            title.textContent = "Columns";
            title.style.cssText = "font-weight:800;margin-bottom:8px;";

            const btnRow = document.createElement("div");
            btnRow.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-bottom:8px;";

            const closeBtn = document.createElement("button");
            closeBtn.textContent = "Close";
            closeBtn.style.cssText = "padding:6px 10px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;font-weight:700;";
            closeBtn.onclick = () => overlay.remove();

            btnRow.appendChild(closeBtn);

            const list = document.createElement("div");
            list.style.cssText = "display:flex;flex-direction:column;gap:6px;";

            const cols = inst.getColumns();
            cols.forEach((c) => {
              try {
                const def = c.getDefinition ? c.getDefinition() : null;
                const name = (def && (def.title || def.field)) ? (def.title || def.field) : "(column)";
                const row = document.createElement("label");
                row.style.cssText = "display:flex;align-items:center;gap:10px;padding:6px 8px;border:1px solid #e2e8f0;border-radius:10px;";
                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.checked = c.isVisible ? c.isVisible() : true;
                cb.onchange = () => {
                  if (cb.checked) { if (c.show) c.show(); } else { if (c.hide) c.hide(); }
                };
                const span = document.createElement("span");
                span.textContent = name;
                row.appendChild(cb);
                row.appendChild(span);
                list.appendChild(row);
              } catch (e) {}
            });

            card.appendChild(title);
            card.appendChild(btnRow);
            card.appendChild(list);
            overlay.appendChild(card);

            overlay.addEventListener("click", (ev) => {
              if (ev.target === overlay) overlay.remove();
            });

            document.documentElement.appendChild(overlay);
          } catch (e) {
            alert("Tabulazer: unable to open column chooser");
          }
        },
      });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (kind === "applySettings") {
    // Re-apply visual preferences to any active hosts.
    getActiveTab(async (tab) => {
      if (!tab || !tab.id) {
        sendResponse({ ok: false, error: "No active tab" });
        return;
      }
      await injectScripts(tab);
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          try {
            if (typeof window.tabulazerApplyVisualPrefs === "function") {
              window.tabulazerApplyVisualPrefs();
            }
          } catch (e) {}
        },
      });
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

});
