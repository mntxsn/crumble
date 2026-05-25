import { test } from "node:test";
import assert from "node:assert/strict";

import {
  applyPlaceholders,
  AVAILABLE_LOCALES,
  LOCALE_NAMES,
  DEFAULT_LOCALE,
} from "../src/data/js/i18n.js";

test("applyPlaceholders returns message unchanged when no placeholders", () => {
  const out = applyPlaceholders("Hello world", {}, []);
  assert.equal(out, "Hello world");
});

test("applyPlaceholders substitutes a single $NAME$ token", () => {
  const entry = {
    placeholders: {
      hostname: { content: "$1", example: "example.com" },
    },
  };
  const out = applyPlaceholders(
    "Enable extension on $HOSTNAME$",
    entry,
    ["example.com"]
  );
  assert.equal(out, "Enable extension on example.com");
});

test("applyPlaceholders accepts a single substitution (not array)", () => {
  // chrome.i18n.getMessage accepts both forms — match the contract.
  const entry = { placeholders: { hostname: { content: "$1" } } };
  const out = applyPlaceholders("$HOSTNAME$", entry, "example.com");
  assert.equal(out, "example.com");
});

test("applyPlaceholders is case-insensitive on token name", () => {
  const entry = { placeholders: { Hostname: { content: "$1" } } };
  assert.equal(
    applyPlaceholders("$hostname$", entry, ["x.com"]),
    "x.com"
  );
  assert.equal(
    applyPlaceholders("$HOSTNAME$", entry, ["x.com"]),
    "x.com"
  );
});

test("applyPlaceholders leaves message unchanged when substitution missing", () => {
  const entry = { placeholders: { hostname: { content: "$1" } } };
  const out = applyPlaceholders("$HOSTNAME$", entry, []);
  assert.equal(out, "$HOSTNAME$");
});

test("applyPlaceholders no-ops when entry has no placeholders", () => {
  assert.equal(
    applyPlaceholders("Hello $WORLD$", {}, ["earth"]),
    "Hello $WORLD$"
  );
});

test("AVAILABLE_LOCALES contains the expected canonical entries", () => {
  for (const code of ["en", "de", "fr", "es", "ja", "zh_CN"]) {
    assert.ok(
      AVAILABLE_LOCALES.includes(code),
      `expected ${code} in AVAILABLE_LOCALES`
    );
  }
});

test("LOCALE_NAMES has a self-referenced label for every available locale", () => {
  for (const code of AVAILABLE_LOCALES) {
    assert.ok(
      typeof LOCALE_NAMES[code] === "string" && LOCALE_NAMES[code].length > 0,
      `missing LOCALE_NAMES entry for ${code}`
    );
  }
});

test("DEFAULT_LOCALE is English and present in AVAILABLE_LOCALES", () => {
  assert.equal(DEFAULT_LOCALE, "en");
  assert.ok(AVAILABLE_LOCALES.includes(DEFAULT_LOCALE));
});
