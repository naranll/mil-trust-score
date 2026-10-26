// Shared by the extension (classic <script>, sets globalThis.HMRegistry) and Node (require).
// No dependencies. Builds deep links from registry templates: {U} = encodeURIComponent(input).
(function (root) {
  "use strict";
  const MAX_URL = 2048;
  const IMG_RE = /\.(jpe?g|png|webp|gif|avif|bmp)(\?|#|$)/i;
  const IMG_HOST_RE = /(^|\.)(fbcdn\.net|scontent[\w.-]*|cdninstagram\.com|upload\.wikimedia\.org|pbs\.twimg\.com)$/i;
  const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

  function isHttp(u) {
    try {
      const x = new URL(u);
      return x.protocol === "http:" || x.protocol === "https:";
    } catch {
      return false;
    }
  }

  function hostOf(u) {
    try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
  }

  // What did the user paste? One input box serves every tool.
  function detectInput(raw) {
    const v = String(raw ?? "").trim();
    if (!v) return { kind: "none", value: "" };
    if (/^https?:\/\//i.test(v) && !/\s/.test(v)) {
      if (!isHttp(v)) return { kind: "claim", value: v };
      let u;
      try { u = new URL(v); } catch { return { kind: "claim", value: v }; }
      return { kind: IMG_RE.test(u.pathname) || IMG_HOST_RE.test(u.hostname) ? "image_url" : "url", value: v };
    }
    if (DOMAIN_RE.test(v) && !/\s/.test(v)) return { kind: "domain", value: v.toLowerCase().replace(/^www\./, "") };
    return { kind: "claim", value: v };
  }

  // Pick the value a tool needs from what we know: {url, image_url, domain, text}.
  function valueFor(tool, ctx) {
    const c = ctx || {};
    switch (tool.input) {
      case "url": return c.url || "";
      case "image_url": return c.image_url || "";
      case "domain": return c.domain || hostOf(c.url || "") || "";
      case "claim":
      case "text": return c.text || "";
      default: return "";
    }
  }

  // Returns {url, prefilled, error?} or null when the tool is not a deep link.
  function buildLink(tool, input) {
    const o = tool && tool.open;
    if (!o || o.mode !== "deeplink") return null;
    const fallback = isHttp(o.fallbackUrl) ? o.fallbackUrl : null;
    const tpl = String(o.template || "");
    if (!tpl.includes("{U}")) {
      // Unverified parameter format: open the homepage; the UI offers the input with a copy button.
      return isHttp(tpl) ? { url: tpl, prefilled: false } : (fallback ? { url: fallback, prefilled: false, error: "bad_template" } : null);
    }
    const v = String(input ?? "").trim();
    if (!v) return fallback ? { url: fallback, prefilled: false } : null;
    if ((tool.input === "url" || tool.input === "image_url") && !isHttp(v)) {
      return fallback ? { url: fallback, prefilled: false, error: "input_not_http" } : null;
    }
    const url = tpl.split("{U}").join(encodeURIComponent(v));
    if (url.length > MAX_URL) return fallback ? { url: fallback, prefilled: false, error: "too_long" } : null;
    if (!isHttp(url)) return fallback ? { url: fallback, prefilled: false, error: "bad_template" } : null;
    return { url, prefilled: true };
  }

  const api = { buildLink, valueFor, detectInput, isHttp, hostOf, MAX_URL };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HMRegistry = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
