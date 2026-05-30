# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Nine more CMP API adapters** in the consent-API handler: Usercentrics,
  Cookie-Script, Complianz, Klaro, Osano, iubenda, Cookie Information,
  consentmanager, and Tarteaucitron (up from 5 to 14). Each calls the
  vendor's documented reject/deny-all API — the most reliable dismissal
  method, covering thousands of sites each. Cookie-Script directly fixes
  `1a-immobilienmarkt.de`.
- **Heuristic text-based dismissal** for unknown / custom banners that no
  CMP adapter or selector list covers (e.g. the "Communice" CMS banner on
  `dasing.de`). The default handler now matches button labels against a
  multilingual accept/reject phrase set (en/de/fr/es/it/nl), but only when
  the button sits inside a banner-like, cookie-context ancestor
  (a modal dialog or fixed/sticky element whose text mentions
  cookies/consent). Reject is preferred over accept. Tightly constrained
  to avoid clicking legitimate page UI.
- **Scroll-lock restore**: after a heuristic dismissal, an
  `overflow:hidden` lock on `<html>`/`<body>` is released so the page
  scrolls again. Scoped to the heuristic path so legitimate modals are
  never unlocked.
- Site rule for `whereby.com`. The cookie banner is a custom-built
  Framer overlay (not OneTrust/Cookiebot/Didomi), so the CMP-API
  handler doesn't match. The rule hides the banner footer via
  `footer:has(a[href="/user/cookie-settings"])`. Requires `:has()`
  support (Chrome ≥ 105, Firefox ≥ 121); older browsers see the
  banner unchanged.

## [2.0.2]

AMO submission unblocker.

### Added

