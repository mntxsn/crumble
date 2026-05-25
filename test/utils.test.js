import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isHttpUrl,
  getHostname,
  parseWhitelistInput,
} from "../src/data/js/utils.js";

test("isHttpUrl accepts http and https", () => {
  assert.equal(isHttpUrl("http://example.com"), true);
  assert.equal(isHttpUrl("https://example.com/path?q=1"), true);
});

test("isHttpUrl rejects non-http schemes", () => {
  assert.equal(isHttpUrl("ftp://example.com"), false);
  assert.equal(isHttpUrl("javascript:alert(1)"), false);
  assert.equal(isHttpUrl("chrome://settings"), false);
  assert.equal(isHttpUrl("about:blank"), false);
  assert.equal(isHttpUrl("data:text/html,<html>"), false);
});

test("isHttpUrl rejects schemes that begin with http but aren't", () => {
  // Guards against the old `indexOf('http') !== 0` bug.
  assert.equal(isHttpUrl("httpx://example.com"), false);
  assert.equal(isHttpUrl("httping://example.com"), false);
});

test("isHttpUrl rejects non-strings and empty", () => {
  assert.equal(isHttpUrl(null), false);
  assert.equal(isHttpUrl(undefined), false);
  assert.equal(isHttpUrl(""), false);
  assert.equal(isHttpUrl(123), false);
  assert.equal(isHttpUrl({}), false);
});

test("getHostname returns the host without cleanup flag", () => {
  assert.equal(getHostname("https://www.example.com/path"), "www.example.com");
  assert.equal(getHostname("http://sub.example.co.uk"), "sub.example.co.uk");
});

test("getHostname strips www-prefix when cleanup is truthy", () => {
  assert.equal(getHostname("https://www.example.com", true), "example.com");
  assert.equal(getHostname("https://www2.example.com", true), "example.com");
  assert.equal(getHostname("https://ww3.example.com", true), "example.com");
});

test("getHostname leaves non-www subdomains alone", () => {
  assert.equal(getHostname("https://shop.example.com", true), "shop.example.com");
  assert.equal(getHostname("https://api.example.org", true), "api.example.org");
});

test("getHostname returns null for non-http urls", () => {
  assert.equal(getHostname("ftp://example.com"), null);
  assert.equal(getHostname("javascript:alert(1)"), null);
  assert.equal(getHostname(""), null);
  assert.equal(getHostname(null), null);
});

test("getHostname returns null for malformed urls", () => {
  // URL constructor would throw — we catch and return null.
  assert.equal(getHostname("http://"), null);
});

test("parseWhitelistInput normalises one domain per line", () => {
  const input = "example.com\nfoo.org\nbar.io";
  assert.deepEqual(parseWhitelistInput(input), {
    "example.com": true,
    "foo.org": true,
    "bar.io": true,
  });
});

test("parseWhitelistInput strips scheme, www-prefix, paths, ports", () => {
  const input = [
    "https://www.example.com/path?q=1",
    "http://www2.foo.org/page",
    "bar.io:443",
    "  baz.net  ",
  ].join("\n");
  assert.deepEqual(parseWhitelistInput(input), {
    "example.com": true,
    "foo.org": true,
    "bar.io": true,
    "baz.net": true,
  });
});

test("parseWhitelistInput drops empty and excessively long lines", () => {
  const longDomain = "a".repeat(100) + ".com";
  const input = `\n\nexample.com\n\n${longDomain}\n   \n`;
  assert.deepEqual(parseWhitelistInput(input), { "example.com": true });
});

test("parseWhitelistInput dedupes identical inputs", () => {
  const input = "example.com\nexample.com\nwww.example.com";
  assert.deepEqual(parseWhitelistInput(input), { "example.com": true });
});

test("parseWhitelistInput handles null/undefined safely", () => {
  assert.deepEqual(parseWhitelistInput(null), {});
  assert.deepEqual(parseWhitelistInput(undefined), {});
  assert.deepEqual(parseWhitelistInput(""), {});
});
