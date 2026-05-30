/*  CMP API handler */
/*  Detects Consent Management Platforms and dismisses them via their
    published JS API (more reliable than DOM-clicking selectors). Covers
    OneTrust, Cookiebot, Didomi, TrustArc, Usercentrics, Cookie-Script,
    Complianz, Klaro, Osano, iubenda, Cookie Information, consentmanager,
    and Tarteaucitron. Runs silently if no known CMP is present.

    Adapters are reject/deny-all where the API offers it (privacy-first).
    They only run on non-whitelisted tabs (the background never injects this
    handler on a whitelisted site), so re-applying a reject is always safe. */

(function () {
  // Each entry: name + a function that attempts a reject-all-style dismiss.
  // Each fn returns true on apparent success, false if API not ready/usable.
  const cmpAdapters = [
    {
      name: "OneTrust",
      try: () => {
        if (
          typeof window.OneTrust === "object" &&
          typeof window.OneTrust.RejectAll === "function"
        ) {
          window.OneTrust.RejectAll();
          return true;
        }
        if (
          typeof window.Optanon === "object" &&
          typeof window.Optanon.RejectAll === "function"
        ) {
          window.Optanon.RejectAll();
          return true;
        }
        return false;
      },
    },
    {
      name: "Cookiebot",
      try: () => {
        if (
          typeof window.Cookiebot === "object" &&
          typeof window.Cookiebot.decline === "function"
        ) {
          window.Cookiebot.decline();
          return true;
        }
        if (
          typeof window.CookieConsent === "object" &&
          typeof window.CookieConsent.decline === "function"
        ) {
          window.CookieConsent.decline();
          return true;
        }
        return false;
      },
    },
    {
      name: "Didomi",
      try: () => {
        if (
          typeof window.Didomi === "object" &&
          typeof window.Didomi.setUserDisagreeToAll === "function"
        ) {
          window.Didomi.setUserDisagreeToAll();
          return true;
        }
        return false;
      },
    },
    {
      name: "TrustArc",
      try: () => {
        if (
          typeof window.PrivacyManagerAPI === "object" &&
          typeof window.PrivacyManagerAPI.callApi === "function"
        ) {
          try {
            window.PrivacyManagerAPI.callApi("setConsentDecision", {
              decision: "NO_CONSENT",
            });
            return true;
          } catch {
            return false;
          }
        }
        return false;
      },
    },
    {
      name: "Usercentrics",
      try: () => {
        // Usercentrics Browser SDK (v2) exposes UC_UI once initialised.
        if (
          typeof window.UC_UI === "object" &&
          typeof window.UC_UI.denyAllConsents === "function" &&
          (typeof window.UC_UI.isInitialized !== "function" ||
            window.UC_UI.isInitialized())
        ) {
          window.UC_UI.denyAllConsents();
          return true;
        }
        return false;
      },
    },
    {
      name: "Cookie-Script",
      try: () => {
        if (
          typeof window.CookieScript === "object" &&
          window.CookieScript.instance &&
          typeof window.CookieScript.instance.reject === "function"
        ) {
          window.CookieScript.instance.reject();
          return true;
        }
        return false;
      },
    },
    {
      name: "Complianz",
      try: () => {
        // Complianz (WordPress) exposes a global deny-all helper.
        if (typeof window.cmplz_deny_all === "function") {
          window.cmplz_deny_all();
          return true;
        }
        return false;
      },
    },
    {
      name: "Klaro",
      try: () => {
        if (
          typeof window.klaro === "object" &&
          typeof window.klaro.getManager === "function"
        ) {
          const mgr = window.klaro.getManager();
          if (mgr && typeof mgr.changeAll === "function") {
            mgr.changeAll(false);
            if (typeof mgr.saveAndApplyConsents === "function") {
              mgr.saveAndApplyConsents();
            }
            return true;
          }
        }
        return false;
      },
    },
    {
      name: "Osano",
      try: () => {
        if (
          typeof window.Osano === "object" &&
          window.Osano.cm &&
          typeof window.Osano.cm.denyAll === "function"
        ) {
          window.Osano.cm.denyAll();
          return true;
        }
        return false;
      },
    },
    {
      name: "iubenda",
      try: () => {
        if (
          typeof window._iub === "object" &&
          window._iub.cs &&
          window._iub.cs.api &&
          typeof window._iub.cs.api.reject === "function"
        ) {
          window._iub.cs.api.reject();
          return true;
        }
        return false;
      },
    },
    {
      name: "CookieInformation",
      try: () => {
        if (
          typeof window.CookieInformation === "object" &&
          typeof window.CookieInformation.declineAllCategories === "function"
        ) {
          window.CookieInformation.declineAllCategories();
          return true;
        }
        return false;
      },
    },
    {
      name: "consentmanager",
      try: () => {
        // consentmanager.net stub. Guarded against the legacy TCF v1 __cmp,
        // which has a different signature — we only call when the
        // consentmanager-specific globals are present.
        if (
          typeof window.__cmp === "function" &&
          (typeof window.cmp_id !== "undefined" ||
            typeof window.cmpgvldata !== "undefined")
        ) {
          try {
            window.__cmp("setConsent", 0);
            return true;
          } catch {
            return false;
          }
        }
        return false;
      },
    },
    {
      name: "Tarteaucitron",
      try: () => {
        if (
          typeof window.tarteaucitron === "object" &&
          window.tarteaucitron.userInterface &&
          typeof window.tarteaucitron.userInterface.respondAll === "function"
        ) {
          window.tarteaucitron.userInterface.respondAll(false);
          return true;
        }
        return false;
      },
    },
    {
      name: "TCF-fallback",
      try: () => {
        // The IAB TCF v2 spec itself doesn't define "reject all", but most
        // TCF-compliant CMPs expose a vendor-specific helper exposed as
        // __tcfapi('postCustomConsent', ...) or hook through getTCData.
        // We don't blindly call non-standard methods; instead we just ping
        // the API so the CMP knows a consumer is interested, which some
        // implementations use as a signal to skip showing the banner.
        if (typeof window.__tcfapi !== "function") return false;
        try {
          window.__tcfapi("getTCData", 2, () => {});
          return false; // "ping only" — don't claim a successful dismiss
        } catch {
          return false;
        }
      },
    },
  ];

  function tryDismiss() {
    for (const adapter of cmpAdapters) {
      try {
        if (adapter.try()) {
          if (
            typeof chrome === "object" &&
            chrome.runtime &&
            typeof chrome.runtime.sendMessage === "function"
          ) {
            chrome.runtime.sendMessage({
              command: "cmp_dismissed",
              cmp: adapter.name,
              url: document.location.href,
            });
          }
          return true;
        }
      } catch {
        // adapters must not throw — but be defensive anyway
      }
    }
    return false;
  }

  // Immediate attempt for CMPs already initialised at document_end.
  if (tryDismiss()) return;

  // CMPs frequently inject themselves asynchronously. Retry on a short
  // schedule, plus react to DOM mutations (covers SPA route changes that
  // bring a fresh banner).
  let attempts = 0;
  const maxAttempts = 40; // ~10 s total with 250 ms steps
  const interval = setInterval(() => {
    attempts++;
    if (tryDismiss() || attempts >= maxAttempts) {
      clearInterval(interval);
    }
  }, 250);

  if (typeof MutationObserver === "function") {
    let pendingFrame = false;
    const observer = new MutationObserver(() => {
      if (pendingFrame) return;
      pendingFrame = true;
      requestAnimationFrame(() => {
        pendingFrame = false;
        if (tryDismiss()) observer.disconnect();
      });
    });
    try {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      // Stop watching after 30 s to bound CPU on stubborn sites.
      setTimeout(() => observer.disconnect(), 30000);
    } catch {
      // documentElement not available yet, or extension context torn down
    }
  }
})();
