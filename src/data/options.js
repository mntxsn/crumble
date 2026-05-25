import {
  AVAILABLE_LOCALES,
  LOCALE_NAMES,
  buildTranslator,
  resolveLocale,
} from "./js/i18n.js";
import { parseWhitelistInput } from "./js/utils.js";

const DEFAULT_SETTINGS = {
  whitelistedDomains: {},
  statusIndicators: true,
  debug: false,
  theme: "auto",
  // "auto" = match browser UI language at runtime (see resolveLocale).
  // Switches to an explicit locale code as soon as the user picks one.
  language: "auto",
};

// `syncSettings` is intentionally stored only in `local` — never synced. It
// describes WHERE settings live, so it cannot itself live in sync (chicken/egg).
const SYNC_FLAG_KEY = "syncSettings";

// Live translator. Rebuilt whenever the user changes language so the entire
// UI re-translates in place without a reload.
let t = (key) => key;

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

function getSyncFlag() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [SYNC_FLAG_KEY]: false }, (data) => {
      resolve(Boolean(data[SYNC_FLAG_KEY]));
    });
  });
}

function setSyncFlag(value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SYNC_FLAG_KEY]: value }, resolve);
  });
}

async function loadSettings() {
  const useSync = await getSyncFlag();
  const area = useSync ? chrome.storage.sync : chrome.storage.local;
  return new Promise((resolve) => {
    area.get({ settings: DEFAULT_SETTINGS }, ({ settings }) => {
      resolve({ ...DEFAULT_SETTINGS, ...settings });
    });
  });
}

