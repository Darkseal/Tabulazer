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

function listTables() {
  try {
    // Include both real tables and active Tabulazer hosts (tables replaced by Tabulator).
    var nodes = Array.prototype.slice.call(
      document.querySelectorAll("table, [data-tabulazer-host-id]")
    );

    var out = [];
    nodes.forEach(function (node, idx) {
      // Active (host)
      if (node && node.getAttribute && node.hasAttribute("data-tabulazer-host-id")) {
        var hid = node.getAttribute("data-tabulazer-host-id");
        if (!hid) return;
        var hRows = Number(node.getAttribute("data-tabulazer-rows") || 0);
        var hCols = Number(node.getAttribute("data-tabulazer-cols") || 0);
        out.push({ id: hid, index: idx, rows: hRows, cols: hCols, active: true });
        return;
      }

      // Normal table
      if (node && node.tagName && node.tagName.toLowerCase() === "table") {
        var id = ensureTableId(node);
        var rows = node.rows ? node.rows.length : 0;
        var cols = 0;
        try {
          cols = node.rows && node.rows[0] ? node.rows[0].cells.length : 0;
        } catch (e) {
          cols = 0;
        }
        out.push({ id: id, index: idx, rows: rows, cols: cols, active: false });
      }
    });

    return out;
  } catch (e) {
    return [];
  }
}

function stopPicker() {
  if (!tabulazer._pickerActive) return;
  tabulazer._pickerActive = false;

  try {
    document.removeEventListener("mousemove", tabulazer._pickerOnMove, true);
    document.removeEventListener("click", tabulazer._pickerOnClick, true);
    document.removeEventListener("keydown", tabulazer._pickerOnKeyDown, true);
  } catch (e) {}

  try {
    if (tabulazer._pickerStyleEl && tabulazer._pickerStyleEl.parentNode) {
      tabulazer._pickerStyleEl.parentNode.removeChild(tabulazer._pickerStyleEl);
    }
  } catch (e) {}

  try {
    if (tabulazer._pickerBadgeEl && tabulazer._pickerBadgeEl.parentNode) {
      tabulazer._pickerBadgeEl.parentNode.removeChild(tabulazer._pickerBadgeEl);
    }
  } catch (e) {}

  tabulazer._pickerStyleEl = null;
  tabulazer._pickerBadgeEl = null;
  tabulazer._pickerOnMove = null;
  tabulazer._pickerOnClick = null;
  tabulazer._pickerOnKeyDown = null;
  tabulazer._pickerHoverEl = null;
}

function startPicker() {
  if (tabulazer._pickerActive) return;
  tabulazer._pickerActive = true;

  // Style
  var style = document.createElement("style");
  style.id = "tabulazer-picker-style";
  style.textContent = "\n" +
    ".tabulazer-picker-hover{outline:3px solid #ff9800 !important; outline-offset:2px !important; cursor:crosshair !important;}\n" +
    "#tabulazer-picker-badge{position:fixed; z-index:2147483647; top:10px; right:10px; background:#111; color:#fff; padding:8px 10px; font:12px/1.2 Arial,sans-serif; border-radius:6px; box-shadow:0 2px 10px rgba(0,0,0,.35);}\n" +
    "#tabulazer-picker-badge strong{font-weight:700;}\n";
  document.documentElement.appendChild(style);
  tabulazer._pickerStyleEl = style;

  var badge = document.createElement("div");
  badge.id = "tabulazer-picker-badge";
  badge.innerHTML = "<strong>Tabulazer</strong>: click a table to activate/deactivate. Press ESC to cancel.";
  document.documentElement.appendChild(badge);
  tabulazer._pickerBadgeEl = badge;

  function resolveTableFromTarget(target) {
    if (!target || !target.closest) return null;

    // If clicking inside an active Tabulator UI, map back to the original id.
    var host = target.closest("[data-tabulazer-host-id]");
    if (host) {
      var hostId = host.getAttribute("data-tabulazer-host-id");
      return { kind: "host", id: hostId, el: host };
    }

    var table = target.closest("table");
    if (!table) return null;
    return { kind: "table", id: ensureTableId(table), el: table };
  }

  tabulazer._pickerOnMove = function (ev) {
    var hit = resolveTableFromTarget(ev.target);
    var el = hit && hit.el;

    if (tabulazer._pickerHoverEl && tabulazer._pickerHoverEl !== el) {
      tabulazer._pickerHoverEl.classList.remove("tabulazer-picker-hover");
    }
    tabulazer._pickerHoverEl = el;
    if (el) el.classList.add("tabulazer-picker-hover");
  };

  tabulazer._pickerOnClick = function (ev) {
    var hit = resolveTableFromTarget(ev.target);
    if (!hit || !hit.id) return;

    ev.preventDefault();
    ev.stopPropagation();

    // Keep for context-menu flow too.
    tabulazer.lastTableId = hit.id;

    // Notify service worker.
    try {
      if (hit.kind === "host") {
        // Clicking a Tabulator host means the table is active: toggle off.
        chrome.runtime.sendMessage({ type: "deactivateById", tableId: hit.id });
      } else {
        chrome.runtime.sendMessage({ type: "pickerSelected", tableId: hit.id });
      }
    } catch (e) {
      // Fallback: we can still store lastTableId; user can use the context menu.
    }

    stopPicker();
  };

  tabulazer._pickerOnKeyDown = function (ev) {
    if (ev.key === "Escape") {
      stopPicker();
    }
  };

  document.addEventListener("mousemove", tabulazer._pickerOnMove, true);
  document.addEventListener("click", tabulazer._pickerOnClick, true);
  document.addEventListener("keydown", tabulazer._pickerOnKeyDown, true);
}

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
    case "listTables":
      sendResponse({ tables: listTables() });
      break;
    case "startPicker":
      startPicker();
      sendResponse({ ok: true });
      break;
    case "stopPicker":
      stopPicker();
      sendResponse({ ok: true });
      break;
  }
});
