(() => {
  "use strict";

  const STORAGE_KEY = "local-shopping-memo-v2";
  const CATALOG_URL = "./items.json";
  const IMAGE_BASE = "./images/";

  const presetButton = document.getElementById("presetButton");
  const presetButtonLabel = document.getElementById("presetButtonLabel");
  const presetMenu = document.getElementById("presetMenu");
  const addPreset = document.getElementById("addPreset");
  const quickItems = document.getElementById("quickItems");
  const manualForm = document.getElementById("manualForm");
  const manual = document.getElementById("manual");
  const list = document.getElementById("list");
  const empty = document.getElementById("empty");
  const count = document.getElementById("count");
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importInput = document.getElementById("importInput");
  const clearBtn = document.getElementById("clearBtn");

  let catalog = {};
  let selectedPresetKey = null;
  let items = loadItems();

  function loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveItems() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function makeId() {
    return window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random();
  }

  function iconPath(iconfile) {
    return iconfile ? IMAGE_BASE + iconfile : "";
  }

  function catalogEntries() {
    return Object.entries(catalog).sort((a, b) => {
      const orderA = Number.isFinite(Number(a[1].order)) ? Number(a[1].order) : 999999;
      const orderB = Number.isFinite(Number(b[1].order)) ? Number(b[1].order) : 999999;
      if (orderA !== orderB) return orderA - orderB;
      return String(a[1].alias || a[0]).localeCompare(String(b[1].alias || b[0]), "ja");
    });
  }

  function currentDisplay(item) {
    if (item.catalogKey && catalog[item.catalogKey]) {
      const master = catalog[item.catalogKey];
      return {
        name: master.alias || item.name || item.catalogKey,
        icon: iconPath(master.iconfile)
      };
    }
    return { name: item.name || "", icon: item.icon || "" };
  }

  function addCatalogItem(catalogKey) {
    const master = catalog[catalogKey];
    if (!master) return;

    items.push({
      id: makeId(),
      catalogKey,
      name: master.alias || catalogKey,
      icon: iconPath(master.iconfile),
      createdAt: Date.now()
    });
    saveItems();
    renderList();
  }

  function addManualItem(name) {
    const clean = String(name || "").trim();
    if (!clean) return;

    items.push({
      id: makeId(),
      catalogKey: null,
      name: clean,
      icon: "",
      createdAt: Date.now()
    });
    saveItems();
    renderList();
  }

  function removeItem(id) {
    items = items.filter((item) => item.id !== id);
    saveItems();
    renderList();
  }

  function appendIconAndText(container, name, icon) {
    if (icon) {
      const img = document.createElement("img");
      img.className = "item-icon";
      img.src = icon;
      img.alt = "";
      img.width = 16;
      img.height = 16;
      container.appendChild(img);
    }

    const text = document.createElement("span");
    text.textContent = name;
    container.appendChild(text);
  }

  function renderList() {
    list.textContent = "";
    count.textContent = items.length + "件";
    empty.style.display = items.length ? "none" : "block";

    for (const item of items) {
      const display = currentDisplay(item);
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.className = "name";
      appendIconAndText(name, display.name, display.icon);

      const done = document.createElement("button");
      done.className = "done";
      done.type = "button";
      done.textContent = "✓";
      done.title = "買ったので削除";
      done.setAttribute("aria-label", display.name + "を削除");
      done.addEventListener("click", () => removeItem(item.id));

      li.append(name, done);
      list.appendChild(li);
    }
  }

  function closePresetMenu() {
    presetMenu.classList.add("hidden");
    presetButton.setAttribute("aria-expanded", "false");
  }

  function openPresetMenu() {
    presetMenu.classList.remove("hidden");
    presetButton.setAttribute("aria-expanded", "true");
  }

  function setPreset(catalogKey) {
    const master = catalog[catalogKey];
    if (!master) return;

    selectedPresetKey = catalogKey;
    presetButtonLabel.textContent = "";
    appendIconAndText(
      presetButtonLabel,
      master.alias || catalogKey,
      iconPath(master.iconfile)
    );
    closePresetMenu();
  }

  function resetPreset() {
    selectedPresetKey = null;
    presetButtonLabel.textContent = "選択してください";
  }

  function renderCatalogControls() {
    presetMenu.textContent = "";
    quickItems.textContent = "";

    const entries = catalogEntries();

    if (!entries.length) {
      const message = document.createElement("p");
      message.className = "catalog-status";
      message.textContent = "items.json に品目がありません。";
      presetMenu.appendChild(message);
      return;
    }

    for (const [key, master] of entries) {
      const alias = master.alias || key;
      const icon = iconPath(master.iconfile);

      const option = document.createElement("button");
      option.className = "preset-option" + (icon ? " icon-option" : "");
      option.type = "button";
      option.dataset.catalogKey = key;
      appendIconAndText(option, alias, icon);
      option.addEventListener("click", () => setPreset(key));
      presetMenu.appendChild(option);

      if (master.quick === true) {
        const chip = document.createElement("button");
        chip.className = "chip" + (icon ? " chip-icon" : "");
        chip.type = "button";
        chip.dataset.catalogKey = key;
        appendIconAndText(chip, alias, icon);
        chip.addEventListener("click", () => addCatalogItem(key));
        quickItems.appendChild(chip);
      }
    }
  }

  function migrateOldItemsToCatalog() {
    let changed = false;
    const aliasToKey = new Map();

    for (const [key, master] of Object.entries(catalog)) {
      if (master && typeof master.alias === "string" && master.alias.trim()) {
        aliasToKey.set(master.alias.trim(), key);
      }
    }

    items = items.map((item) => {
      if (item.catalogKey || typeof item.name !== "string") return item;
      const key = aliasToKey.get(item.name.trim());
      if (!key) return item;
      changed = true;
      return { ...item, catalogKey: key };
    });

    if (changed) saveItems();
  }

  function validateCatalog(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("items.json のルートはオブジェクトである必要があります。");
    }

    const result = {};
    for (const [key, value] of Object.entries(data)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const alias = typeof value.alias === "string" ? value.alias.trim() : "";
      if (!alias) continue;

      result[key] = {
        alias,
        iconfile: typeof value.iconfile === "string" && value.iconfile.trim()
          ? value.iconfile.trim()
          : null,
        quick: value.quick === true,
        order: Number.isFinite(Number(value.order)) ? Number(value.order) : 999999
      };
    }
    return result;
  }

  async function loadCatalog() {
    try {
      const response = await fetch(CATALOG_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      catalog = validateCatalog(await response.json());
      migrateOldItemsToCatalog();
      renderCatalogControls();
      renderList();
    } catch (error) {
      console.error("items.json load failed:", error);
      presetMenu.textContent = "";
      const message = document.createElement("p");
      message.className = "catalog-status catalog-error";
      message.textContent = "品目データを読み込めませんでした。通信状態または items.json を確認してください。";
      presetMenu.appendChild(message);
      quickItems.textContent = "";
      renderList();
    }
  }

  presetButton.addEventListener("click", () => {
    presetMenu.classList.contains("hidden") ? openPresetMenu() : closePresetMenu();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".preset-picker")) closePresetMenu();
  });

  addPreset.addEventListener("click", () => {
    if (!selectedPresetKey) {
      openPresetMenu();
      return;
    }
    addCatalogItem(selectedPresetKey);
    resetPreset();
  });

  manualForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!manual.value.trim()) {
      manual.focus();
      return;
    }
    addManualItem(manual.value);
    manual.value = "";
    manual.focus();
  });

  exportBtn.addEventListener("click", () => {
    const payload = {
      app: "local-shopping-memo",
      version: 4,
      exportedAt: new Date().toISOString(),
      items
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "shopping_memo_backup_" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  importBtn.addEventListener("click", () => importInput.click());

  importInput.addEventListener("change", async () => {
    const file = importInput.files && importInput.files[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      const imported = Array.isArray(parsed) ? parsed : parsed.items;
      if (!Array.isArray(imported)) throw new Error();

      items = imported
        .filter((item) => item && typeof item.name === "string")
        .map((item) => ({
          id: item.id || makeId(),
          catalogKey: typeof item.catalogKey === "string" ? item.catalogKey : null,
          name: item.name.trim(),
          icon: typeof item.icon === "string" ? item.icon : "",
          createdAt: Number(item.createdAt) || Date.now()
        }))
        .filter((item) => item.name);

      migrateOldItemsToCatalog();
      saveItems();
      renderList();
      alert("バックアップを復元しました。");
    } catch {
      alert("このJSONファイルは読み込めませんでした。");
    } finally {
      importInput.value = "";
    }
  });

  clearBtn.addEventListener("click", () => {
    if (!items.length) return;
    if (!confirm("買い物リストをすべて削除しますか？")) return;
    items = [];
    saveItems();
    renderList();
  });

  renderList();
  loadCatalog();
})();

// GitHub Pages / PWA: HTTPS配信時のみService Workerを登録します。
if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("Service Worker registration failed:", error);
    });
  });
}
