// This is used to generate the block rules for Manifest V3 from the block rules in Manifest V2.

import { blockUrls } from "../src/data/rules.js";

// declarativeNetRequest's initiatorDomains / excludedInitiatorDomains accept
// bare host names only. Strip scheme, leading slashes, port, path, query, and
// fragment — defensive against legacy entries in rules.js (a few of which
// were full URLs and made Firefox reject the compiled ruleset).
function normalizeDomain(s) {
  if (typeof s !== "string") return s;
  return s
    .trim()
    .replace(/^[a-z][a-z0-9+\-.]*:\/+/i, "")
    .replace(/^\/+/, "")
    .split(/[/?#]/)[0]
    .split(":")[0]
    .toLowerCase();
}

function generateDeclarativeNetRules() {
  const result = [];
  let lastId = 1;

  const addRule = (blockRule) => {
    const newRule = {
      id: lastId++,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: blockRule.r,
        resourceTypes: ["script", "stylesheet", "xmlhttprequest", "image"],
      },
    };

    if (blockRule.e) {
      newRule.condition.excludedInitiatorDomains = blockRule.e
        .map(normalizeDomain)
        .filter(Boolean);
    }

    result.push(newRule);
  };

  for (const blockRule of blockUrls.common) {
    addRule(blockRule);
  }

  for (const blockRules of Object.values(blockUrls.common_groups)) {
    for (const blockRule of blockRules) {
      addRule(blockRule);
    }
  }

  for (const [domain, url] of Object.entries(blockUrls.specific)) {
    const newRule = {
      id: lastId++,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: url[0],
        resourceTypes: ["script", "stylesheet", "xmlhttprequest", "image"],
        initiatorDomains: [normalizeDomain(domain)],
      },
    };
    result.push(newRule);
  }

  console.log(JSON.stringify(result, null, "\t"));
}

generateDeclarativeNetRules();
