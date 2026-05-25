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
- **Shadow-DOM-aware querying** in the default click handler. Many modern
  CMPs (Cookiebot v3, Usercentrics, vendor-specific banners) render their
  UI inside open shadow roots — `document.querySelectorAll` doesn't see
  them. A new `queryAllDeep` walker recursively descends through every
  reachable shadow root before running the selector, catching banners
  that previously stayed visible. Closed shadow roots remain invisible
  (by spec).
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
  evenly placed chocolate chips, and a kept bite mark for character. The
  three crumbs from the original are gone. SVG source lives at
  `src/icons/logo.svg` so the PNGs can be regenerated at any size.
- **Keyboard shortcut**: `Alt+Shift+C` (rebindable via the browser's
  shortcut UI) toggles the whitelist for the current tab — same effect as
  the popup's Disable/Enable button, but doesn't require a click.
- **Popup accessibility**: the toggle button now exposes its dynamic text
  to screen readers via `aria-live="polite"`. Hidden buttons use the
  `hidden` attribute instead of inline `display: none`, so keyboard
  navigation skips them correctly.
- **Dark mode**: theme selector in settings with three modes — _Match system_
  (default, follows `prefers-color-scheme`), _Light_, _Dark_. Applied to both
  the popup and the options page.
- **Unit tests** for the pure helpers (`isHttpUrl`, `getHostname`,
  `parseWhitelistInput`, `applyPlaceholders`, locale registry) via Node's
  built-in test runner. `npm test` is the entry point — 23 tests, no extra
  dependency.
- **`src/data/js/utils.js`**: shared pure-helper module imported by both
  `background.js` and `options.js`. Lets the helpers be unit-tested in
  plain Node without mocking `chrome.*`.
- **Consolidated CI workflow** (`.github/workflows/ci.yml`): one Action runs
  ESLint, Prettier check, and the unit tests on every PR + push to master.
  Replaces the older `linter.yml` and `prettier.yml` (the latter abused
  `prettier --write` plus a `git diff` check; the new flow uses the
  canonical `prettier --check`).
- **User-selectable language** (`settings.language`, default: English):
  the popup and the options page now load locale messages themselves rather
  than relying on the browser's locale-resolution. The setting offers all 26
  locales shipped in `src/_locales`, displayed in their own language for
  recognisability. A new shared module (`src/data/js/i18n.js`) handles loading
  with English fallback for keys that haven't been translated yet.
- German (`de`) translations for all newly introduced settings strings
  (theme, language, debug, sync, backup, section headings, status messages).
- Spanish, French, Italian, Portuguese, and Dutch (`es`, `fr`, `it`, `pt`,
  `nl`) translations for the same set of new settings strings (~19 keys
  each). Remaining 20 locales still fall back to English at runtime;
  contributions welcome via Crowdin or PR.
- **`CONTRIBUTING.md`**: practical contributor guide covering project
  layout, daily commands, rule format, the `npm run add-rule` workflow,
  localisation flow, test/CI conventions, and commit style.

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

- **Dropped Manifest V2 support.** Single Manifest V3 manifest now works on
  both Firefox (≥ 113) and Chromium-derived browsers. The `manifest_v2.json`
  / `manifest_v3.json` split is gone; the canonical file is
  `src/manifest.json`. `background.html` and the dev-only `hotreload.js`
  were removed, the `webRequest` permission was dropped (everything goes
  through declarativeNetRequest now), and ~150 lines of MV2/MV3
  conditional code came out of `background.js`. The `webRequestBlocking`
  path is fully replaced by the pre-compiled DNR rules from `rules.json`
  (see `tools/generate-block-rules.js`). Build & release workflows
  simplified accordingly. Firefox versions below 113 stay on the last MV2
  release.
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

