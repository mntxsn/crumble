// Custom i18n loader for popup + options surfaces. The reason we don't use
// chrome.i18n.getMessage everywhere: it's locale-fixed by the browser. To
// honour the user's explicit language choice in settings we need to load the
// matching messages.json ourselves. Falls back to English when a key is
// missing in the chosen locale.

export const AVAILABLE_LOCALES = [
  "bg",
  "cs",
  "da",
  "de",
  "en",
  "es",
  "fr",
  "hr",
  "hu",
  "it",
  "ja",
  "ko",
  "lt",
  "nb",
  "nl",
  "nn",
  "no",
  "pl",
  "pt",
  "ro",
  "ru",
  "sk",
  "sv",
  "tr",
  "uk",
  "zh_CN",
];

// Self-referenced language names so users can recognise their own language
// regardless of the current UI language.
export const LOCALE_NAMES = {
  bg: "Български",
  cs: "Čeština",
  da: "Dansk",
  de: "Deutsch",
  en: "English",
  es: "Español",
  fr: "Français",
  hr: "Hrvatski",
  hu: "Magyar",
  it: "Italiano",
  ja: "日本語",
  ko: "한국어",
  lt: "Lietuvių",
  nb: "Norsk Bokmål",
  nl: "Nederlands",
  nn: "Nynorsk",
  no: "Norsk",
  pl: "Polski",
  pt: "Português",
  ro: "Română",
  ru: "Русский",
  sk: "Slovenčina",
  sv: "Svenska",
  tr: "Türkçe",
  uk: "Українська",
  zh_CN: "中文（简体）",
};

export const DEFAULT_LOCALE = "en";

async function fetchLocale(locale) {
  try {
    const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Apply $PLACEHOLDER$-style substitutions defined in messages.json entries.
// chrome.i18n.getMessage accepts an array of substitutions positionally — we
// match that contract so existing callers can pass `hostname` etc. unchanged.
// Exported for testability.
export function applyPlaceholders(message, entry, substitutions) {
  if (!substitutions || !entry || !entry.placeholders) return message;
  const subsArray = Array.isArray(substitutions)
    ? substitutions
    : [substitutions];
  let out = message;
  for (const [name, def] of Object.entries(entry.placeholders)) {
    if (!def || typeof def.content !== "string") continue;
    const match = def.content.match(/^\$(\d+)$/);
    if (!match) continue;
    const idx = parseInt(match[1], 10) - 1;
    const value = subsArray[idx];
    if (value === undefined) continue;
    // Placeholder tokens are case-insensitive in chrome.i18n; we match the
    // exact $NAME$ token from the message.
    out = out.replace(new RegExp(`\\$${name}\\$`, "gi"), value);
  }
  return out;
}

/**
 * Build a translator for the given locale.
 * @param {string} locale - The user-selected locale code (e.g. "de").
 * @returns {Promise<{t: (key: string, subs?: any) => string, locale: string}>}
 */
export async function buildTranslator(locale) {
  const requested = AVAILABLE_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;

  // Load both the requested locale and English. English serves as the
  // fallback for any key not yet translated.
  const [primary, fallback] = await Promise.all([
    fetchLocale(requested),
    requested === DEFAULT_LOCALE ? Promise.resolve(null) : fetchLocale(DEFAULT_LOCALE),
  ]);

  const fb = fallback || (requested === DEFAULT_LOCALE ? primary : null);

  function t(key, subs) {
    const entry =
      (primary && primary[key]) || (fb && fb[key]) || null;
    if (!entry) return "";
    return applyPlaceholders(entry.message || "", entry, subs);
  }

  return { t, locale: requested };
}
