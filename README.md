<div align="center">

<img src="src/icons/128.png" alt="Crumble" />

# Crumble

### Skip cookie consent banners on almost every site.

<a href="https://github.com/mntxsn/crumble/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/mntxsn/crumble.svg?logo=github&style=for-the-badge"></a>
<a href="https://github.com/mntxsn/crumble/releases"><img alt="Releases" src="https://img.shields.io/github/downloads/mntxsn/crumble/total?color=blue&label=downloads&style=for-the-badge"></a>
<a href="LICENSE"><img alt="License: GPL v3" src="https://img.shields.io/badge/License-GPLv3-blue.svg?style=for-the-badge"></a>
<a href="https://github.com/sponsors/mntxsn"><img alt="Sponsor on GitHub" src="https://img.shields.io/badge/Sponsor-mntxsn-ea4aaa?logo=github-sponsors&style=for-the-badge"></a>

</div>

## What it does

Cookie consent prompts have become unavoidable, intrusive, and rarely actually about your privacy. Crumble takes them off your screen:

- **Hides or auto-dismisses** cookie banners on thousands of sites.
- **Sets stored consent flags** so banners don't reappear when you come back.
- **Talks directly to the major Consent Management Platforms** (OneTrust, Cookiebot, Didomi, TrustArc, Quantcast Choice) via their published JS APIs — more reliable than clicking through DOM selectors.
- **Blocks known third-party consent SDKs** at the network layer where it's safe to do so.
- **Walks shadow DOM** to catch banners rendered inside web components, which most extensions miss.

No account, no tracking, no telemetry.

## Compatibility

| Browser                                 | Minimum version |
| --------------------------------------- | --------------- |
| Firefox                                 | 113             |
| Firefox for Android                     | 113             |
| Chrome / Edge / Brave / Opera / Vivaldi | 102             |

The minimum versions follow from `declarativeNetRequest`'s dynamic-rule support (Firefox 113+) and `declarativeNetRequestWithHostAccess` (Chromium 102+). Older Firefox versions can install the last Manifest V2 release from the upstream `I still don't care about cookies` project linked under [Origin & credits](#origin--credits).

## Install

Until the Chrome Web Store and Firefox Add-ons listings are live, install Crumble manually from the latest GitHub release:

[Latest release →](https://github.com/mntxsn/crumble/releases/latest)

- **Firefox**: download `crumble.xpi` (or `latest.xpi` once signed) from the release page and drop it on `about:addons`.
- **Chromium-based browsers**: download `crumble-chrome-source.zip`, unzip, then load the folder via `chrome://extensions` → _Developer mode_ → _Load unpacked_.

Store badges will appear here once the listings are published.

## Features

- **Per-domain whitelist** — disable Crumble on individual sites via the toolbar popup
- **Backup** — download or restore your whitelist as JSON from the options page
- **Sync** (opt-in) — mirror your whitelist across devices via browser sync. Requires you to be signed into Firefox Sync or Chrome Sync; without an account, settings stay on the device.
- **Themes** — auto / light / dark
- **Languages** — 26 locales bundled, auto-detected from your browser (English as fallback)
- **Keyboard shortcut** — `Alt+Shift+C` to toggle the current site (rebindable)
- **Debug mode** (opt-in) — see which rule fired on the current site in the background console
- **Status badges** — green check (✅) when Crumble acted, grey ⛔ when whitelisted

## When a site still shows a banner

1. Make sure no other privacy or ad-blocker extension is interfering.
2. Try the page in a clean profile — broken sites are sometimes broken by unrelated extensions.
3. If it really is us, use the **Report** button in the popup:
   - **GitHub** opens a pre-filled issue template.
   - **Anonymous** sends a short report to a small reporting API (no personal data).

## Development

```bash
git clone https://github.com/mntxsn/crumble.git
cd crumble
npm install
```

The repo ships two MV3 manifest variants because Chrome and Firefox disagree on the `background` block (Chrome only accepts `service_worker`; Firefox needs `scripts` until its service-worker pref is universally on). For local testing copy the matching variant:

```bash
# Firefox
cp src/manifest.firefox.json src/manifest.json

# Chrome / Edge / Brave
cp src/manifest.chrome.json src/manifest.json
```

Then load `src/` as a temporary extension (`about:debugging` in Firefox, `chrome://extensions` in Chromium browsers).

### Daily commands

```bash
npm test                       # unit tests (Node's built-in runner, no extra deps)
npm run lint                   # ESLint
npm run prettier-check         # Prettier verification
npm run add-rule -- --domain example.com --css "…"
npm run generate-block-rules   # regenerate src/rules.json from rules.js
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contributor's guide.

## Translation

26 locales are bundled. The English message file is the source of truth; missing keys in other locales fall back to English at runtime via the i18n loader (`src/data/js/i18n.js`). Translation PRs against individual `src/_locales/<lang>/messages.json` files are welcome.

## Support

If Crumble saves you time, you can [sponsor the project on GitHub](https://github.com/sponsors/mntxsn). Sponsorship keeps the project independent and the rules current.

## License

GPL-3.0 — see [LICENSE](LICENSE).

## Origin & credits

Crumble started life as a fork of the abandoned `I still don't care about cookies` extension (which was itself a fork of Daniel Kladnik's original `I don't care about cookies`, sold to Avast in 2022). Most of the per-site rule data and the original architecture come from years of patient cataloguing in those projects — Daniel and every contributor who reported a banner along the way deserve the credit for that.

Crumble's 2.0 line adds:

- Manifest V3 only, single canonical codebase
- Modernised popup and options UI with dark mode
- IAB TCF and per-vendor CMP API integration (OneTrust, Cookiebot, Didomi, TrustArc)
- Shadow-DOM-aware querying in the default click handler
- MutationObserver-driven banner detection (replaces 250 ms polling)
- 26-language opt-in language selector independent of browser locale
- Whitelist sync + JSON import/export backup
- Unit tests and CI gates on every PR

Modernisation done with one developer across a multi-session refactor pass; every change reviewed and committed locally before publish.

- Original author: [Daniel Kladnik](https://www.linkedin.com/in/dkladnik)
- Upstream fork maintainer: [OhMyGuus](https://github.com/OhMyGuus/)
- Crumble maintainer: [mntxsn](https://github.com/mntxsn)

A full list of upstream contributors is preserved at the original fork: [I-Still-Dont-Care-About-Cookies contributors](https://github.com/OhMyGuus/I-Still-Dont-Care-About-Cookies/graphs/contributors).
