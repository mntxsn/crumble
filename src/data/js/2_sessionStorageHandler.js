/*  Session storage handler */
/*  Use this handler if it's possible to remove the warning using the session storage and can't be handeld using css*/

function getItem(hostname) {
  switch (hostname) {
    case "pepephone.com":
      return { strict: true, key: "cookiesChosen", value: "done" };
  }

  const parts = hostname.split(".");

  if (parts.length > 2) {
    parts.shift();
    return getItem(parts.join("."));
  }

  return false;
}

const hostname = document.location.hostname.replace(/^w{2,3}\d*\./i, "");
const item = getItem(hostname);

if (item) {
  try {
    const value = sessionStorage.getItem(item.key);

    if (value == null || (item.strict && value != item.value)) {
      sessionStorage.setItem(item.key, item.value);
      document.location.reload();
    }
  } catch (err) {
    // sessionStorage can throw in private/restricted modes or when quota is hit.
    console.warn("idcac sessionStorage handler failed:", err);
  }
}
