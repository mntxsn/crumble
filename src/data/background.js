import { blockUrls, commons, commonJSHandlers, rules } from "./rules.js";
// Vars
let initPromise = null;
let cachedRules = {};
let tabList = {};
const xmlTabs = {};
let lastDeclarativeNetRuleId = 1;
let settings = {
  statusIndicators: true,
  whitelistedDomains: {},
  debug: false,
};
const isManifestV3 = chrome.runtime.getManifest().manifest_version == 3;

const SYNC_FLAG_KEY = "syncSettings";
const DEFAULT_SETTINGS = {
  whitelistedDomains: {},
  statusIndicators: true,
  debug: false,
};

function debugLog(...args) {
  if (settings.debug) console.log("[idcac]", ...args);
}

function getSyncFlag() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [SYNC_FLAG_KEY]: false }, (data) => {
      resolve(Boolean(data[SYNC_FLAG_KEY]));
    });
  });
}

async function loadSettingsFromStorage() {
  const useSync = await getSyncFlag();
  const area = useSync ? chrome.storage.sync : chrome.storage.local;
  return new Promise((resolve) => {
    area.get({ settings: DEFAULT_SETTINGS }, ({ settings: stored }) => {
      if (chrome.runtime.lastError) {
        // sync may be unavailable (offline, throttled) — fall back to local.
        console.warn(
          "Settings read from",
          useSync ? "sync" : "local",
          "failed:",
          chrome.runtime.lastError
        );
        chrome.storage.local.get(
          { settings: DEFAULT_SETTINGS },
          ({ settings: fallback }) => {
            resolve({ ...DEFAULT_SETTINGS, ...fallback });
          }
        );
        return;
      }
      resolve({ ...DEFAULT_SETTINGS, ...stored });
    });
  });
}

// Badges
function setBadge(tabId, text) {
  const chromeAction = chrome?.browserAction ?? chrome?.action;

  if (!chromeAction || !settings.statusIndicators) return;
  if (typeof tabId !== "number" || tabId < 0) return;

  try {
    chromeAction.setBadgeText({ text: text || "", tabId });

    if (chromeAction.setBadgeBackgroundColor) {
      chromeAction.setBadgeBackgroundColor({ color: "#646464", tabId });
    }
  } catch {
    // Tab may have been closed between the lookup and the badge call.
  }
}

function setSuccessBadge(tabId) {
  setBadge(tabId, "✅");
}

function setDisabledBadge(tabId) {
  setBadge(tabId, "⛔");
}

// Common functions
function isHttpUrl(url) {
  return (
    typeof url === "string" &&
    (url.startsWith("http:") || url.startsWith("https:"))
  );
}

function getHostname(url, cleanup) {
  if (!isHttpUrl(url)) return null;
  try {
    const a = new URL(url);
    return cleanup
      ? a.hostname.replace(/^w{2,3}\d*\./i, "")
      : a.hostname;
  } catch {
    return null;
  }
}

// Whitelisting
async function updateSettings() {
  lastDeclarativeNetRuleId = 1;
  settings = await loadSettingsFromStorage();
  debugLog("settings reloaded", {
    whitelisted: Object.keys(settings.whitelistedDomains).length,
    statusIndicators: settings.statusIndicators,
    debug: settings.debug,
  });

  if (isManifestV3) {
    await updateWhitelistRules();
  }
}

async function updateWhitelistRules() {
  if (!isManifestV3) {
    console.warn("Called unsupported function");
    return;
  }
  const previousRules = (
    await chrome.declarativeNetRequest.getDynamicRules()
  ).map((v) => {
    return v.id;
  });
  const addRules = Object.entries(settings.whitelistedDomains)
    .filter((element) => element[1])
    .map((v) => {
      return {
        id: lastDeclarativeNetRuleId++,
        priority: 1,
        action: { type: "allow" },
        condition: {
          urlFilter: "*",
          resourceTypes: ["script", "stylesheet", "xmlhttprequest", "image"],
          initiatorDomains: [v[0]],
        },
      };
    });

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules,
    removeRuleIds: previousRules,
  });
}

function isWhitelisted(tab) {
  if (typeof settings.whitelistedDomains[tab.hostname] != "undefined") {
    return true;
  }

  for (const i in tab.host_levels) {
    if (typeof settings.whitelistedDomains[tab.host_levels[i]] != "undefined") {
      return true;
    }
  }

  return false;
}

