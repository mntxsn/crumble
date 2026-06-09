import { buildTranslator, resolveLocale } from "../js/i18n.js";

const SYNC_FLAG_KEY = "syncSettings";

// Live translator — assigned after the user's preferred locale is loaded.
// Until then, t() returns the key so untranslated UI shows the message name
// instead of empty strings (helps diagnosing broken loads).
let t = (key) => key;

// Read the user's theme + language settings as early as possible so the popup
// doesn't paint with the wrong colours or English placeholders longer than
// strictly necessary.
function readSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [SYNC_FLAG_KEY]: false }, (data) => {
      const area = data[SYNC_FLAG_KEY]
        ? chrome.storage.sync
        : chrome.storage.local;
      area.get(
        { settings: { theme: "auto", language: "auto" } },
        ({ settings }) => {
          resolve(settings || {});
        }
      );
    });
  });
}

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

const toggle = document.getElementById("toggle");
const pause = document.getElementById("pause");
const refresh = document.getElementById("refresh");
const report = document.getElementById("report");
const options = document.getElementById("options");

let currentTab = false;

toggle.addEventListener("click", function () {
  chrome.runtime.sendMessage(
    {
      command: "toggle_extension",
      tabId: currentTab.id,
    },
    () => reloadMenu(true)
  );
});

refresh.addEventListener("click", function () {
  chrome.runtime.sendMessage(
    {
      command: "refresh_page",
      tabId: currentTab.id,
    },
    () => window.close()
  );
});

options.addEventListener("click", function () {
  chrome.runtime.sendMessage(
    {
      command: "open_options_page",
    },
    () => window.close()
  );
});

// "Show banner once": pauses Crumble on this domain for ~90 s and reloads,
// so the site's own consent banner can be interacted with. Auto-expires —
// no need to toggle anything back.
pause.addEventListener("click", function () {
  chrome.runtime.sendMessage(
    {
      command: "pause_once",
      tabId: currentTab.id,
    },
    () => window.close()
  );
});

// Reporting is now GitHub-only — the anonymous-API path was dropped in 2.0.0.
// Clicking Report opens a pre-filled issue form in a new tab and closes the
// popup.
report.addEventListener("click", () =>
  chrome.runtime.sendMessage(
    {
      command: "report_website",
      tabId: currentTab.id,
    },
    () => window.close()
  )
);

function reloadMenu(enableRefreshButton) {
  translate();
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.runtime.sendMessage(
      {
        command: "get_active_tab",
        tabId: tabs[0].id,
      },
      function (message) {
        message = message || {};
        currentTab = message.tab ? message.tab : false;

        if (message.tab && message.tab.hostname) {
          toggle.textContent = t(
            message.tab.whitelisted ? "menuEnable" : "menuDisable",
            message.tab.hostname
          );
          toggle.hidden = false;
          report.hidden = Boolean(message.tab.whitelisted);
          pause.hidden = Boolean(message.tab.whitelisted);
        } else {
          toggle.textContent = "";
          toggle.hidden = true;
          report.hidden = true;
          pause.hidden = true;
        }

        if (typeof enableRefreshButton != "undefined") {
          refresh.hidden = false;
          toggle.hidden = true;
          report.hidden = true;
          pause.hidden = true;
        }
      }
    );
  });
}

function translate() {
  for (const element of document.querySelectorAll("[data-translate]")) {
    element.textContent = t(element.dataset.translate);
  }
  for (const element of document.querySelectorAll("[data-translate-title]")) {
    element.setAttribute("title", t(element.dataset.translateTitle));
  }
  for (const element of document.querySelectorAll(
    "[data-translate-aria-label]"
  )) {
    element.setAttribute("aria-label", t(element.dataset.translateAriaLabel));
  }
}

async function bootstrap() {
  const settings = await readSettings();
  applyTheme(settings.theme || "auto");

  const lang = resolveLocale(settings.language);
  document.documentElement.lang = lang.replace("_", "-");

  const translator = await buildTranslator(lang);
  t = translator.t;

  reloadMenu();
}

bootstrap();
