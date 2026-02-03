type TableInfo = {
  id: string;
  index: number;
  rows: number;
  cols: number;
  active: boolean;
};

type PopupListTablesResp = { ok: true; tables: TableInfo[] } | { ok: false; error: string };

type SyncSettings = {
  forceWidth: boolean;
  sorting: boolean;
  filters: boolean;
  paging: boolean;
  pageSize?: number;
};

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function getBool(id: string): boolean {
  return (($(id) as HTMLInputElement).checked);
}

function setBool(id: string, val: boolean) {
  (($(id) as HTMLInputElement).checked) = !!val;
}

function sendMessage<TResp>(msg: any): Promise<TResp> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (resp: TResp) => resolve(resp));
  });
}

async function restoreOptions() {
  const defaults: SyncSettings = {
    forceWidth: false,
    sorting: true,
    filters: true,
    paging: true,
    pageSize: 100,
  };

  const items = await new Promise<SyncSettings>((resolve) => {
    chrome.storage.sync.get(defaults, (v) => resolve(v as SyncSettings));
  });

  setBool("forceWidth", items.forceWidth);
  setBool("sorting", items.sorting);
  setBool("filters", items.filters);
  setBool("paging", items.paging);
}

async function saveOptions() {
  const items: SyncSettings = {
    forceWidth: getBool("forceWidth"),
    sorting: getBool("sorting"),
    filters: getBool("filters"),
    paging: getBool("paging"),
  };

  await new Promise<void>((resolve) => {
    chrome.storage.sync.set(items, () => resolve());
  });
}

function renderTables(tables: TableInfo[]) {
  const list = $("tablesList");
  list.innerHTML = "";

  if (!tables || tables.length === 0) {
    const empty = document.createElement("div");
    empty.style.fontSize = "0.85em";
    empty.style.opacity = "0.8";
    empty.textContent = "No tables found.";
    list.appendChild(empty);
    return;
  }

  tables.forEach((t) => {
    const row = document.createElement("div");
    row.className = "table-row" + (t.active ? " on" : "");

    const left = document.createElement("div");
    left.style.flex = "1 1 auto";
    left.style.fontSize = "0.9em";
    left.textContent = `#${t.index + 1} — ${t.rows || 0}x${t.cols || 0}`;

    const right = document.createElement("div");
    right.style.flex = "0 0 auto";

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = !!t.active;
    toggle.addEventListener("change", async () => {
      const next = toggle.checked;
      if (next) {
        await sendMessage({ type: "activateById", tableId: t.id });
      } else {
        await sendMessage({ type: "deactivateById", tableId: t.id });
      }
      await refreshTables();
    });

    right.appendChild(toggle);
    row.append(left, right);
    list.appendChild(row);
  });
}

async function refreshTables() {
  const resp = await sendMessage<PopupListTablesResp>({ type: "popupListTables" });
  if (!resp || (resp as any).ok === false) {
    renderTables([]);
    return;
  }
  renderTables((resp as any).tables || []);
}

async function main() {
  await restoreOptions();

  $("settingsForm").addEventListener("change", async (ev) => {
    const target = ev.target as HTMLElement | null;
    if (!target) return;
    if ((target as HTMLInputElement).tagName?.toLowerCase() === "input") {
      await saveOptions();
    }
  });

  $("btnPick").addEventListener("click", async () => {
    await sendMessage({ type: "popupStartPicker" });
    window.close();
  });

  $("btnToggleLast").addEventListener("click", async () => {
    await sendMessage({ type: "popupToggleLast" });
    await refreshTables();
  });

  $("btnRefresh").addEventListener("click", async () => {
    await refreshTables();
  });

  await refreshTables();
}

main().catch((e) => console.error("Tabulazer popup error", e));