function getWhitelistedDomain(tab) {
  if (typeof settings.whitelistedDomains[tab.hostname] != "undefined") {
    return tab.hostname;
  }

  for (const i in tab.host_levels) {
    if (typeof settings.whitelistedDomains[tab.host_levels[i]] != "undefined") {
      return tab.host_levels[i];
    }
  }

  return false;
}

async function persistSettings() {
  await new Promise((resolve) =>
    chrome.storage.local.set({ settings }, resolve)
  );
  if (await getSyncFlag()) {
    try {
      await new Promise((resolve, reject) => {
        chrome.storage.sync.set({ settings }, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve();
        });
      });
    } catch (err) {
      console.warn("Settings sync write failed:", err);
    }
  }
}

async function toggleWhitelist(tab) {
  if (!isHttpUrl(tab.url) || !tabList[tab.id]) {
    return;
  }

  const previousState = tabList[tab.id].whitelisted;
  if (previousState) {
    delete settings.whitelistedDomains[tabList[tab.id].hostname];
  } else {
    settings.whitelistedDomains[tabList[tab.id].hostname] = true;
  }

  debugLog(
    previousState ? "unwhitelist" : "whitelist",
    tabList[tab.id].hostname
  );

  await persistSettings();

  for (const i in tabList) {
    if (tabList[i].hostname == tabList[tab.id].hostname) {
      tabList[i].whitelisted = !previousState;
    }
  }
  if (isManifestV3) {
    await updateWhitelistRules();
  }
}

// Maintain tab list

function getPreparedTab(tab) {
  tab.hostname = null;
  tab.whitelisted = false;
  tab.host_levels = [];

  if (tab.url) {
    tab.hostname = getHostname(tab.url, true);

    if (tab.hostname) {
      const parts = tab.hostname.split(".");

      for (let i = parts.length; i >= 2; i--) {
        tab.host_levels.push(parts.slice(-1 * i).join("."));
      }

      tab.whitelisted = isWhitelisted(tab);
    }
  }

  return tab;
}

function onCreatedListener(tab) {
  tabList[tab.id] = getPreparedTab(tab);
}

function onUpdatedListener(tabId, changeInfo, tab) {
  if (changeInfo.status || changeInfo.url) {
    tabList[tab.id] = getPreparedTab(tab);
  }
}

function onRemovedListener(tabId) {
  delete tabList[tabId];
  delete xmlTabs[tabId];
}

async function recreateTabList(magic) {
  let results;
  if (isManifestV3) {
    results = await chrome.tabs.query({});
  } else {
    results = await new Promise((resolve, reject) => {
      chrome.tabs.query({}, (result) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(result);
      });
    });
  }

  // Build the new list off to the side, then swap in one assignment. Prevents
  // any concurrent reader (e.g. MV2 synchronous webRequest) from seeing an
  // empty map mid-rebuild.
  const newTabList = {};
  for (const tab of results) {
    newTabList[tab.id] = getPreparedTab(tab);
  }
  tabList = newTabList;

  if (magic) {
    for (const id in tabList) {
      doTheMagic(tabList[id].id);
    }
  }
}

chrome.tabs.onCreated.addListener(onCreatedListener);
chrome.tabs.onUpdated.addListener(onUpdatedListener);
chrome.tabs.onRemoved.addListener(onRemovedListener);

// Sync in-memory settings when storage is mutated externally. Triggers on:
// - local writes from the options page or `toggleWhitelist`
// - sync writes from another device (when sync is enabled)
// - the user toggling the sync flag itself.
chrome.storage.onChanged.addListener((changes, area) => {
  if (
    (area === "local" && (changes.settings || changes[SYNC_FLAG_KEY])) ||
    (area === "sync" && changes.settings)
  ) {
    updateSettings();
  }
});

// chrome.runtime.onStartup.addListener(async () => await initialize(true));
chrome.runtime.onInstalled.addListener(
  async () => await initialize(true, true)
);

// URL blocking