async function saveSettings(settings) {
  const useSync = await getSyncFlag();
  // Always write to local as a safety net even when sync is the canonical
  // store — so the user never loses their whitelist if sync goes wrong.
  await new Promise((resolve) =>
    chrome.storage.local.set({ settings }, resolve)
  );
  if (useSync) {
    await new Promise((resolve, reject) => {
      chrome.storage.sync.set({ settings }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
  }
}

function showSaved(elemId, messageKey, isError) {
  const el = document.getElementById(elemId);
  el.textContent = t(messageKey);
  el.classList.remove("ok", "err");
  el.classList.add("status-msg", isError ? "err" : "ok");
  setTimeout(() => {
    el.textContent = "";
    el.classList.remove("ok", "err");
  }, 3000);
}

function populateLanguageSelect() {
  const select = document.getElementById("language");
  select.innerHTML = "";

  // "Auto (match browser)" first so it's the natural pick when the user
  // hasn't decided.
  const autoOpt = document.createElement("option");
  autoOpt.value = "auto";
  autoOpt.dataset.translate = "optionLanguageAuto";
  autoOpt.textContent = "Auto (match browser)";
  select.appendChild(autoOpt);

  for (const code of AVAILABLE_LOCALES) {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = LOCALE_NAMES[code] || code;
    select.appendChild(opt);
  }
}

async function setLanguage(settingValue) {
  // settingValue may be "auto" or a bundled locale code; resolveLocale picks
  // the actual locale to load translations from.
  const actual = resolveLocale(settingValue);
  const translator = await buildTranslator(actual);
  t = translator.t;
  document.documentElement.lang = translator.locale.replace("_", "-");
  applyTranslations();
}

function applyTranslations() {
  const orDefault = (key, fallback) => t(key) || fallback;

  document.title = document.getElementById("title").textContent =
    t("optionsTitle") + " - " + t("extensionName");

  document.getElementById("general_heading").textContent = orDefault(
    "optionsGeneralSection",
    "General"
  );
  document.getElementById("whitelist_heading").textContent = orDefault(
    "optionsWhitelistSection",
    "Whitelist"
  );
  document.getElementById("backup_heading").textContent = orDefault(
    "optionsBackupSection",
    "Backup"
  );

  document.getElementById("status_indicators_label").textContent = t(
    "optionStatusIndicators"
  );
  document.getElementById("debug_label").textContent = t("optionDebug");
  document.getElementById("sync_settings_label").textContent = t("optionSync");
  document.getElementById("theme_label").textContent = orDefault(
    "optionTheme",
    "Theme"
  );
  document.getElementById("language_label").textContent = orDefault(
    "optionLanguage",
    "Language"
  );
  document.getElementById("language_hint").textContent = orDefault(
    "optionLanguageHint",
    ""
  );
  document.getElementById("whitelist_label").textContent =
    t("optionsWhitelist");
  document.getElementById("whitelist_hint").textContent = orDefault(
    "optionsWhitelistHint",
    ""
  );
  document.getElementById("backup_hint").textContent = orDefault(
    "optionsBackupHint",
    ""
  );

  document.getElementById("save").setAttribute("value", t("optionsButton"));
  document.getElementById("export").setAttribute("value", t("optionsExport"));
  document
    .getElementById("import_trigger")
    .setAttribute("value", t("optionsImport"));

  document.getElementById("support_heading").textContent = orDefault(
    "supportHeading",
    "Support Crumble"
  );
  document.getElementById("support_lead").textContent = orDefault(
    "supportLead",
    "If Crumble saves you from clicking through cookie banners, consider sponsoring the project."
  );
  document.getElementById("support_link").textContent = orDefault(
    "supportButton",
    "Sponsor on GitHub"
  );

  // Translate any element marked with data-translate (used by <option> tags
  // in the theme select).
  for (const el of document.querySelectorAll("[data-translate]")) {
    el.textContent = t(el.dataset.translate) || el.textContent;
  }
}

async function saveOptions() {
  const theme = document.getElementById("theme").value;
  const language = document.getElementById("language").value;
  const settings = {
    whitelistedDomains: parseWhitelistInput(
      document.getElementById("whitelist").value
    ),
    statusIndicators: document.getElementById("status_indicators").checked,
    debug: document.getElementById("debug").checked,
    theme,
    language,
  };

  const syncOn = document.getElementById("sync_settings").checked;
  await setSyncFlag(syncOn);
  try {
    await saveSettings(settings);
    applyTheme(theme);
    await setLanguage(language);
    showSaved("status_saved", "optionsSaved", false);
  } catch (err) {
    console.error("Save failed:", err);
    showSaved("status_saved", "optionsImportError", true);
  }
  chrome.runtime.sendMessage("update_settings");
}

async function restoreOptions() {
  const settings = await loadSettings();
  const useSync = await getSyncFlag();
  document.getElementById("whitelist").value = Object.keys(
    settings.whitelistedDomains || {}
  )
    .sort()
    .join("\n");
  document.getElementById("status_indicators").checked =
    settings.statusIndicators !== false;
  document.getElementById("debug").checked = Boolean(settings.debug);
  document.getElementById("sync_settings").checked = useSync;
  document.getElementById("theme").value = ["light", "dark", "auto"].includes(
    settings.theme
  )
    ? settings.theme
    : "auto";

  const storedLang = settings.language;
  const dropdownValue =
    storedLang === "auto" || !storedLang
      ? "auto"
      : AVAILABLE_LOCALES.includes(storedLang)
        ? storedLang
        : "auto";
  document.getElementById("language").value = dropdownValue;

  applyTheme(settings.theme);
  await setLanguage(dropdownValue);
}

function exportSettings() {
  loadSettings().then((settings) => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            exportedAt: new Date().toISOString(),
            settings,
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `idcac-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

async function importSettings(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const incoming = parsed.settings || parsed;
    if (
      !incoming ||
      typeof incoming !== "object" ||
      typeof incoming.whitelistedDomains !== "object"
    ) {
      throw new Error("Invalid backup format");
    }

    const current = await loadSettings();
    const merged = {
      ...DEFAULT_SETTINGS,
      ...current,
      ...incoming,
      whitelistedDomains: {
        ...current.whitelistedDomains,
        ...incoming.whitelistedDomains,
      },
    };

    await saveSettings(merged);
    chrome.runtime.sendMessage("update_settings");
    await restoreOptions();
    showSaved("status_import", "optionsImportSuccess", false);
  } catch (err) {
    console.error("Import failed:", err);
    showSaved("status_import", "optionsImportError", true);
  }
}

async function init() {
  populateLanguageSelect();
  await restoreOptions();

  document.getElementById("save").addEventListener("click", saveOptions);
  document.getElementById("export").addEventListener("click", exportSettings);
  document
    .getElementById("import_trigger")
    .addEventListener("click", () => {
      document.getElementById("import_file").click();
    });
  document
    .getElementById("import_file")
    .addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) importSettings(file);
      event.target.value = "";
    });
  // Live language preview: switch UI text the moment the user picks a new
  // language, even before they hit Save.
  document.getElementById("language").addEventListener("change", (event) => {
    setLanguage(event.target.value);
  });
  // Same for theme: instant feedback.
  document.getElementById("theme").addEventListener("change", (event) => {
    applyTheme(event.target.value);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
