// Service worker. Builds requests and calls fetch() for the side panel and content script.
// It is killed after ~30 s idle, so all state lives in chrome.storage, never in globals
// (demoCache below is only a re-loadable copy of a bundled file).
//
// Privacy: nothing is sent to the server until the user presses "Send for deeper check" or "Look up"
// in the side panel. Opening the panel from a badge sends nothing.

const DEFAULT_API = "http://127.0.0.1:8000";

// Toolbar click opens the side panel (this is also the fallback when a badge click cannot open it)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

async function settings() {
  const { api, demoOnly } = await chrome.storage.local.get(["api", "demoOnly"]);
  return { api: api || DEFAULT_API, demoOnly: !!demoOnly };
}

// Anonymous install id: random, created once, used only for rate limits on the server
async function installId() {
  let { installId: id } = await chrome.storage.local.get("installId");
  if (!id) {
    id = crypto.randomUUID();
    await chrome.storage.local.set({ installId: id });
  }
  return id;
}
chrome.runtime.onInstalled.addListener(() => { installId(); });

let demoCache = null;
async function demo() {
  if (!demoCache) {
    try { demoCache = await (await fetch(chrome.runtime.getURL("demo-cache.json"))).json(); } catch { demoCache = {}; }
  }
  return demoCache;
}

// Same normalisation as extension/backend/tools/build_demo_cache.py
const textKey = (text, imageText) =>
  [text, imageText].filter(Boolean).join(" | ").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 300);

async function callApi(path, init = {}, timeoutMs = 8000) {
  const { api, demoOnly } = await settings();
  if (demoOnly) throw new Error("demo_only");
  const res = await fetch(api + path, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    headers: { ...(init.headers || {}), "X-Install-Id": await installId() },
  });
  if (!res.ok) throw new Error(`http_${res.status}`);
  return res.json();
}

async function check(post) {
  const item = {
    id: post.id, text: post.text || "", image_text: post.imageText || null, url: post.url || null,
    author: post.author || null, author_url: post.author_url || null, verified: !!post.verified,
    sponsored: !!post.sponsored, has_cta: !!post.has_cta, link_title: post.link_title || null,
    image_url: /^https?:/.test(post.media?.src || "") ? post.media.src : null,
  };
  try {
    // The Claude reader can take a while; the rules alone answer in well under a second
    const body = await callApi("/api/check", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [item] }),
    }, 45000);
    return { ...body.results[0], cached: false };
  } catch (e) {
    const hit = (await demo()).checks?.[textKey(post.text, post.imageText)];
    if (hit) return { ...hit, id: post.id, cached: true };
    return { id: post.id, state: "not_assessed", checked: false, why_not: "offline", signals: [], context: [], notes: [] };
  }
}

async function context(kind, value) {
  const path = { wayback: `/api/wayback?url=`, rdap: `/api/rdap?domain=` }[kind];
  if (!path) return { ok: false, reason: "bad_kind" };
  let body = null;
  try {
    body = await callApi(path + encodeURIComponent(value));
    if (body.ok) return { ...body, cached: false };
  } catch { /* fall through to the demo cache */ }
  const hit = (await demo())[kind]?.[String(value).trim().toLowerCase()];
  if (hit) return { ...hit, cached: true };
  return body || { ok: false, reason: "offline" };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "open-panel") {
    // sidePanel.open() needs the user gesture: call it FIRST, with no await before it
    const tab = sender.tab;
    chrome.sidePanel.open({ windowId: tab.windowId })
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    chrome.storage.session.set({ [`sel:${tab.id}`]: { ...msg.post, tabId: tab.id, at: Date.now() } });
    return true;
  }
  if (msg.type === "check") {
    (async () => {
      chrome.tabs.sendMessage(msg.tabId, { type: "pending", id: msg.post.id }).catch(() => {});
      const result = await check(msg.post);
      const k = `sel:${msg.tabId}`;
      const cur = (await chrome.storage.session.get(k))[k];
      if (cur && cur.id === msg.post.id) await chrome.storage.session.set({ [k]: { ...cur, result } });
      chrome.tabs.sendMessage(msg.tabId, { type: "result", id: msg.post.id, result }).catch(() => {});
      sendResponse(result);
    })();
    return true;
  }
  if (msg.type === "context") {
    context(msg.kind, msg.value).then(sendResponse);
    return true;
  }
  if (msg.type === "coverage" && sender.tab) {
    chrome.storage.session.set({ [`cov:${sender.tab.id}`]: { seen: msg.seen, checked: msg.checked } });
    return false;
  }
  if (msg.type === "focus") {
    chrome.tabs.sendMessage(msg.tabId, { type: "focus", id: msg.id }).catch(() => {});
    return false;
  }
  if (msg.type === "health") {
    callApi("/health", {}, 4000).then((r) => sendResponse(r)).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => { chrome.storage.session.remove([`sel:${tabId}`, `cov:${tabId}`]); });
