function $(id) {
  var el = document.getElementById(id);
  if (!el) throw new Error("Missing element #" + id);
  return el;
}

function setStatus(msg) {
  $("status-msg").textContent = msg || "";
}

function sendMessage(msg) {
  return new Promise(function (resolve) {
    chrome.runtime.sendMessage(msg, function (resp) {
      resolve(resp);
    });
  });
}

async function getActiveTab() {
  return new Promise(function (resolve) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      resolve((tabs && tabs[0]) || null);
    });
  });
}

async function updateTabMeta() {
  var tab = await getActiveTab();
  if (!tab) {
    $("tab-meta").textContent = "No active tab";
    return;
  }
  var url = tab.url || "";
  try {
    var u = new URL(url);
    $("tab-meta").textContent = u.host + u.pathname;
  } catch (e) {
    $("tab-meta").textContent = url || "(no url)";
  }
}

async function restoreOptions() {
  return new Promise(function (resolve) {
    chrome.storage.sync.get(
      {
        forceWidth: false,
        sorting: true,
        filters: true,
        paging: true,
      },
      function (items) {
        $("forceWidth").checked = !!items.forceWidth;
        $("sorting").checked = !!items.sorting;
        $("filters").checked = !!items.filters;
        $("paging").checked = !!items.paging;
        resolve(items);
      }
    );
  });
}

async function saveOptions() {
  var items = {
    forceWidth: $("forceWidth").checked,
    sorting: $("sorting").checked,
    filters: $("filters").checked,
    paging: $("paging").checked,
  };
  return new Promise(function (resolve) {
    chrome.storage.sync.set(items, function () {
      resolve();
    });
  });
}

function renderTables(tables) {
  var list = $("tables-list");
  list.innerHTML = "";

  if (!tables || !tables.length) {
    var empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No tables found on this page.";
    list.appendChild(empty);
    return;
  }

  tables.forEach(function (t) {
    var state = !!t.active;

    var row = document.createElement("div");
    row.className = "table-row" + (state ? " on" : "");

    var label = document.createElement("div");
    label.className = "table-label";
    label.textContent = "#" + (t.index + 1) + " — " + (t.rows || 0) + "x" + (t.cols || 0);

    var sw = document.createElement("label");
    sw.className = "switch";

    var input = document.createElement("input");
    input.type = "checkbox";
    input.checked = state;

    var slider = document.createElement("span");
    slider.className = "slider";

    sw.appendChild(input);
    sw.appendChild(slider);

    input.addEventListener("change", async function () {
      input.disabled = true;
      setStatus("Working...");

      var next = input.checked;
      var msg = next ? { type: "activateById", tableId: t.id } : { type: "deactivateById", tableId: t.id };
      var resp = await sendMessage(msg);
      if (resp && resp.ok === false && resp.error) {
        setStatus(resp.error);
      } else {
        setStatus("");
      }

      await refreshTables(true);
    });

    row.appendChild(label);
    row.appendChild(sw);
    list.appendChild(row);
  });
}

let refreshTimer = null;
async function refreshTables(extraDebounce) {
  var resp = await sendMessage({ type: "popupListTables" });
  if (!resp || resp.ok === false) {
    setStatus((resp && resp.error) ? resp.error : "Unable to load tables for this tab.");
    renderTables([]);
    return;
  }

  setStatus("");
  renderTables(resp.tables || []);

  if (extraDebounce) {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function () {
      refreshTables(false);
    }, 350);
  }
}

async function wireEvents() {
  $("btn-refresh").addEventListener("click", async function () {
    await updateTabMeta();
    await refreshTables(false);
  });

  $("btn-pick").addEventListener("click", async function () {
    setStatus("Pick a table...");
    await sendMessage({ type: "popupStartPicker" });
  });

  $("btn-toggle-last").addEventListener("click", async function () {
    setStatus("Working...");
    await sendMessage({ type: "popupToggleLast" });
    await refreshTables(true);
  });

  $("btn-deactivate-all").addEventListener("click", async function () {
    setStatus("Working...");
    await sendMessage({ type: "deactivateAll" });
    await refreshTables(true);
  });

  // Settings: save on change
  ["forceWidth", "sorting", "filters", "paging"].forEach(function (id) {
    $(id).addEventListener("change", function () {
      saveOptions();
    });
  });

  // Auto-refresh when tab changes
  chrome.tabs.onActivated.addListener(function () {
    updateTabMeta();
    refreshTables(false);
  });
  chrome.tabs.onUpdated.addListener(function (_tabId, changeInfo) {
    if (changeInfo && changeInfo.status === "complete") {
      updateTabMeta();
      refreshTables(false);
    }
  });
}

(async function main() {
  await restoreOptions();
  await wireEvents();
  await updateTabMeta();
  await refreshTables(false);
})();
