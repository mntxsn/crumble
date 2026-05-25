/*  CMP API handler */
/*  Detects major Consent Management Platforms and dismisses them via their
    published JS API (more reliable than DOM-clicking selectors). Runs
    silently if no known CMP is present. */

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
