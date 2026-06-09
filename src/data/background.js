import { commons, commonJSHandlers, rules } from "./rules.js";
import { isHttpUrl, getHostname } from "./js/utils.js";

// Vars
let initPromise = null;
let cachedRules = {};
let tabList = {};
let lastDeclarativeNetRuleId = 1;
let settings = {
  statusIndicators: true,
  whitelistedDomains: {},
  debug: false,
};

// Domains where the user clicked "show banner once" in the popup. Maps
// domain → expiry timestamp. Short-lived and in-memory only: if the service
// worker dies, the next updateSettings() prunes/rebuilds everything, so a
// stale pause can never stick around.
const pausedDomains = {};
const PAUSE_DURATION_MS = 90000;

const COMMON_CSS_SCRIPT_ID = "crumble-common-css";

const SYNC_FLAG_KEY = "syncSettings";
const DEFAULT_SETTINGS = {
  whitelistedDomains: {},
  statusIndicators: true,
  debug: false,
};

function debugLog(...args) {
  if (settings.debug) console.log("[crumble]", ...args);
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
  if (!settings.statusIndicators) return;
  if (typeof tabId !== "number" || tabId < 0) return;

  try {
    chrome.action.setBadgeText({ text: text || "", tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#646464", tabId });
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

// Whitelisting
async function updateSettings() {
  settings = await loadSettingsFromStorage();
  debugLog("settings reloaded", {
    whitelisted: Object.keys(settings.whitelistedDomains).length,
    statusIndicators: settings.statusIndicators,
    debug: settings.debug,
  });
  await updateWhitelistRules();
  await updateCssRegistration();
}

// Whitelisted domains + still-active "show banner once" pauses. Expired
// pauses are pruned as a side effect.
function getAllowedDomains() {
  const now = Date.now();
  const domains = new Set(
    Object.entries(settings.whitelistedDomains)
      .filter(([, enabled]) => enabled)
      .map(([domain]) => domain)
  );
  for (const [domain, expiry] of Object.entries(pausedDomains)) {
    if (expiry > now) domains.add(domain);
    else delete pausedDomains[domain];
  }
  return domains;
}

async function updateWhitelistRules() {
  lastDeclarativeNetRuleId = 1;
  const previousRules = (
    await chrome.declarativeNetRequest.getDynamicRules()
  ).map((v) => v.id);

  const addRules = [...getAllowedDomains()].map((domain) => ({
    id: lastDeclarativeNetRuleId++,
    priority: 1,
    action: { type: "allow" },
    condition: {
      urlFilter: "*",
      resourceTypes: ["script", "stylesheet", "xmlhttprequest", "image"],
      initiatorDomains: [domain],
    },
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules,
    removeRuleIds: previousRules,
  });
}

// Register common.css as a declarative content script at document_start.
// The browser applies it before first paint — no service-worker round trip,
// which eliminates the banner flash that programmatic insertCSS (triggered
// from webNavigation events) can't avoid on cold starts. Whitelisted and
// paused domains are carved out via excludeMatches.
async function updateCssRegistration() {
  if (
    !chrome.scripting ||
    typeof chrome.scripting.registerContentScripts !== "function"
  ) {
    return;
  }

  const excludeMatches = [];
  for (const domain of getAllowedDomains()) {
    // Guard against entries that would invalidate the whole registration.
    if (!/^[a-z0-9.-]+$/i.test(domain)) continue;
    excludeMatches.push(`*://${domain}/*`, `*://*.${domain}/*`);
  }

  const script = {
    id: COMMON_CSS_SCRIPT_ID,
    css: ["data/css/common.css"],
    matches: ["http://*/*", "https://*/*"],
    runAt: "document_start",
    allFrames: true,
    persistAcrossSessions: true,
  };
  if (excludeMatches.length) {
    script.excludeMatches = excludeMatches;
  }

  try {
    // Unregister + register instead of update: update keeps properties that
    // aren't specified, so a previously-set excludeMatches could never be
    // cleared again.
    try {
      await chrome.scripting.unregisterContentScripts({
        ids: [COMMON_CSS_SCRIPT_ID],
      });
    } catch {
      // not registered yet — fine
    }
    await chrome.scripting.registerContentScripts([script]);
  } catch (err) {
    console.warn("Common CSS registration failed:", err);
  }
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
  await updateWhitelistRules();
}

// "Show banner once": pause Crumble for this tab's domain for a short window
// (CSS exclude + DNR allow + skip in doTheMagic), then reload the tab so the
// site's own consent banner can render and the user can interact with it.
// The pause expires on its own — no manual re-enable needed. Sites that only
// work after a real consent interaction (videos, embeds, logins) are the
// target use case.
async function pauseOnce(tabId) {
  const tab = tabList[tabId];
  if (!tab || !tab.hostname) return;

  pausedDomains[tab.hostname] = Date.now() + PAUSE_DURATION_MS;
  debugLog("pause once", tab.hostname);

  await updateWhitelistRules();
  await updateCssRegistration();
  chrome.tabs.reload(tabId);

  // Re-arm after expiry. If the service worker dies first, the next
  // updateSettings() prunes the expired entry and rebuilds both rule sets.
  setTimeout(async () => {
    if (pausedDomains[tab.hostname] <= Date.now()) {
      delete pausedDomains[tab.hostname];
      try {
        await updateWhitelistRules();
        await updateCssRegistration();
      } catch (err) {
        console.warn("Pause expiry cleanup failed:", err);
      }
    }
  }, PAUSE_DURATION_MS + 1000);
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
}

async function recreateTabList(magic) {
  const results = await chrome.tabs.query({});

  // Build the new list off to the side, then swap in one assignment so a
  // concurrent reader never sees an empty map mid-rebuild.
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

chrome.runtime.onInstalled.addListener(
  async () => await initialize(true, true)
);

// Keyboard shortcut: toggle whitelist for the active tab.
if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command !== "toggle-whitelist") return;
    await initialize();
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (activeTab && tabList[activeTab.id]) {
      await toggleWhitelist(tabList[activeTab.id]);
    }
  });
}

// Reporting

function reportWebsite(info, tab, callback) {
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

  // Open the pre-filled GitHub issue form. This is the only reporting path —
  // the anonymous-API flow was removed before the 2.0.0 standalone release
  // to drop the dependency on the upstream reporting backend.
  chrome.tabs.create({
    url: `https://github.com/mntxsn/crumble/issues/new?labels=Website+request&template=website_request.yml&title=%5BREQ%5D%3A+${encodeURIComponent(
      hostname
    )}&url=${encodeURIComponent(hostname)}&version=${encodeURIComponent(
      chrome.runtime.getManifest().version
    )}&browser=${encodeURIComponent(getBrowserAndVersion())}`,
  });
  respond({ error: false });
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

  // cachedRule.s = Custom css for webpage
  // cachedRule.c = Common css for webpage
  // cachedRule.j = Common js  for webpage

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

// "Show banner once" check: true while the tab's domain has an active pause.
function isPausedTab(tab) {
  if (!tab) return false;
  const now = Date.now();
  if (tab.hostname && pausedDomains[tab.hostname] > now) return true;
  for (const level of tab.host_levels || []) {
    if (pausedDomains[level] > now) return true;
  }
  return false;
}

function doTheMagic(tabId, frameId, anotherTry) {
  if (!tabList[tabId] || !isHttpUrl(tabList[tabId].url)) {
    return;
  }

  if (tabList[tabId].whitelisted) {
    setDisabledBadge(tabId);
    return;
  }

  if (isPausedTab(tabList[tabId])) {
    setBadge(tabId, "⏸");
    return;
  }

  // Common CSS rules
  insertCSS(
    { tabId, frameId: frameId || 0, file: "/data/css/common.css" },
    function () {
      // A failure? Retry.
      if (chrome.runtime.lastError) {
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
          // Shallow-copy the tab so we don't accidentally mutate tabList when
          // overriding hostname. The previous reference-based version could
          // assign a `false` from getWhitelistedDomain back onto tabList,
          // permanently corrupting the entry.
          const stored = tabList[request.tabId];
          const response = { tab: { ...stored } };

          if (response.tab.whitelisted) {
            const matched = getWhitelistedDomain(stored);
            if (matched) response.tab.hostname = matched;
          }
          sendResponse(response);
          responseSend = true;
        } else if (request.command == "toggle_extension") {
          // Wait for the whitelist write + DNR rule update to complete
          // before responding. Otherwise the popup's follow-up actions
          // (especially a Reload click) can fire while persistSettings or
          // updateWhitelistRules is still in flight, and the reloaded page
          // then runs with the previous whitelist state.
          responseSend = true;
          toggleWhitelist(tabList[request.tabId])
            .catch((err) => console.error("Toggle failed:", err))
            .finally(() => sendResponse());
        } else if (request.command == "report_website") {
          reportWebsite(info, tabList[request.tabId], sendResponse);
          responseSend = true;
        } else if (request.command == "pause_once") {
          // "Show banner once" — pause for this domain, reload, auto-expire.
          responseSend = true;
          pauseOnce(request.tabId)
            .catch((err) => console.error("Pause failed:", err))
            .finally(() => sendResponse());
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
  chrome.scripting.insertCSS(
    {
      target: { tabId, frameIds: [frameId || 0] },
      css,
      files: file ? [file] : undefined,
      origin: "USER",
    },
    callback
  );
}

function executeScript(injection, callback) {
  const { tabId, func, file, frameId } = injection;
  chrome.scripting.executeScript(
    {
      target: { tabId, frameIds: [frameId || 0] },
      files: file ? [file] : undefined,
      func,
    },
    callback
  );
}

function loadCachedRules() {
  // TODO: Load cached rules to improve speed (requires testing to confirm
  // the parsed-cache is actually faster than re-evaluating rules.js).
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
