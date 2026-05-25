# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Whitelist backup**: the options page now offers JSON export and import
  buttons. Imports merge with the existing whitelist (non-destructive).
- **Debug logging**: optional setting that surfaces rule activations, fallback
  decisions, and whitelist toggles in the background console. Off by default.
- **Sync settings** (opt-in): mirrors settings via `chrome.storage.sync` for
  cross-device whitelist persistence. `local` remains the canonical store and
  a safety net — if a sync write fails (quota, offline) the local copy is
  still authoritative.
- **CMP API handler** (`tcfHandler.js`): proactively dismisses consent prompts
  from OneTrust, Cookiebot, Didomi, TrustArc, and Quantcast Choice using each
  vendor's documented JS API. Runs before the selector-based fallbacks, so a
  successful API call avoids the click race entirely.
- **MutationObserver in the default click handler**: instead of polling every
  250 ms, the handler now reacts to DOM mutations. Late-loading banners
  (asynchronous CMP injects, SPA route changes) are caught reliably.
- **SPA navigation tracking**: `webNavigation.onHistoryStateUpdated` keeps the
  tab list fresh after client-side navigations (Reddit, X, YouTube, etc.) so
  block decisions and badge state stay accurate.
- New i18n strings (English only — translations welcome via Crowdin):
  `optionDebug`, `optionSync`, `optionTheme`, `optionThemeAuto`,
  `optionThemeLight`, `optionThemeDark`, `optionsGeneralSection`,
  `optionsWhitelistSection`, `optionsBackupSection`, `optionsWhitelistHint`,
  `optionsBackupHint`, `optionsExport`, `optionsImport`, `optionsImportSuccess`,
  `optionsImportError`, `optionsSaved`.
- **Modernised popup and options UI**: new shared design tokens
  (`src/data/css/theme.css`), card-based options layout, system font stack,
  proper focus rings, button semantics, and a CSS-only loading spinner.
- **Modernised extension icon**: flat cookie with cleaner colour palette,
  evenly placed chocolate chips, and a green check badge that signals the
  banner has been handled. SVG source kept at `src/icons/logo.svg` so the
  PNGs can be regenerated at any size.
- **Dark mode**: theme selector in settings with three modes — _Match system_
  (default, follows `prefers-color-scheme`), _Light_, _Dark_. Applied to both
  the popup and the options page.
- **User-selectable language** (`settings.language`, default: English):
  the popup and the options page now load locale messages themselves rather
  than relying on the browser's locale-resolution. The setting offers all 26
  locales shipped in `src/_locales`, displayed in their own language for
  recognisability. A new shared module (`src/data/js/i18n.js`) handles loading
  with English fallback for keys that haven't been translated yet.
- German (`de`) translations for all newly introduced settings strings
  (theme, language, debug, sync, backup, section headings, status messages).

### Fixed

- Issue-report links pointed at the abandoned upstream repo
  (`I-Dont-Care-About-Cookies`). Both the in-extension GitHub link and the
  `package.json` metadata now reference this repo, so the issue template
  actually loads.
- `reportWebsite` invoked its callback in only one of five code paths,
  leaving the popup stuck on the GitHub report flow and on early-return
  errors. The callback is now always invoked.
- Reporting had no timeout or HTTP-status check: a hanging or 5xx-returning
  API would lock the popup. Now uses `AbortController` (15 s) and rejects
  non-2xx responses with a logged error.
- The Google handler's ramp-up delay (`setInterval(..., 250 + counter * 10)`)
  was evaluated once at registration, so it stayed at 250 ms forever.
  Replaced with a recursive `setTimeout` that re-evaluates per tick.
- `hotreload.js` crashed on load by calling `chrome.management.getSelf`
  without the `management` permission and `chrome.runtime.getPackageDirectoryEntry`
  in MV3 service workers. Now silently no-ops when those APIs are unavailable.
- The cookie handler wrote consent cookies without `path=/`, scoping them
  to the current directory. Now sets `path=/; max-age=31536000; SameSite=Lax`.
- Session- and local-storage handlers had no try/catch and broke in private
  browsing and on storage-quota errors. Both are now wrapped.
- `getHostname` returned `false` on errors while consumers expected a string,
  yielding silent `false.length` mis-checks. Now returns `null`; all four
  `indexOf("http") != 0` call sites use a shared `isHttpUrl` helper.
- `activateDomain` had a dead branch: it cached `{}` for unknown hosts and
  then never short-circuited. Now caches `null` and returns early.
- `blockUrlCallback` re-computed `getHostname(d.initiator, true)` inside its
  inner loop instead of hoisting it once.
- `updateWhitelistRules` was not awaited inside `updateSettings`, so the
  promise resolved before the dynamic rules were applied.
- `initialize()` was not deduplicated: concurrent callers (`onCommitted`,
  `onCompleted`, `onMessage`) each ran `recreateTabList`, briefly emptying
  `tabList` and dropping in-flight block decisions in MV2. Now a singleton
  promise; `recreateTabList` builds the new list off to the side and swaps
  atomically.
- `onUpdated` only re-prepared tabs on status changes; SPA URL changes
  (`changeInfo.url`) left a stale hostname. Both are now handled.
- `setBadge` could throw on closed-tab tab IDs; now guarded with a tab-id
  check and a try/catch.
- `refresh_page` injected a script to call `location.reload()`. Replaced
  with `chrome.tabs.reload`.
- The background had no `storage.onChanged` listener, so settings changes
  from any surface other than the explicit `update_settings` message went
  unnoticed. Now listens on both `local` and `sync` areas.
- `xmlTabs` was never cleaned up on tab close (minor MV2 leak).
- An inner `const rules` shadowed the module-level import inside
  `blockUrlCallback`.
- The initial `initialize()` at module load now has a `.catch` so failures
  are surfaced rather than silently dropped.
- `embedsHandler.js` random class name could be empty when `Math.random()`
  returned a digits-only base-36 string. Falls back to `"idcac"`.
- `getBrowserAndVersion` no longer crashes in Firefox (where
  `navigator.userAgentData` is undefined) or on older Chromium builds where
  `brands` has fewer than two entries.

### Changed

- `package.json` `repository`, `bugs`, and `homepage` now point at
  `I-Still-Dont-Care-About-Cookies`.
- Options page layout: settings split into a main section and a Backup
  section; debug and sync toggles inline with the existing status-indicators
  toggle.
- `README.md` rewritten to lead with what the extension does. The fork
  origin and upstream history are acknowledged in the Credits section.
- Removed two unconditional `console.log("Timeout for element click:", …)`
  calls from `0_defaultClickHandler.js` that fired on every dismissal.
  Diagnostic noise is now opt-in via the debug-mode toggle.
- Removed `src/data/menu/spinner.svg` (replaced by the CSS-only spinner).
- Removed the obsolete `gecko_android.id` field from `manifest_v2.json` —
  the field isn't allowed there and triggered a Firefox manifest warning
  on every load. The extension ID continues to come from `gecko.id`.