- `browser_specific_settings.gecko.data_collection_permissions` set to
  `{ "required": ["none"] }` in the Firefox manifest. Mozilla started
  requiring this field for AMO submissions in late 2024 — without it
  the upload fails with `The "data_collection_permissions" property is
missing.` Crumble collects nothing (no telemetry, no analytics; the
  anonymous-report API path was removed in 2.0.1, and the GitHub
  report flow is a user-initiated tab open), so `"none"` is the
  honest declaration. AMO surfaces this on the listing page so users
  can see at a glance what the extension does (and doesn't do) with
  their data.

## [2.0.1]

Post-2.0.0 cleanup pass. No new features; smaller, cleaner, less
externally-coupled extension.

### Removed

- **Anonymous-report flow.** The old upstream-API path
  (`api.istilldontcareaboutcookies.com`) is gone. Reports now flow only
  through GitHub — the Report button opens a pre-filled issue form in
  a new tab. ~50 lines out of `background.js`, the entire anon-report
  submenu out of the popup HTML/JS, and 18 obsolete locale keys
  removed from every `messages.json`.
- `crowdin.yml` deleted (orphan after the localization workflow was
  dropped in 2.0.0).

### Changed

- README install section reworded — Crumble is published via GitHub
  releases; only the Chrome Web Store and AMO listings remain pending.
- Backup filename: `idcac-backup-*.json` → `crumble-backup-*.json`.
- Brand-internal renames: debug log prefix `[idcac]` → `[crumble]`,
  CSS keyframe `idcac-spin` → `crumble-spin`. The functional
  `class="idcac"` marker used by content scripts to flag
  already-clicked elements is intentionally unchanged.
- `tools/README.md` project reference updated.
- Privacy Policy rewritten: the "Report feature" section now reflects
  that reports flow through GitHub directly; Crumble itself transmits
  nothing.
- `.github/workflows/block_rules.yml`: bumps
  `peter-evans/create-pull-request@v5` → `@v7` and adds the
  `contents: write` + `pull-requests: write` permissions the action
  needs to actually push a branch and open the PR.

## [2.0.0] — Crumble

Crumble is the rebranded successor to the upstream `I still don't care
about cookies` fork (`v1.1.9`). The 2.0 line is the first release under
the new identity, repo, and maintainer.

### Branding

- **Renamed** to **Crumble**. The `extensionName` is now "Crumble" across
  all 26 locales (it's a brand, not localised). The English
  `extensionDescription` reads "Skip cookie consent banners on almost
  every site you visit. Open-source, no telemetry." — translated for
  de/es/fr/it/pt/nl; other locales fall back to English at the manifest
  layer.
- **New extension ID** for Firefox: `crumble@mntxsn.github.io` (was
  `idcac-pub@guus.ninja`). The Chrome and AMO store listings are
  separate from the upstream listings.
- **New canonical repo**: <https://github.com/mntxsn/crumble>. All
  in-extension links (issue template, package.json metadata) updated.
- **New version line**: 2.0.0. A clean break from the upstream 1.x
  release history to signal: new identity, new architecture, new
  maintainer.
- **Logo**: the modernised flat-cookie icon introduced during the
  refactor is kept. SVG source at `src/icons/logo.svg`.

### Post-2.0.0 cleanup

- **Anonymous-report flow removed.** Crumble no longer posts to the
  upstream `api.istilldontcareaboutcookies.com` reporting backend; that
  dependency is gone. The only reporting path is now the GitHub issue
  form (opened pre-filled in a new tab from the popup's Report button).
  All related UI was removed: the `menu_report`, `menu_report_anon`,
  `menu_error`, and `menu_loading` sub-views; the issue-type selector;
  the notes textarea; the AbortController + fetch + retry/error logic
  in `background.js`. `reportWebsite` collapsed from ~80 lines to ~30.
  Locale keys related to anon report (`reportAnon*`, `reportNotes*`,
  `*IssueOption`, `*IssueDescription`, `menuLoadingText`,
  `genericError*`, `reportGithub`, `menuIdle`, `menuSupport`,
  `reportConfirm`) deleted from all 26 locale files. Privacy Policy
  updated accordingly.
- README install section reworded — Crumble is now published via
  GitHub releases; only the Chrome Web Store and AMO listings remain
  pending.
- Backup filename `idcac-backup-*.json` renamed to
  `crumble-backup-*.json`.
- `crowdin.yml` deleted (orphan after the localization workflow was
  dropped).
- Brand-internal renames: debug log prefix `[idcac]` → `[crumble]`,
  CSS keyframe `idcac-spin` → `crumble-spin`. The functional
  `class="idcac"` marker that content scripts use to flag
  already-clicked elements was intentionally NOT renamed — it's
  referenced by thousands of selectors in `common.css` and the
  per-vendor rules; renaming it has no user-visible benefit and high
  refactor risk.

### Pre-release polish (still 2.0.0)

- **Language now auto-detects on first install.** `settings.language`
  defaults to `"auto"` and a new `resolveLocale` helper maps the
  browser's UI language (e.g. `de-AT`, `zh-Hans-CN`) to the closest
  bundled locale, falling back to English. The Settings dropdown gains
  an explicit "Auto (match browser)" entry at the top; picking a
  specific language stays sticky as before. Mirrors the `theme: "auto"`
  behaviour.
- **Sponsor link**. Heart icon in the popup header and a Support card
  on the options page link to <https://github.com/sponsors/mntxsn>.
  README gains a sponsor badge. No nag screens, no auto-opening tabs —
  user-initiated only.
- New i18n keys: `optionLanguageAuto`, `popupSupport`, `supportHeading`,
  `supportLead`, `supportButton` (en + de translated; others fall back
  to English via the i18n loader).
- New unit tests cover `resolveLocale` for explicit settings, auto-detect,
  region-subtag stripping, the zh-\* family, and the "unknown locale →
  English" fallback. `npm test` now runs 29 tests.
- **Explicit toolchain & browser requirements**: `package.json` declares
  `engines.node >= 20`, `.nvmrc` pins the version, and the README has a
  Compatibility table calling out Firefox 113+ and Chromium 102+ as the
  supported floor.
- **Sync requirement spelled out** in the options page and the README.
  The toggle now carries a hint that Firefox Sync or Chrome Sync needs
  to be signed in on every device for the toggle to actually do
  anything — without that, settings stay on the local device. New
  `optionSyncHint` locale key (en + de translated; other locales fall
  back to English).

### Modernisation note

Crumble's 2.0 line was built by [mntxsn](https://github.com/mntxsn) in
collaboration with [Claude](https://www.anthropic.com/claude)
(Anthropic, Opus 4.7) across a multi-session refactor. Every change was
reviewed and committed locally before publishing. The full inventory of
bug fixes, robustness improvements, UI work, and architectural changes
that went into 2.0 follows below — these were drafted during the
final pre-release sprint.

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

- **Reload-after-toggle ignored the new whitelist state**: the
  `toggle_extension` message handler kicked off `toggleWhitelist`
  without awaiting it, so the popup's response (and the subsequent
  Reload click) could fire while `persistSettings` and
  `updateWhitelistRules` were still in flight. The reloaded page then
  ran with the pre-toggle whitelist state. The handler now awaits the
  full chain before responding; the popup's follow-up actions are
  correctly sequenced after the persistence completes.
- **Popup toggle button broken after a11y refactor**: the `hidden`
  attribute introduced by the a11y polish was being defeated by the
  popup's `.menu button { display: block }` rule (higher specificity
  than browser default `[hidden]`), so toggle/refresh/report buttons
  stayed visible after the script tried to hide them. A
  `[hidden] { display: none !important }` rule in `theme.css`
  restores the expected semantics.
- **`get_active_tab` corrupted the tab list**: the handler returned a
  reference to the cached tab entry and then overwrote `hostname` with
  the result of `getWhitelistedDomain` — which can be `false` during
  the toggle-roundtrip race window. Now shallow-copies before any
  override and only applies the override if a real domain matched.
  The bug existed for a long time but was masked because previously
  the popup hid the toggle button after the first click; the a11y
  refactor briefly unmasked it.
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

- **Dropped Manifest V2 support.** Now MV3 for both Firefox (≥ 113) and
  Chromium-derived browsers. `background.html` and the dev-only
  `hotreload.js` were removed, the `webRequest` permission was dropped
  (everything goes through declarativeNetRequest now), and ~150 lines
  of MV2/MV3 conditional code came out of `background.js`. The
  `webRequestBlocking` path is fully replaced by the pre-compiled DNR
  rules from `rules.json` (see `tools/generate-block-rules.js`). Firefox
  versions below 113 stay on the last MV2 release.
- **Per-browser MV3 manifest variants** (`src/manifest.chrome.json` and
  `src/manifest.firefox.json`). Chrome's MV3 parser only accepts
  `background.service_worker`; Firefox needs `background.scripts` until
  its service-worker pref is universally on by default. The build
  pipeline (and local-dev `cp`) picks the right one. `src/manifest.json`
  itself is a gitignored build artifact again.
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
