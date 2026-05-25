# Contributing to Crumble

Thanks for caring enough about cookie banners to make this better.

This document covers the practical bits: how the source is laid out, how to add a site rule, how the localisation flow works, and the commands you need on a daily basis. If something here is wrong or unclear, opening a PR against this file is welcome.

## Project layout

```
src/
├── manifest.chrome.json           Chrome MV3 manifest (service_worker only)
├── manifest.firefox.json          Firefox MV3 manifest (incl. background.scripts)
├── icons/                         16/32/48/128 PNGs + the SVG source
├── rules.json                     Pre-compiled declarativeNetRequest ruleset
├── _locales/<lang>/messages.json  Per-language strings
└── data/
    ├── background.js              Service worker / event page
    ├── rules.js                   Per-site CSS + handler mappings + block rules source
    ├── options.html|js            Settings page
    ├── menu/                      Toolbar popup
    ├── css/                       Shared design tokens (theme.css) + page-specific
    └── js/
        ├── utils.js               Pure helpers (URL/hostname/whitelist parsing)
        ├── i18n.js                Locale loader with English fallback
        ├── tcfHandler.js          CMP API dismissal (OneTrust, Cookiebot, …)
        ├── 0_defaultClickHandler.js   Generic "click the reject button" race
        ├── 2_sessionStorageHandler.js
        ├── 3_localStorageHandler.js
        ├── 5_clickHandler.js      Per-vendor selector lookup table
        ├── 6_cookieHandler.js     Sets consent cookies directly on known sites
        ├── 8_googleHandler.js     Google-specific (consent.google.com etc.)
        └── embedsHandler.js       iframe-embed-specific dismissals

test/
├── utils.test.js
└── i18n.test.js

tools/
├── add-rule.js                    Add/replace a per-site rule
├── generate-block-rules.js        Recompile rules.json from rules.js
└── prettier.js                    Format helper used by add-rule

.github/workflows/
├── ci.yml                         Lint + prettier-check + unit tests
├── build.yml                      Per-push artifact builds
├── release.yml                    Tagged-release Chrome Web Store + AMO upload
└── block_rules.yml, localization.yml, …  Misc helpers
```

## Local setup

```bash
git clone https://github.com/mntxsn/crumble.git
cd crumble
npm install
```

### Loading the unpacked extension

We ship MV3 for both browser families, but the manifest's `background` declaration differs: Chrome only accepts `service_worker`, Firefox still needs `scripts` for older releases. Pick the matching variant:

```bash
# Firefox
cp src/manifest.firefox.json src/manifest.json

# Chrome / Edge / Brave / Arc
cp src/manifest.chrome.json src/manifest.json
```

Then load `src/`:

- **Firefox** (≥ 113): `about:debugging#/runtime/this-firefox` → _Load Temporary Add-on_ → pick any file under `src/`.
- **Chromium-based**: `chrome://extensions` → enable _Developer mode_ → _Load unpacked_ → select `src/`.

`src/manifest.json` is a build artifact (gitignored). The two `src/manifest.<browser>.json` files are the canonical sources; if you touch one, mirror the change to the other when applicable.

After loading, pin the toolbar icon for easier testing.

### Reloading after a change

- Content-script / popup / options changes: just re-open the popup or reload the page.
- `background.js` / `manifest.json` / `rules.json`: click the reload icon on the extension card (Chromium) or the _Reload_ button (Firefox).
- Permission changes: remove and re-add the extension.

## The day-to-day commands

