
(() => {
  "use strict";

  // Keep the old key so an existing v4 installation migrates its saved list automatically.
  const STORAGE_KEY = "local-shopping-memo-v2";
  const CATALOG_URL = "./items.json";
  const IMAGE_BASE = "./images/";

  const addForm = document.getElementById("addForm");
  const itemInput = document.getElementById("itemInput");
  const suggestions = document.getElementById("suggestions");
  const suggestionHint = document.getElementById("suggestionHint");
  const list = document.getElementById("list");
  const empty = document.getElementById("empty");
  const count = document.getElementById("count");
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importInput = document.getElementById("importInput");
  const clearBtn = document.getElementById("clearBtn");

  let catalog = {};
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

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase("ja");
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

    return {
      name: item.name || "",
      icon: item.icon || ""
    };
  }

  function identityKey(item) {
    if (item.catalogKey) return "catalog:" + item.catalogKey;
    return "manual:" + normalizeText(item.name);
  }

  function quantityOf(item) {
    const q = Number(item.quantity);
    return Number.isFinite(q) && q > 0 ? Math.floor(q) : 1;
  }

  function consolidateItems(source) {
    const merged = new Map();

    for (const raw of source) {
      if (!raw || typeof raw !== "object") continue;

      const name = typeof raw.name === "string" ? raw.name.trim() : "";
      const catalogKey = typeof raw.catalogKey === "string" && raw.catalogKey
        ? raw.catalogKey
        : null;

      if (!name && !catalogKey) continue;

      const normalized = {
        id: raw.id || makeId(),
        catalogKey,
        name: name || (catalogKey && catalog[catalogKey]?.alias) || catalogKey || "",
        icon: typeof raw.icon === "string" ? raw.icon : "",
        quantity: quantityOf(raw),
        createdAt: Number(raw.createdAt) || Date.now()
      };

      const key = identityKey(normalized);
      const existing = merged.get(key);

      if (existing) {
        existing.quantity += normalized.quantity;
        existing.createdAt = Math.min(existing.createdAt, normalized.createdAt);
      } else {
        merged.set(key, normalized);
      }
    }

    return Array.from(merged.values()).sort((a, b) => a.createdAt - b.createdAt);
  }

  function findCatalogKeyByExactAlias(name) {
    const target = normalizeText(name);
    if (!target) return null;

    for (const [key, master] of Object.entries(catalog)) {
      if (normalizeText(master.alias) === target) return key;
    }
    return null;
  }

  function migrateOldItemsToCatalog() {
    const aliasToKey = new Map();

    for (const [key, master] of Object.entries(catalog)) {
      const alias = typeof master.alias === "string" ? master.alias.trim() : "";
      if (alias) aliasToKey.set(normalizeText(alias), key);
    }

    let changed = false;

    items = items.map((item) => {
      if (!item || typeof item !== "object") return item;
      if (item.catalogKey) return item;

      const name = typeof item.name === "string" ? item.name.trim() : "";
      const key = aliasToKey.get(normalizeText(name));

      if (!key) return item;

      changed = true;
      return { ...item, catalogKey: key };
    });

    const consolidated = consolidateItems(items);
    if (JSON.stringify(consolidated) !== JSON.stringify(items)) changed = true;
    items = consolidated;

    if (changed) saveItems();
  }

  function incrementCatalogItem(catalogKey, delta = 1) {
    const master = catalog[catalogKey];
    if (!master) return;

    const key = "catalog:" + catalogKey;
    const existing = items.find((item) => identityKey(item) === key);

    if (existing) {
      existing.quantity = Math.max(1, quantityOf(existing) + delta);
    } else {
      items.push({
        id: makeId(),
        catalogKey,
        name: master.alias || catalogKey,
        icon: iconPath(master.iconfile),
        quantity: Math.max(1, delta),
        createdAt: Date.now()
      });
    }

    saveItems();
    renderList();
  }

  function incrementManualItem(name, delta = 1) {
    const clean = String(name || "").trim();
    if (!clean) return;

    const exactCatalogKey = findCatalogKeyByExactAlias(clean);
    if (exactCatalogKey) {
      incrementCatalogItem(exactCatalogKey, delta);
      return;
    }

    const key = "manual:" + normalizeText(clean);
    const existing = items.find((item) => identityKey(item) === key);

    if (existing) {
      existing.quantity = Math.max(1, quantityOf(existing) + delta);
    } else {
      items.push({
        id: makeId(),
        catalogKey: null,
        name: clean,
        icon: "",
        quantity: Math.max(1, delta),
        createdAt: Date.now()
      });
    }

    saveItems();
    renderList();
  }

  function changeQuantity(id, delta) {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;

    const next = quantityOf(item) + delta;

    if (next <= 0) {
      items = items.filter((entry) => entry.id !== id);
    } else {
      item.quantity = next;
    }

    saveItems();
    renderList();
  }

  function removeItem(id) {
    items = items.filter((item) => item.id !== id);
    saveItems();
    renderList();
  }

  function appendIconAndText(container, name, icon, options = {}) {
    if (icon) {
      const img = document.createElement("img");
      img.className = "item-icon";
      img.src = icon;
      img.alt = "";
      img.width = 32;
      img.height = 32;

      // If a catalog references an icon not present in the uploaded images folder,
      // hide the broken image instead of showing the browser's broken-image glyph.
      img.addEventListener("error", () => {
        img.remove();
      });

      container.appendChild(img);
    }

    const text = document.createElement("span");
    if (options.textClass) text.className = options.textClass;
    text.textContent = name;
    container.appendChild(text);
  }

  function renderList() {
    list.textContent = "";

    items = consolidateItems(items);
    saveItems();

    count.textContent = items.length + "品目";
    empty.style.display = items.length ? "none" : "block";

    for (const item of items) {
      const display = currentDisplay(item);
      const li = document.createElement("li");
      li.className = "shopping-row";

      const main = document.createElement("div");
      main.className = "item-main";
      appendIconAndText(main, display.name, display.icon, { textClass: "item-name" });

      const qty = document.createElement("span");
      qty.className = "item-qty";
      qty.textContent = "×" + quantityOf(item);
      main.appendChild(qty);

      const controls = document.createElement("div");
      controls.className = "item-controls";

      const minus = document.createElement("button");
      minus.className = "qty-button minus";
      minus.type = "button";
      minus.textContent = "−";
      minus.title = display.name + "を1つ減らす";
      minus.setAttribute("aria-label", display.name + "を1つ減らす");
      minus.addEventListener("click", () => changeQuantity(item.id, -1));

      const plus = document.createElement("button");
      plus.className = "qty-button plus";
      plus.type = "button";
      plus.textContent = "＋";
      plus.title = display.name + "を1つ増やす";
      plus.setAttribute("aria-label", display.name + "を1つ増やす");
      plus.addEventListener("click", () => changeQuantity(item.id, 1));

      const done = document.createElement("button");
      done.className = "done";
      done.type = "button";
      done.textContent = "✓";
      done.title = display.name + "を買ったので完了";
      done.setAttribute("aria-label", display.name + "を買ったのでリストから削除");
      done.addEventListener("click", () => removeItem(item.id));

      controls.append(minus, plus, done);
      li.append(main, controls);
      list.appendChild(li);
    }
  }

  function searchableText(key, master) {
    const values = [
      key,
      master.alias,
      ...(Array.isArray(master.keywords) ? master.keywords : [])
    ];
    return normalizeText(values.filter(Boolean).join(" "));
  }

  function suggestionEntries(query) {
    const q = normalizeText(query);
    const all = catalogEntries();

    if (!q) {
      return all
        .filter(([, master]) => master.quick === true)
        .map(([key, master]) => ({ key, master, match: false }));
    }

    const matches = [];
    const quickRemainder = [];

    for (const [key, master] of all) {
      const isMatch = searchableText(key, master).includes(q);

      if (isMatch) {
        matches.push({ key, master, match: true });
      } else if (master.quick === true) {
        quickRemainder.push({ key, master, match: false });
      }
    }

    return [...matches, ...quickRemainder];
  }

  function renderSuggestions() {
    suggestions.textContent = "";

    const query = itemInput.value;
    const entries = suggestionEntries(query);

    if (!entries.length) {
      const message = document.createElement("p");
      message.className = "catalog-status";
      message.textContent = query.trim()
        ? "一致する候補はありません。入力内容をそのまま追加できます。"
        : "items.json に quick:true の品目がありません。";
      suggestions.appendChild(message);
      return;
    }

    for (const { key, master, match } of entries) {
      const alias = master.alias || key;
      const chip = document.createElement("button");
      chip.className = "suggestion-chip" + (match ? " match" : "");
      chip.type = "button";
      chip.dataset.catalogKey = key;

      appendIconAndText(chip, alias, iconPath(master.iconfile));

      chip.addEventListener("click", () => {
        incrementCatalogItem(key);
        itemInput.value = "";
        renderSuggestions();
        itemInput.focus();
      });

      suggestions.appendChild(chip);
    }
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
        iconfile:
          typeof value.iconfile === "string" && value.iconfile.trim()
            ? value.iconfile.trim()
            : null,
        quick: value.quick === true,
        order: Number.isFinite(Number(value.order)) ? Number(value.order) : 999999,
        keywords: Array.isArray(value.keywords)
          ? value.keywords.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim())
          : []
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
      renderSuggestions();
      renderList();
    } catch (error) {
      console.error("items.json load failed:", error);

      suggestions.textContent = "";
      const message = document.createElement("p");
      message.className = "catalog-status catalog-error";
      message.textContent =
        "品目データを読み込めませんでした。通信状態または items.json を確認してください。";
      suggestions.appendChild(message);

      items = consolidateItems(items);
      renderList();
    }
  }

  addForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const value = itemInput.value.trim();
    if (!value) {
      itemInput.focus();
      return;
    }

    incrementManualItem(value);
    itemInput.value = "";
    renderSuggestions();
    itemInput.focus();
  });

  itemInput.addEventListener("input", renderSuggestions);

  exportBtn.addEventListener("click", () => {
    const payload = {
      app: "local-shopping-memo",
      version: 5,
      exportedAt: new Date().toISOString(),
      items: consolidateItems(items)
    };

    const blob = new Blob(
      [JSON.stringify(payload, null, 2)],
      { type: "application/json" }
    );

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download =
      "shopping_memo_backup_" +
      new Date().toISOString().slice(0, 10) +
      ".json";
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
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id: item.id || makeId(),
          catalogKey:
            typeof item.catalogKey === "string" && item.catalogKey
              ? item.catalogKey
              : null,
          name: typeof item.name === "string" ? item.name.trim() : "",
          icon: typeof item.icon === "string" ? item.icon : "",
          quantity: quantityOf(item),
          createdAt: Number(item.createdAt) || Date.now()
        }))
        .filter((item) => item.name || item.catalogKey);

      migrateOldItemsToCatalog();
      items = consolidateItems(items);
      saveItems();
      renderList();

      alert("バックアップを復元しました。");
    } catch (error) {
      console.error(error);
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

  // Render old saved data immediately, then enrich it after items.json is loaded.
  items = consolidateItems(items);
  renderList();
  loadCatalog();
})();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("Service Worker registration failed:", error);
    });
  });
}
