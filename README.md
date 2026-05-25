<div align="center">

<img src="src/icons/128.png" alt="" />

# I still don't care about cookies

### Get rid of cookie warnings on almost every website.

<a href="https://github.com/OhMyGuus/I-Still-Dont-Care-About-Cookies/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/OhMyGuus/I-Still-Dont-Care-About-Cookies.svg?logo=github&style=for-the-badge"></a>
<a href="https://github.com/OhMyGuus/I-Still-Dont-Care-About-Cookies/releases"><img alt="Releases" src="https://img.shields.io/github/downloads/OhMyGuus/I-Still-Dont-Care-About-Cookies/total?color=blue&label=downloads&style=for-the-badge"></a>
<a href="LICENSE"><img alt="License: GPL v3" src="https://img.shields.io/badge/License-GPLv3-blue.svg?style=for-the-badge"></a>

</div>

## What it does

Cookie consent prompts have become unavoidable, intrusive, and rarely actually about your privacy. This extension takes them off your screen:

- **Hides or auto-dismisses** cookie banners on thousands of sites.
- **Sets stored consent flags** so banners don't reappear when you come back.
- **Talks directly to the major Consent Management Platforms** (OneTrust, Cookiebot, Didomi, TrustArc, Quantcast Choice) via their published JS APIs — more reliable than clicking through DOM selectors.
- **Blocks known third-party consent SDKs** at the network layer where it's safe to do so.

No account, no tracking, no telemetry.

## Install

<a href="https://addons.mozilla.org/en-US/firefox/addon/istilldontcareaboutcookies"><img src="https://blog.mozilla.org/addons/files/2020/04/get-the-addon-fx-apr-2020.svg" alt="Get for Firefox" height="65"></a>
<a href="https://chrome.google.com/webstore/detail/i-still-dont-care-about-c/edibdbjcniadpccecjdfdjjppcpchdlm"><img src="https://developer.chrome.com/static/docs/webstore/branding/image/HRs9MPufa1J1h5glNhut.png" alt="Get for Chrome" height="65"></a>
<a href="https://microsoftedge.microsoft.com/addons/detail/i-still-dont-care-about-/kkacdgacpkediooahopgcbdahlpipheh"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Get_it_from_Microsoft_Badge.svg/320px-Get_it_from_Microsoft_Badge.svg.png" alt="Get for Edge" height="65"></a>

Manual install guides: [Firefox](https://github.com/OhMyGuus/I-Still-Dont-Care-About-Cookies/wiki/Firefox-installation-guide) · [Chrome](https://github.com/OhMyGuus/I-Still-Dont-Care-About-Cookies/wiki/Chrome-installation-guide).

## Features

- **Per-domain whitelist** — disable the extension on individual sites via the toolbar popup
- **Backup** — download or restore your whitelist as JSON from the options page
- **Sync** (opt-in) — mirror your whitelist across devices via browser sync
- **Debug mode** (opt-in) — see which rule fired on the current site in the background console
- **Status badges** — green check (✅) when the extension acted, grey ⛔ when whitelisted

## When a site still shows a banner

1. Make sure no other privacy or ad-blocker extension is interfering.
2. Try the page in a clean profile — broken sites are sometimes broken by unrelated extensions.
3. If it really is us, use the **Report** button in the popup:
   - **GitHub** opens a pre-filled issue template.
   - **Anonymous** sends a short report to our API (no personal data).

## Development

```bash
git clone https://github.com/OhMyGuus/I-Still-Dont-Care-About-Cookies.git
cd I-Still-Dont-Care-About-Cookies
npm install
```

The repo ships a single Manifest V3 manifest that works on both Firefox (≥ 113) and Chromium-derived browsers. Load `src/` as a temporary extension via:

- **Firefox**: `about:debugging#/runtime/this-firefox` → _Load Temporary Add-on_ → pick any file under `src/`
- **Chrome / Edge / Brave**: `chrome://extensions` → _Load unpacked_ → select `src/`

Older Firefox versions (< 113) need the last Manifest V2 release from the GitHub releases page.

### Adding a rule for a new site

```bash
npm run add-rule -- --domain example.com --css "#cookie-banner { display: none }"
```

The tool edits `src/data/rules.js` in place. See [tools/README.md](tools/README.md) for the full flag list (custom CSS, common-CSS reference, handler reference).

### Other scripts

```bash
npm run lint                  # ESLint
npm run prettier              # Format the tree
npm run generate-block-rules  # Regenerate src/rules.json from rules.js (MV3 DNR)
```

## Translation

We use [Crowdin](https://crowdin.com/project/i-still-dont-care-about-cookie/) for translations. Pull requests against individual `src/_locales/<lang>/messages.json` files are also fine.

## License

GPL-3.0 — see [LICENSE](LICENSE).

## Credits

This project began as a fork of Daniel Kladnik's _I don't care about cookies_ (v3.4.3, GPL-3.0) and is now maintained independently. The rule set and core architecture descend from years of patient cataloguing in the original project — Daniel and the original contributors deserve credit for that work.

- Original author: [Daniel Kladnik](https://www.linkedin.com/in/dkladnik)
- Maintainer: [OhMyGuus](https://github.com/OhMyGuus/)
- Project setup help: [appeasementPolitik](https://github.com/appeasementPolitik)
- [All contributors](https://github.com/OhMyGuus/I-Still-Dont-Care-About-Cookies/graphs/contributors)
- [Translators](https://crowdin.com/project/i-still-dont-care-about-cookie/members)

<a href="https://github.com/OhMyGuus/I-Still-Dont-Care-About-Cookies/graphs/contributors">
  <img alt="Contributors" src="https://contrib.rocks/image?repo=OhMyGuus/I-Still-Dont-Care-About-Cookies" />
</a>