function blockUrlCallback(d) {
  // Cached request: find the appropriate tab
  // TODO: parse rules.json for this function.

  if (d.tabId == -1 && d.initiator) {
    const initiatorHostname = getHostname(d.initiator, true);
    for (const tabId in tabList) {
      if (tabList[tabId].hostname == initiatorHostname) {
        d.tabId = parseInt(tabId);
        break;
      }
    }
  }

  if (tabList[d.tabId]?.whitelisted ?? false) {
    setDisabledBadge(d.tabId);
    return { cancel: false };
  }

  if (tabList[d.tabId] && d.url) {
    const cleanURL = d.url.split("?")[0];

    // To shorten the checklist, many filters are grouped by keywords

    for (const group in blockUrls.common_groups) {
      if (d.url.indexOf(group) > -1) {
        const groupFilters = blockUrls.common_groups[group];

        for (const i in groupFilters) {
          if (
            (groupFilters[i].q && d.url.indexOf(groupFilters[i].r) > -1) ||
            (!groupFilters[i].q && cleanURL.indexOf(groupFilters[i].r) > -1)
          ) {
            // Check for exceptions

            if (groupFilters[i].e && tabList[d.tabId].host_levels.length > 0) {
              for (const level in tabList[d.tabId].host_levels) {
                for (const exception in groupFilters[i].e) {
                  if (
                    groupFilters[i].e[exception] ==
                    tabList[d.tabId].host_levels[level]
                  ) {
                    return { cancel: false };
                  }
                }
              }
            }
            setSuccessBadge(d.tabId);
            return { cancel: true };
          }
        }
      }
    }

    // Check ungrouped filters

    const groupFilters = blockUrls.common;

    for (const i in groupFilters) {
      if (
        (groupFilters[i].q && d.url.indexOf(groupFilters[i].r) > -1) ||
        (!groupFilters[i].q && cleanURL.indexOf(groupFilters[i].r) > -1)
      ) {
        // Check for exceptions

        if (groupFilters[i].e && tabList[d.tabId].host_levels.length > 0) {
          for (const level in tabList[d.tabId].host_levels) {
            for (const exception in groupFilters[i].e) {
              if (
                groupFilters[i].e[exception] ==
                tabList[d.tabId].host_levels[level]
              ) {
                return { cancel: false };
              }
            }
          }
        }
        setSuccessBadge(d.tabId);
        return { cancel: true };
      }
    }

    // Site specific filters

    if (d.tabId > -1 && tabList[d.tabId].host_levels.length > 0) {
      for (const level in tabList[d.tabId].host_levels) {
        if (blockUrls.specific[tabList[d.tabId].host_levels[level]]) {
          const specificRules =
            blockUrls.specific[tabList[d.tabId].host_levels[level]];

          for (const i in specificRules) {
            if (d.url.indexOf(specificRules[i]) > -1) {
              setSuccessBadge(d.tabId);
              return { cancel: true };
            }
          }
        }
      }
    }
  }

  return { cancel: false };
}
if (!isManifestV3) {
  chrome.webRequest.onBeforeRequest.addListener(
    blockUrlCallback,
    {
      urls: ["http://*/*", "https://*/*"],
      types: ["script", "stylesheet", "xmlhttprequest"],
    },
    ["blocking"]
  );

  chrome.webRequest.onHeadersReceived.addListener(
    function (d) {
      if (tabList[d.tabId]) {
        d.responseHeaders.forEach(function (h) {
          if (h.name == "Content-Type" || h.name == "content-type") {
            xmlTabs[d.tabId] = h.value.indexOf("/xml") > -1;
          }
        });
      }

      return { cancel: false };
    },
    { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] },
    ["blocking", "responseHeaders"]
  );
}
// Reporting

