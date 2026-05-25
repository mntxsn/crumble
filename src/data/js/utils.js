// Pure helpers shared between background, popup, and options surfaces.
// Kept dependency-free (no chrome.* APIs, no DOM) so they can be unit-tested
// in a plain Node runner.

export function isHttpUrl(url) {
  return (
    typeof url === "string" &&
    (url.startsWith("http:") || url.startsWith("https:"))
  );
}

export function getHostname(url, cleanup) {
  if (!isHttpUrl(url)) return null;
  try {
    const a = new URL(url);
    return cleanup ? a.hostname.replace(/^w{2,3}\d*\./i, "") : a.hostname;
  } catch {
    return null;
  }
}

export function parseWhitelistInput(text) {
  const domains = {};
  String(text || "")
    .split("\n")
    .forEach((rawLine) => {
      const line = rawLine
        .trim()
        .replace(/^\w*:?\/+/i, "")
        .replace(/^w{2,3}\d*\./i, "")
        .split("/")[0]
        .split(":")[0];

      if (line.length > 0 && line.length < 100) {
        domains[line] = true;
      }
    });
  return domains;
}
