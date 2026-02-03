// Tabulazer core (injected into the page via chrome.scripting.executeScript)
// Defines a stable API on window:
// - window.tabulazerActivateById(tableId): toggles on/off for the targeted table

(function () {
  const REG_KEY = "__tabulazerRegistry";
  const registry = (window[REG_KEY] = window[REG_KEY] || {});

  function ensureHeaders($table) {
    // If the table has no TH on first line, change all TDs to THs
    $table.find("tr:first td")
      .wrapInner("<div />")
      .find("div")
      .unwrap()
      .wrap("<th />");

    // Fill empty TH on first line
    let thCnt = 0;
    $table.find("tr:first th").each(function (_i, e) {
      const $e = $(e);
      if (!$e.text().trim()) {
        thCnt++;
        $e.html("#" + thCnt);
      }
    });
  }

  function parseTableToData($table) {
    // Use first row as header definition.
    const $rows = $table.find("tr");
    if ($rows.length === 0) return { columns: [], data: [] };

    const $headerCells = $rows.first().find("th,td");
    const columns = [];
    $headerCells.each(function (idx, cell) {
      const title = $(cell).text().trim() || `#${idx + 1}`;
      columns.push({ title, field: "c" + idx, headerSort: true });
    });

    const data = [];
    $rows.slice(1).each(function (_r, row) {
      const $cells = $(row).find("td,th");
      if ($cells.length === 0) return;
      const obj = {};
      $cells.each(function (idx, cell) {
        // Preserve cell HTML so links/buttons remain usable in the Tabulator view.
        // Tabulator will render this via formatter:"html".
        const html = (cell && cell.innerHTML != null) ? cell.innerHTML : $(cell).text();
        obj["c" + idx] = (html || "").trim();
      });
      data.push(obj);
    });

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
      clipboard: true,
      clipboardCopyRowRange: "all",
      clipboardCopyStyled: false,
    };

    if (items.paging) {
      options.pagination = true;
      options.paginationMode = "local";
      options.paginationSize = Number(items.pageSize || 100);
    }

    return options;
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
    const $table = $(selector).first();

    if (!$table || $table.length === 0) {
      console.warn("Tabulazer: table not found for id", tableId);
      return;
    }

    // Normalize headers before parsing
    ensureHeaders($table);

    const originalHtml = $table.get(0).outerHTML;
    const parsed = parseTableToData($table);

    // Create host and replace the table
    const host = document.createElement("div");
    host.setAttribute("data-tabulazer-host-id", tableId);
    // Keep some metadata so the popup can still list this entry after the <table> is replaced.
    host.setAttribute("data-tabulazer-rows", String(parsed.data.length));
    host.setAttribute("data-tabulazer-cols", String(parsed.columns.length));
    host.style.minHeight = "120px";

    const tableEl = $table.get(0);
    tableEl.parentNode.replaceChild(host, tableEl);

    getSettings().then((items) => {
      if (items.forceWidth) {
        host.style.width = "100%";
      }

      const options = buildTabulatorOptions(items, parsed.columns, parsed.data);

      const instance = new Tabulator(host, options);

      registry[tableId] = {
        active: true,
        host,
        originalHtml,
        instance,
      };
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

  window.tabulazerGetLastActivatedId = function () {
    return lastActivatedId || null;
  };
})();