function reportWebsite(info, tab, anon, issueType, notes, callback) {
  const respond = (payload) => {
    if (typeof callback === "function") callback(payload);
  };

  if (!isHttpUrl(tab.url) || !tabList[tab.id]) {
    respond({ error: true });
    return;
  }

  const hostname = getHostname(tab.url);

  if (!hostname) {
    respond({ error: true });
    return;
  }

  if (tabList[tab.id].whitelisted) {
    chrome.notifications.create("report", {
      type: "basic",
      title: chrome.i18n.getMessage("reportSkippedTitle", hostname),
      message: chrome.i18n.getMessage("reportSkippedMessage"),
      iconUrl: "icons/48.png",
    });
    respond({ error: false });
    return;
  }
  if (!anon) {
    chrome.tabs.create({
      url: `https://github.com/OhMyGuus/I-Still-Dont-Care-About-Cookies/issues/new?assignees=OhMyGuus&labels=Website+request&template=website_request.yml&title=%5BREQ%5D%3A+${encodeURIComponent(
        hostname
      )}&url=${encodeURIComponent(hostname)}&version=${encodeURIComponent(
        chrome.runtime.getManifest().version
      )}&browser=${encodeURIComponent(getBrowserAndVersion())}`,
    });
    respond({ error: false });
  } else {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    fetch("https://api.istilldontcareaboutcookies.com/api/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        issueType,
        notes,
        url: hostname,
        browser: getBrowserAndVersion(),
        language:
          navigator.language || Intl.DateTimeFormat().resolvedOptions().locale,
        extensionVersion: chrome.runtime.getManifest().version,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((response) => {
        if (
          response &&
          !response.error &&
          !response.errors &&
          response.responseURL
        ) {
          chrome.tabs.create({
            url: response.responseURL,
          });
          respond({ error: false });
        } else {
          respond({ error: true });
        }
      })
      .catch((err) => {
        console.error("Report submission failed:", err);
        respond({ error: true });
      })
      .finally(() => clearTimeout(timeoutId));
  }
}

function getBrowserAndVersion() {
  const useragent = navigator.userAgent;
  if (useragent.includes("Firefox")) {
    const match = useragent.match(/Firefox\/([0-9]+[\S]+)/);
    if (match) return match[0].replace("/", " ");
  } else if (useragent.includes("Chrome")) {
    const brands = navigator.userAgentData?.brands;
    if (brands && brands.length > 2 && brands[1]) {
      const { brand, version } = brands[1];
      return brand + " " + version;
    }
  }
  return "Other";
}

// Adding custom CSS/JS

function activateDomain(hostname, tabId, frameId) {
  if (!(hostname in cachedRules)) {
    cachedRules[hostname] = rules[hostname] || null;
  }

  const cachedRule = cachedRules[hostname];

  if (!cachedRule) {
    return false;
  }

  let status = false;
  const matched = [];

  // cached_rule.s = Custom css for webpage
  // cached_rule.c = Common css for webpage
  // cached_rule.j = Common js  for webpage

  if (typeof cachedRule.s != "undefined") {
    insertCSS({ tabId, frameId: frameId || 0, css: cachedRule.s });
    status = true;
    matched.push("custom-css");
  }

  if (typeof cachedRule.c != "undefined") {
    insertCSS({ tabId, frameId: frameId || 0, css: commons[cachedRule.c] });
    status = true;
    matched.push(`common-css#${cachedRule.c}`);
  }

  if (typeof cachedRule.j != "undefined") {
    executeScript({
      tabId,
      frameId,
      file: `/data/js/${commonJSHandlers[cachedRule.j]}.js`,
    });
    status = true;
    matched.push(`handler#${commonJSHandlers[cachedRule.j]}`);
  }

  if (status) {
    setSuccessBadge(tabId);
    debugLog("rule fired", { host: hostname, tabId, matched });
  }

  return status;
}

function doTheMagic(tabId, frameId, anotherTry) {
  if (!tabList[tabId] || !isHttpUrl(tabList[tabId].url)) {
    return;
  }

  if (tabList[tabId].whitelisted) {
    setDisabledBadge(tabId);
    return;
  }

  // Common CSS rules
  insertCSS(
    { tabId, frameId: frameId || 0, file: "/data/css/common.css" },
    function () {
      // A failure? Retry.
      if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError);

        const currentTry = anotherTry || 1;

        if (currentTry == 10) {
          return;
        }
        if (currentTry > 5) {
          setTimeout(() => doTheMagic(tabId, frameId || 0, currentTry + 1));
        } else {
          doTheMagic(tabId, frameId || 0, currentTry + 1);
        }
        return;
      }

      // Try CMP APIs first — most reliable when the site uses a known
      // Consent Management Platform.
      executeScript({ tabId, frameId, file: "/data/js/tcfHandler.js" });

      // Common social embeds
      executeScript({ tabId, frameId, file: "/data/js/embedsHandler.js" });

      if (activateDomain(tabList[tabId].hostname, tabId, frameId || 0)) {
        return;
      }

      for (const level in tabList[tabId].host_levels) {
        if (
          activateDomain(tabList[tabId].host_levels[level], tabId, frameId || 0)
        ) {
          return true;
        }
      }

      // Common JS rules when custom rules don't exist
      debugLog("fallback to defaultClickHandler", {
        host: tabList[tabId].hostname,
        tabId,
      });
      executeScript({
        tabId,
        frameId,
        file: "/data/js/0_defaultClickHandler.js",
      });
    }
  );
}

chrome.webNavigation.onCommitted.addListener(async (tab) => {
  if (tab.frameId > 0) {
    return;
  }
  await initialize();

  tabList[tab.tabId] = getPreparedTab(tab);

  doTheMagic(tab.tabId);
});