| Command | What it does |
|---|---|
| `npm test` | Run the unit tests under `test/` (Node's built-in test runner — no extra deps) |
| `npm run lint` | ESLint over `src/` and `tools/` |
| `npm run lintfix` | ESLint with autofix |
| `npm run prettier` | Format the whole tree |
| `npm run prettier-check` | Verify formatting without writing |
| `npm run add-rule -- --domain example.com --css "…"` | Add or replace a site rule (see below) |
| `npm run generate-block-rules` | Regenerate `src/rules.json` from `blockUrls` in `rules.js` |

CI runs `lint`, `prettier-check`, and `test` on every PR — make sure all three pass locally before requesting review.

## Adding a rule for a new site

`rules.js` exports four things relevant to per-site behaviour:

- `rules` — `{ "hostname": { s?: "css", c?: number, j?: number } }` — the per-domain mapping.
  - `s` (string): inline custom CSS injected on the page.
  - `c` (number): index into `commons[]` — points at a shared CSS snippet reused across many sites.
  - `j` (number): index into `commonJSHandlers[]` — names a handler script in `data/js/<N>_…Handler.js`.
- `commons` — array of shared CSS strings.
- `commonJSHandlers` — array of handler filenames.
- `blockUrls` — declarative-net-request source: `common[]`, `common_groups{ key: [] }`, and `specific{ domain: [...] }`.

### The cleanest path: `npm run add-rule`

The tool re-uses Acorn to parse `rules.js` and edits the AST in place — safer than hand-editing the 1 MB file.

```bash
npm run add-rule -- --domain example.com --css "#cookie-banner{display:none!important}"
npm run add-rule -- --domain example.com --common 3
npm run add-rule -- --domain example.com --handler 5
```

Combinations work: `--css` + `--common` together attaches both. See `tools/README.md` for the full flag reference.

### Regenerating the compiled MV3 block list

If you touch `blockUrls` in `rules.js`, regenerate the declarativeNetRequest JSON:

```bash
npm run generate-block-rules
```

The generator normalises domain inputs (strips scheme, path, port) defensively, so accidentally pasting a full URL in an `e:` exception array won't break Firefox's ruleset validator.

## Localisation

The extension loads its own locale messages at runtime instead of relying on `chrome.i18n` — that lets the user pick a language in settings independently from the browser's locale.

- Source of truth for English: `src/_locales/en/messages.json`. Every new key lands here first.
- Other languages: `src/_locales/<lang>/messages.json`. Keys missing in a language fall back to English at runtime.
- Translations are co-ordinated on [Crowdin](https://crowdin.com/project/i-still-dont-care-about-cookie/). You can also PR a single `<lang>/messages.json` directly.

The list of bundled locales (`AVAILABLE_LOCALES`) and the self-referenced language names (`LOCALE_NAMES`) live in `src/data/js/i18n.js`. If you add a new locale folder, add the code there too.

## Code style

- ESLint config in `eslint.config.js`. Treat warnings as worth fixing.
- Prettier handles formatting — `.prettierrc.json` is the canonical config.
- `package.json` declares `"type": "module"`. New code should use ES modules.
- Pure helpers go in `src/data/js/utils.js` so they can be imported by tests without mocking `chrome.*`.

## Tests

The project uses Node's built-in `node:test` runner — no Vitest, no Jest. Tests live at the project root in `test/<name>.test.js` and are ES modules like the rest of the source.

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { isHttpUrl } from "../src/data/js/utils.js";

test("isHttpUrl accepts https", () => {
  assert.equal(isHttpUrl("https://example.com"), true);
});
```

What's worth testing: pure helpers (URL parsing, whitelist normalisation, i18n placeholders, locale registry consistency). What's not worth testing here: anything that requires `chrome.*`, `document`, or `fetch` — that's where unpacked manual testing pays off.

## Commit conventions

Match the existing style:

- Subject line ≤ ~70 chars, sentence case, no trailing period.
- Body: explain the **why** first, the **what** second. Tests live in tooling; commits live in human memory.
- Group related changes per commit; avoid bundling unrelated fixes.
- Co-author tags for AI-assisted work are welcome.

## Reporting a site that still shows a banner

If the extension misses something, the popup's _Report_ button is the canonical path:

- **GitHub** opens a pre-filled issue template — fastest, attaches version/browser metadata.
- **Anonymous** sends a short report to our API; useful when you'd rather not log in.

When reporting, please make sure no other privacy/ad-blocking extension is interfering — those occasionally hide the elements we're trying to click on, which looks identical to "the extension doesn't work" from the outside.
