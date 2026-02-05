// Tabulazer core (injected into the page via chrome.scripting.executeScript)
// Defines a stable API on window:
// - window.tabulazerActivateById(tableId): toggles on/off for the targeted table

(function () {
  const REG_KEY = "__tabulazerRegistry";
  const registry = (window[REG_KEY] = window[REG_KEY] || {});

  function ensureHeaders(table) {
    // If the table has no TH on first line, change all TDs to THs
    const firstRow = table.querySelector("tr");
    if (firstRow) {
      firstRow.querySelectorAll("td").forEach(function (td) {
        const th = document.createElement("th");
        th.innerHTML = td.innerHTML;
        td.parentNode.replaceChild(th, td);
      });
    }

    // Fill empty TH on first line
    let thCnt = 0;
    if (firstRow) {
      firstRow.querySelectorAll("th").forEach(function (th) {
        if (!th.textContent.trim()) {
          thCnt++;
          th.innerHTML = "#" + thCnt;
        }
      });
    }
  }

  function parseTableToData(table) {
    // Use first row as header definition.
    const rows = table.querySelectorAll("tr");
    if (rows.length === 0) return { columns: [], data: [] };

    const headerCells = rows[0].querySelectorAll("th,td");
    const columns = [];
    headerCells.forEach(function (cell, idx) {
      const title = cell.textContent.trim() || `#${idx + 1}`;
      columns.push({ title, field: "c" + idx, headerSort: true });
    });

    const data = [];
    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r].querySelectorAll("td,th");
      if (cells.length === 0) continue;
      const obj = {};
      cells.forEach(function (cell, idx) {
        // Preserve cell HTML so links/buttons remain usable in the Tabulator view.
        // Tabulator will render this via formatter:"html".
        const html = (cell && cell.innerHTML != null) ? cell.innerHTML : cell.textContent;
        obj["c" + idx] = (html || "").trim();
      });
      data.push(obj);
    }

    return { columns, data };
  }

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        {
          forceWidth: false,
          sorting: true,
          filters: true,
          paging: true,
          pageSize: 100,
          quickFilter: false,
          columnChooser: false,
          rememberLayout: false,
          compactMode: false,
          zebraRows: false,
          fontSize: 100,
        },
        (items) => resolve(items)
      );
    });
  }

  function buildTabulatorOptions(items, columns, data) {
    const columnDefaults = {
      resizable: "header",
      formatter: "html",
      width: null,
      tooltip: true,
    };

    // Apply toggles (bugfix: these were previously ignored)
    columnDefaults.headerSort = !!items.sorting;
    if (items.filters) {
      columnDefaults.headerFilterPlaceholder = "";
      columnDefaults.headerFilter = "input";
    }

    const options = {
      data,
      columns,
      layout: "fitColumns",
      movableColumns: false,
      columnDefaults,
      // Clipboard shortcuts removed in favor of explicit Copy/Download actions.
      clipboard: false,
    };

    // Remember layout (per page)
    if (items.rememberLayout) {
      const pid = "tabulazer:" + location.origin + location.pathname + location.search;
      options.persistence = {
        sort: true,
        filter: true,
        columns: true,
      };
      options.persistenceID = pid;
    }

    if (items.paging) {
      options.pagination = true;
      options.paginationMode = "local";
      options.paginationSize = Number(items.pageSize || 100);
    }

    return options;
  }

  let currentQuickFilter = "";

  function applyVisualPrefs(host, items) {
    if (!host) return;

    try {
      host.classList.toggle("tabulazer-compact", !!items.compactMode);
      host.classList.toggle("tabulazer-zebra", !!items.zebraRows);
      const fs = Number(items.fontSize || 100);
      host.style.setProperty("--tabulazer-font-scale", String(fs / 100));
    } catch (e) {}
  }

  function applyQuickFilterToInstance(instance) {
    try {
      if (!instance || typeof instance.setFilter !== "function") return;

      const q = (currentQuickFilter || "").trim().toLowerCase();
      if (!q) {
        // Clear any previous filter.
        if (typeof instance.clearFilter === "function") instance.clearFilter(true);
        return;
      }

      instance.setFilter(function (rowData) {
        try {
          const vals = Object.values(rowData || {});
          for (let i = 0; i < vals.length; i++) {
            const s = (vals[i] == null) ? "" : String(vals[i]);
            if (s.toLowerCase().includes(q)) return true;
          }
        } catch (e) {}
        return false;
      });
    } catch (e) {}
  }

  function applyQuickFilterToAll() {
    Object.keys(registry).forEach((id) => {
      const entry = registry[id];
      if (entry && entry.active && entry.instance) {
        applyQuickFilterToInstance(entry.instance);
      }
    });
  }

  function activate(tableId) {
    // Toggle off if already active.
    // IMPORTANT: when active, the original <table> has been replaced by the host div,
    // so querying the DOM for the table will fail. We must check registry first.
    if (registry[tableId] && registry[tableId].active) {
      deactivate(tableId);
      return;
    }

    const selector = `table[data-tabulazer-table-id="${tableId}"]`;
    const table = document.querySelector(selector);

    if (!table) {
      console.warn("Tabulazer: table not found for id", tableId);
      return;
    }

    // Normalize headers before parsing
    ensureHeaders(table);

    const originalHtml = table.outerHTML;
    const parsed = parseTableToData(table);

    // Create host and replace the table
    const host = document.createElement("div");
    host.setAttribute("data-tabulazer-host-id", tableId);
    // Keep some metadata so the popup can still list this entry after the <table> is replaced.
    host.setAttribute("data-tabulazer-rows", String(parsed.data.length));
    host.setAttribute("data-tabulazer-cols", String(parsed.columns.length));
    host.style.minHeight = "120px";

    table.parentNode.replaceChild(host, table);

    getSettings().then((items) => {
      if (items.forceWidth) {
        host.style.width = "100%";
      }

      applyVisualPrefs(host, items);

      const options = buildTabulatorOptions(items, parsed.columns, parsed.data);

      const instance = new Tabulator(host, options);

      registry[tableId] = {
        active: true,
        host,
        originalHtml,
        instance,
      };

      // Apply quick filter if enabled (it will be a no-op if empty)
      if (items.quickFilter) {
        applyQuickFilterToInstance(instance);
      }
    });
  }

  function deactivate(tableId) {
    const entry = registry[tableId];
    if (!entry || !entry.active) return;

    try {
      if (entry.instance && typeof entry.instance.destroy === "function") {
        entry.instance.destroy();
      }
    } catch (e) {
      console.warn("Tabulazer: failed to destroy Tabulator instance", e);
    }

    // Restore original table
    try {
      entry.host.outerHTML = entry.originalHtml;
    } catch (e) {
      console.error("Tabulazer: failed to restore original table", e);
    }

    entry.active = false;
    delete registry[tableId];
  }

  // Track the most recently activated table id to enable a toggle fallback
  // even when the original <table> is replaced by the Tabulator UI.
  let lastActivatedId = null;

  function toggleLast() {
    if (!lastActivatedId) return false;
    if (registry[lastActivatedId] && registry[lastActivatedId].active) {
      deactivate(lastActivatedId);
      return true;
    }
    // If it's not active we can't reliably re-activate without a real <table>.
    // Activation should be done via activate(tableId) when a table target is known.
    return false;
  }

  // Expose API
  window.tabulazerActivateById = function (tableId) {
    lastActivatedId = tableId;
    return activate(tableId);
  };
  window.tabulazerDeactivateById = deactivate;
  window.tabulazerToggleLast = toggleLast;

  // Export helpers
  window.tabulazerGetOriginalHtmlById = function (tableId) {
    const entry = registry[tableId];
    if (entry && entry.active && entry.originalHtml) return entry.originalHtml;
    return null;
  };

  window.tabulazerGetInstanceById = function (tableId) {
    const entry = registry[tableId];
    if (entry && entry.active && entry.instance) return entry.instance;
    return null;
  };

  window.tabulazerGetLastActivatedId = function () {
    return lastActivatedId || null;
  };

  window.tabulazerSetQuickFilter = function (q) {
    currentQuickFilter = (q == null) ? "" : String(q);
    applyQuickFilterToAll();
  };

  window.tabulazerApplyVisualPrefs = function () {
    getSettings().then((items) => {
      Object.keys(registry).forEach((id) => {
        const entry = registry[id];
        if (entry && entry.active && entry.host) {
          applyVisualPrefs(entry.host, items);
        }
      });
    });
  };
})();