chrome.webNavigation.onCompleted.addListener(async function (tab) {
  await initialize();
  if (tab.frameId > 0 && tab.url != "about:blank") {
    doTheMagic(tab.tabId, tab.frameId);
  }
});

// SPA route changes (Reddit, X, YouTube, etc.) don't fire onCommitted/onCompleted
// for the top frame. Keep tabList fresh so block decisions and whitelisting use
// the new hostname. We don't re-run doTheMagic — the content script's
// MutationObserver handles late banner injections on the same page.
chrome.webNavigation.onHistoryStateUpdated.addListener(async (tab) => {
  if (tab.frameId > 0) return;
  await initialize();
  tabList[tab.tabId] = getPreparedTab(tab);
  debugLog("history-state updated", { host: tabList[tab.tabId].hostname });
});

// Toolbar menu

chrome.runtime.onMessage.addListener((request, info, sendResponse) => {
  initialize().then(() => {
    let responseSend = false;
    if (typeof request == "object") {
      if (request.tabId && tabList[request.tabId]) {
        if (request.command == "get_active_tab") {
          const response = { tab: tabList[request.tabId] };

          if (response.tab.whitelisted) {
            response.tab.hostname = getWhitelistedDomain(
              tabList[request.tabId]
            );
          }
          sendResponse(response);
          responseSend = true;
        } else if (request.command == "toggle_extension") {
          toggleWhitelist(tabList[request.tabId]);
        } else if (request.command == "report_website") {
          reportWebsite(
            info,
            tabList[request.tabId],
            request.anon,
            request.issueType,
            request.notes,
            sendResponse
          );
          responseSend = true;
        } else if (request.command == "refresh_page") {
          chrome.tabs.reload(request.tabId);
        }
      } else {
        if (request.command == "open_options_page") {
          chrome.tabs.create({
            url: chrome.runtime.getURL("/data/options.html"),
          });
        } else if (request.command == "cmp_dismissed" && info.tab) {
          // tcfHandler reports CMP API dismissals — surface them via badge so
          // the user sees the extension acted even when no DOM click fired.
          debugLog("cmp dismissed via API", {
            cmp: request.cmp,
            tabId: info.tab.id,
            url: request.url,
          });
          setSuccessBadge(info.tab.id);
        }
      }
    } else if (request == "update_settings") {
      updateSettings();
    }
    if (!responseSend) {
      sendResponse();
    }
  });

  return true;
});

function insertCSS(injection, callback) {
  const { tabId, css, file, frameId } = injection;

  if (isManifestV3) {
    chrome.scripting.insertCSS(
      {
        target: { tabId: tabId, frameIds: [frameId || 0] },
        css: css,
        files: file ? [file] : undefined,
        origin: "USER",
      },
      callback
    );
  } else {
    chrome.tabs.insertCSS(
      tabId,
      {
        file,
        code: css,
        frameId: frameId || 0,
        runAt: xmlTabs[tabId] ? "document_idle" : "document_start",
        cssOrigin: "user",
      },
      callback
    );
  }
}

function executeScript(injection, callback) {
  const { tabId, func, file, frameId } = injection;
  if (isManifestV3) {
    // manifest v3
    chrome.scripting.executeScript(
      {
        target: { tabId, frameIds: [frameId || 0] },
        files: file ? [file] : undefined,
        func,
      },
      callback
    );
  } else {
    // manifest v2
    chrome.tabs.executeScript(
      tabId,
      {
        file,
        frameId: frameId || 0,
        code: func == undefined ? undefined : "(" + func.toString() + ")();",
        runAt: xmlTabs[tabId] ? "document_idle" : "document_end",
      },
      callback
    );
  }
}

async function loadCachedRules() {
  // TODO: Load cached rules for V3 to improve speed (Requires testing to see if this actually is faster for v3)
  cachedRules = {};
}

function initialize(force, magic) {
  // Dedup concurrent callers so we never run recreateTabList in parallel.
  // `force` bypasses the cache (used on install to guarantee a fresh start).
  if (initPromise && !force) return initPromise;

  initPromise = (async () => {
    loadCachedRules();
    await updateSettings();
    await recreateTabList(magic);
  })();

  // On failure, clear so the next caller can retry from scratch.
  initPromise.catch(() => {
    initPromise = null;
  });

  return initPromise;
}

initialize().catch((err) => console.error("Initialization failed:", err));
