// Side panel: tools, sources and context for the current post or page. Renders from the shared registry
// (registry/*.json, copied into extension/registry by `node registry/sync.mjs`).
// Data flow: badge click (content.js) -> background.js -> storage.session["sel:<tabId>"] -> here.
// Nothing leaves the browser until the user presses "Send for deeper check" or "Look up".

const { t, signalLabel } = globalThis.HMI18N;
const R = globalThis.HMRegistry;
const app = document.getElementById("app");
const tabsEl = document.getElementById("tabs");
const gear = document.getElementById("gear");
const langBtn = document.getElementById("lang");

const S = {
  lang: "mn", tab: "page", tabId: null, winId: null,
  post: null, cov: null, pageUrl: "", input: "",
  ctx: {},                 // "kind:value" -> {loading} | response
  checking: false, acc: {}, revealed: {},
  role: "all", cat: "all", q: "", recent: [],
  showServer: false, online: null, demoOnly: false, api: "",
  reg: { tools: [], mongolia: null, lessons: null, measurement: null },
};
const T = (k, v) => t(S.lang, k, v);
const TABS = ["page", "tools", "mongolia", "habits"];
const ROLES = ["all", "journalist", "editor", "researcher", "office"];
const CATS = ["all", "images", "video", "claims", "sources", "archives", "ai-signals", "geolocation", "documents", "habits"];

// --- helpers ------------------------------------------------------------------------------------------
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const safeUrl = (u) => (R.isHttp(u || "") ? u : null);
const tl = (tool, f) => (S.lang === "mn" && tool.mn && tool.mn[f]) || tool[f] || "";
const L = (o) => (o && (o[S.lang] || o.en || o.mn)) || "";
const OUT = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5h6.5V10M12.5 3.5L5 11"/></svg>`;
const ext = (url, label, cls = "tool-open", extra = "") =>
  safeUrl(url) ? `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer" ${extra}>${esc(label)}${OUT}</a>` : "";

const SHAPE = {
  signals: '<path class="f" d="M8 1.6l6.6 11.6H1.4z"/><path class="s" d="M8 6v3.4M8 11.2v.1"/>',
  factcheck: '<path class="f" d="M3.5 1.5h6l3 3v10h-9z"/><path class="s" d="M5.6 7h4.8M5.6 9.5h4.8M5.6 12h3"/>',
  not_assessed: '<circle class="o" cx="8" cy="8" r="6"/><path class="d" d="M5.4 8h5.2"/>',
  pending: '<circle class="o" cx="8" cy="8" r="6" stroke-dasharray="3 2.4"/>',
};
const shape = (k) => `<svg class="shape" viewBox="0 0 16 16" aria-hidden="true">${SHAPE[k] || SHAPE.not_assessed}</svg>`;
const stateChip = (k) => `<span class="state t-${k}">${shape(k)}${esc(T(`state_${k}`))}</span>`;

// Search query from post text: no links or punctuation, first n words
function claimQuery(text, n = 10) {
  const s = String(text || "").replace(/\[[^\]]+\]|https?:\/\/\S+|[^\p{L}\p{N}\s%-]/gu, " ");
  return s.split(/\s+/).filter(Boolean).slice(0, n).join(" ");
}

function ctxFromInput(raw) {
  const d = R.detectInput(raw);
  const c = { kind: d.kind, url: "", image_url: "", domain: "", text: "" };
  if (d.kind === "url") { c.url = d.value; c.domain = R.hostOf(d.value); }
  if (d.kind === "image_url") { c.image_url = d.value; }
  if (d.kind === "domain") { c.domain = d.value; }
  if (d.kind === "claim") { c.text = d.value; }
  return c;
}

function ctxFromPost(p) {
  const m = p.media || {};
  const text = claimQuery(p.text || p.imageText);
  return { kind: "post", url: p.url || "", image_url: R.isHttp(m.src) ? m.src : "", domain: R.hostOf(p.url || ""), text, author: p.author || "" };
}

// Per-tool value: a few tools want something specific from a post
function valueFor(tool, ctx) {
  if (tool.id === "meta-ad-library") return ctx.author || "";
  if (tool.id === "mfcc-search") return claimQuery(ctx.text, 5);
  return R.valueFor(tool, ctx);
}

// --- tool cards ---------------------------------------------------------------------------------------
function toolCard(tool, ctx) {
  const value = ctx ? valueFor(tool, ctx) : "";
  let action = "", copy = "";
  if (tool.open.mode === "deeplink") {
    const link = R.buildLink(tool, value);
    if (link) action = ext(link.url, T("open"), "tool-open", `data-tool="${esc(tool.id)}"`);
    if (link && !link.prefilled && value) {
      copy = `<div class="copybox"><code>${esc(value)}</code><button class="btn" type="button" data-act="copy" data-v="${esc(value)}">${esc(T("copy"))}</button></div>
              <p class="note">${esc(T("not_prefilled"))}</p>`;
    }
  } else if (tool.open.mode === "api") {
    action = `<button class="tool-open" type="button" data-act="tool-api" data-tool="${esc(tool.id)}">${esc(T("in_panel"))}</button>`;
  } else {
    action = `<button class="tool-open" type="button" data-act="route" data-route="${esc(tool.open.route)}" data-tool="${esc(tool.id)}">${esc(T("in_panel"))}</button>`;
  }
  const chips = [
    `<span class="chip">${esc(T(`cost_${tool.cost}`))}</span>`,
    tool.needsLogin ? `<span class="chip">${esc(T("needs_login"))}</span>` : "",
    tool.status !== "ok" ? `<span class="chip">${esc(T(`status_${tool.status}`))}</span>` : "",
  ].join("");
  return `<article class="tool">
    <div class="tool-top"><div class="tool-name">${esc(tl(tool, "name"))}${tool.subtitle ? `<div class="tool-sub">${esc(tool.subtitle)}</div>` : ""}</div>${action}</div>
    <p class="tool-desc">${esc(tl(tool, "description"))}</p>
    <p class="tool-lim"><b>${esc(T("limits"))}</b> ${esc(tl(tool, "limits"))}</p>
    <div class="tool-meta">${chips}</div>${copy}
  </article>`;
}

// Tools that can use what we have, most specific first
function applicable(ctx, max = 6) {
  const order = { image_url: 0, claim: 1, text: 1, url: 2, domain: 3 };
  return S.reg.tools
    .filter((tool) => tool.open.mode === "deeplink" && tool.input !== "none" && tool.status !== "broken" && valueFor(tool, ctx))
    .filter((tool) => tool.open.template.includes("{U}"))
    .sort((a, b) => (order[a.input] ?? 9) - (order[b.input] ?? 9))
    .slice(0, max);
}

// --- context cards (proxy via background) -------------------------------------------------------------
function lookupKinds(ctx) {
  const out = [];
  if (ctx.url) out.push(["wayback", ctx.url]);
  if (ctx.domain) out.push(["rdap", ctx.domain]);
  return out;
}

function lookup(ctx) {
  for (const [kind, value] of lookupKinds(ctx)) {
    const k = `${kind}:${value}`;
    if (S.ctx[k] && !S.ctx[k].loading && S.ctx[k].ok) continue;
    S.ctx[k] = { loading: true };
    chrome.runtime.sendMessage({ type: "context", kind, value }, (r) => {
      S.ctx[k] = r || { ok: false, reason: "offline" };
      render();
    });
  }
  render();
}

function cachedTag(d) { return d && d.cached ? `<span class="cached">${esc(T("cached"))}</span>` : ""; }

function archiveCard(value, d) {
  const fallback = (d && d.fallback_url) || `https://web.archive.org/web/*/${value}`;
  let body;
  if (!d || d.loading) body = `<p class="note">${esc(T("checking"))}</p>`;
  else if (d.ok && d.archived) {
    body = `<dl class="kv">
      ${d.first ? `<dt>${esc(T("archive_first"))}</dt><dd>${ext(d.first.url, d.first.date || "", "")}</dd>` : ""}
      ${d.latest ? `<dt>${esc(T("archive_latest"))}</dt><dd>${ext(d.latest.url, d.latest.date || "", "")}</dd>` : ""}</dl>`;
  } else if (d.ok) body = `<p class="note">${esc(T("archive_none"))}</p>`;
  else body = `<p class="note">${esc(T(d.reason === "rate_limited" ? "archive_rate" : "card_failed"))}</p>`;
  return `<section class="card"><h3>${esc(T("card_archive"))}</h3>${cachedTag(d)}${body}
    <p class="tool-lim">${esc(tl(S.reg.tools.find((x) => x.id === "wayback") || {}, "limits"))}</p>
    ${ext((d && d.history_url) || fallback, T("open_directly"), "link-btn")}</section>`;
}

function domainCard(value, d) {
  const whois = (d && (d.whois_url || d.fallback_url)) || `https://www.whois.com/whois/${encodeURIComponent(value)}`;
  let body;
  if (!d || d.loading) body = `<p class="note">${esc(T("checking"))}</p>`;
  else if (d.ok) {
    body = `<dl class="kv"><dt>Domain</dt><dd>${esc(d.domain)}</dd>
      ${d.registered ? `<dt>${esc(T("registered"))}</dt><dd>${esc(d.registered)}</dd>` : ""}
      ${d.registrar ? `<dt>${esc(T("registrar"))}</dt><dd>${esc(d.registrar)}</dd>` : ""}
      ${d.expires ? `<dt>${esc(T("expires"))}</dt><dd>${esc(d.expires)}</dd>` : ""}</dl>`;
  } else body = `<p class="note">${esc(T(d.reason === "no_rdap_for_tld" ? "rdap_none" : "card_failed"))}</p>`;
  return `<section class="card"><h3>${esc(T("card_domain"))}</h3>${cachedTag(d)}${body}
    <p class="tool-lim">${esc(tl(S.reg.tools.find((x) => x.id === "rdap") || {}, "limits"))}</p>
    ${ext(whois, "WHOIS", "link-btn")}</section>`;
}

function contextCards(ctx) {
  return lookupKinds(ctx).map(([kind, value]) => {
    const d = S.ctx[`${kind}:${value}`];
    if (!d) return "";
    return kind === "wayback" ? archiveCard(value, d) : domainCard(value, d);
  }).join("");
}

function lookupButton(ctx) {
  if (!lookupKinds(ctx).length) return "";
  const busy = lookupKinds(ctx).some(([k, v]) => S.ctx[`${k}:${v}`]?.loading);
  return `<div class="sec"><div class="row"><button class="btn" type="button" data-act="lookup" ${busy ? "disabled" : ""}>${esc(T("lookup"))}</button></div>
    <p class="note">${esc(T("lookup_note"))}</p></div>`;
}

// --- post view ----------------------------------------------------------------------------------------
function whyNotText(r) {
  if (r.checked && r.why_not === "no_signals_found") return T("none_found");
  const k = `why_not_${r.why_not}`;
  const s = T(k);
  return s === k ? T("why_not_other") : s;
}

function signalsList(r) {
  if (!r.signals || !r.signals.length) return "";
  const rows = r.signals.map((s) => `<li>
      <span class="${s.model_guess ? "ring" : "dot"}" aria-hidden="true"></span>
      <span class="r-body">
        <span class="r-main">${s.found ? `<span class="q">«${esc(s.found.slice(0, 80))}»</span> ` : ""}${esc(signalLabel(S.lang, s))}</span>
        ${s.why && S.lang === "mn" ? `<span class="r-why">${esc(s.why)}</span>` : ""}
        ${s.model_guess ? `<span class="tag">${esc(T("model_guess"))}</span>` : ""}
        ${safeUrl(s.src_url) ? ext(s.src_url, s.src_name || "Эх сурвалж", "link-btn") : ""}
      </span></li>`).join("");
  return `<section class="sec t-signals"><h2 class="sec-h">${esc(T("signals_h"))}</h2><ul class="reasons">${rows}</ul></section>`;
}

function factcheckCallout(r) {
  const f = r.factcheck;
  if (!f) return "";
  const pub = f.publisher || "";
  return `<div class="callout t-factcheck"><b>${esc(T("fc_h"))}</b>
    <span>${esc(T("fc_close", { publisher: pub }))}</span>
    ${f.headline ? `<span class="note">${esc(T("fc_headline"))}</span><blockquote>${esc(f.headline)}</blockquote>` : ""}
    ${f.date ? `<span class="note">${esc(pub)} · ${esc(f.date)}</span>` : ""}
    ${ext(f.url, T("fc_read", { publisher: pub }), "tool-open")}
    <span class="note">${esc(T("fc_note", { publisher: pub }))}</span></div>`;
}

function whyPanel(r) {
  const m = S.reg.measurement;
  const trig = r.signals && r.signals.length
    ? `<ul class="checklist">${r.signals.map((s) => `<li>${esc(signalLabel(S.lang, s))}${s.found ? `: «${esc(s.found.slice(0, 60))}»` : ""}</li>`).join("")}</ul>`
    : `<p>${esc(r.factcheck ? T("fc_close", { publisher: r.factcheck.publisher || "" }) : T("why_trigger_none"))}</p>`;
  return `<details class="fold"><summary>${esc(T("why_h"))}</summary><div class="fold-body">
    <h4>${esc(T("why_trigger"))}</h4>${trig}
    <h4>${esc(T("why_cannot"))}</h4><p>${esc(T("why_cannot_text"))}</p>
    ${m ? `<h4>${esc(T("why_measured"))}</h4><p>${esc(L(m.summary))}</p><p class="note">${esc(T("why_measured_caveat"))} (${esc(m.measured_on)})</p>` : ""}
  </div></details>`;
}

function contextList(r, p) {
  const items = (r.context || []).map((c) => T(`ctx_${c.id}`)).filter((s) => !s.startsWith("ctx_"));
  if (p.media && p.media.aiLabel) items.push(T("ai_label"));
  if (!items.length) return "";
  return `<section class="sec"><h2 class="sec-h">${esc(T("context_h"))}</h2><ul class="reasons">${items.map((s) =>
    `<li><span class="ring" aria-hidden="true"></span><span class="r-body">${esc(s)}</span></li>`).join("")}</ul></section>`;
}

function notesList(r) {
  const notes = (r.notes || []).map((n) => T(`note_${n}`));
  return notes.map((n) => `<p class="note">${esc(n)}</p>`).join("");
}

function asks(p, r) {
  const isAd = r && (r.post_type === "ad" || r.post_type === "commerce");
  const kind = isAd ? "ad" : (!p.text && p.media && p.media.has ? "media" : "claim");
  const list = [S.lang === "mn" && r && r.reflect && r.reflect.ask, T(`ask_${kind}_1`), T(`ask_${kind}_2`), T(`ask_${kind}_3`)];
  const uniq = [...new Set(list.filter(Boolean))].slice(0, 3);
  return `<section class="sec"><h2 class="sec-h">${esc(T("asks_h"))}</h2><ol class="asks">${uniq.map((q) => `<li>${esc(q)}</li>`).join("")}</ol></section>`;
}

function laws(r) {
  if (!r || !r.laws || !r.laws.length) return "";
  return `<details class="fold"><summary>${esc(T("laws_h"))}</summary><div class="fold-body">${r.laws.map((l) =>
    `<p><b>${esc(l.title)}</b> ${esc(l.text)} ${ext(l.url, "legalinfo.mn", "link-btn")}</p>`).join("")}
    <p class="note">${esc(T("laws_note"))}</p></div></details>`;
}

function officialLinks(r) {
  const links = ((r && r.check_links) || []).filter((l) => safeUrl(l.url) && !/google\.com|mfcc\.mn/.test(l.url));
  if (!links.length) return "";
  return `<section class="sec"><h2 class="sec-h">${esc(T("official_h"))}</h2><div class="chips">${links.map((l) => ext(l.url, l.title, "btn")).join("")}</div></section>`;
}

function accuracyPrompt(p) {
  const a = S.acc[p.id];
  const opts = ["acc_yes", "acc_unsure", "acc_no"];
  return `<section class="acc"><b>${esc(T("acc_q"))}</b>
    <div class="acc-row">${opts.map((k) => `<button class="btn" type="button" data-act="acc" data-v="${k}" aria-pressed="${a === k}">${esc(T(k))}</button>`).join("")}</div>
    <p class="note">${esc(T("acc_note"))}</p></section>`;
}

function postView(p) {
  const r = p.result;
  const ctx = ctxFromPost(p);
  const quote = [p.text, p.imageText && `[🖼] ${p.imageText}`].filter(Boolean).join(" ");
  const state = S.checking ? "pending" : (r ? r.state : "not_assessed");
  const parts = [];
  parts.push(`<div class="post">
      <div class="post-who"><b>${esc(p.author || T("unknown_author"))}</b>
        ${p.synthetic ? "" : `<button class="link-btn" type="button" data-act="focus">${esc(T("go_to_post"))}</button>`}
        <button class="link-btn" type="button" data-act="clear-post" aria-label="close">✕</button></div>
      ${quote ? `<p class="post-text">${esc(quote)}</p>` : ""}
    </div>`);
  parts.push(`<section class="sec">${stateChip(state)}${r ? cachedTag(r) : ""}</section>`);

  if (!r) {
    parts.push(`<p class="note">${esc(T("not_checked_yet"))}</p>`);
    if (p.text || p.imageText) {
      parts.push(accuracyPrompt(p));
      parts.push(`<section class="sec"><button class="btn btn-pri" type="button" data-act="deep" ${S.checking ? "disabled" : ""}>${esc(S.checking ? T("checking") : T("deep_btn"))}</button>
        <p class="note">${esc(T("deep_note"))}</p></section>`);
    } else {
      parts.push(`<p class="sum">${esc(T("why_not_no_text"))}</p>`);
    }
  } else {
    if (S.acc[p.id]) parts.push(`<p class="note">${esc(T("acc_echo", { a: T(S.acc[p.id]) }))}</p>`);
    parts.push(factcheckCallout(r));
    parts.push(signalsList(r));
    if (r.state === "not_assessed") parts.push(`<p class="sum">${esc(whyNotText(r))}</p>`);
    parts.push(notesList(r));
    parts.push(whyPanel(r));
  }
  parts.push(contextList(r || {}, p));

  const tools = applicable(ctx);
  parts.push(`<section class="sec"><h2 class="sec-h">${esc(T("yourself_h"))}</h2>${lookupButton(ctx)}${contextCards(ctx)}
    <div class="tools">${tools.map((x) => toolCard(x, ctx)).join("")}</div>
    <button class="link-btn" type="button" data-act="tab" data-tab="tools">${esc(T("more_tools"))}</button></section>`);
  parts.push(officialLinks(r));
  parts.push(asks(p, r));
  parts.push(laws(r));
  parts.push(`<p class="foot">${esc(T("foot"))}</p>`);
  return parts.join("");
}

// --- page view (no post selected) ---------------------------------------------------------------------
function legend() {
  const row = (k) => `<li class="t-${k}">${shape(k)}<span><b>${esc(T(`state_${k}`))}</b>${esc(T(`legend_${k}`))}</span></li>`;
  return `<section class="sec"><h2 class="sec-h">${esc(T("legend_h"))}</h2><ul class="legend">${row("signals")}${row("factcheck")}${row("not_assessed")}</ul></section>`;
}

function pageDyn() {
  const ctx = ctxFromInput(S.input);
  const tools = ctx.kind === "none" ? [] : applicable(ctx);
  const checkBtn = ctx.kind === "claim" && ctx.text.length >= 25
    ? `<div class="sec"><button class="btn btn-pri" type="button" data-act="check-input">${esc(T("deep_btn"))}</button>
       <p class="note">${esc(T("deep_note"))}</p></div>` : "";
  return `${ctx.kind !== "none" ? `<span class="chip">${esc(T(`kind_${ctx.kind}`))}</span>` : ""}
    ${checkBtn}${lookupButton(ctx)}${contextCards(ctx)}
    ${tools.length ? `<div class="tools">${tools.map((x) => toolCard(x, ctx)).join("")}</div>` : ""}
    <button class="link-btn" type="button" data-act="tab" data-tab="tools">${esc(T("more_tools"))}</button>`;
}

function pageView() {
  const cov = S.cov && S.cov.seen ? `<p class="note">${esc(T("coverage", S.cov))}</p>` : "";
  return `<h1 class="sum">${esc(T("empty_h"))}</h1>${cov}
    <section class="sec"><label class="lbl" for="inp">${esc(T("input_label"))}</label>
      <textarea id="inp" placeholder="${esc(T("input_ph"))}" spellcheck="false">${esc(S.input)}</textarea>
      ${!S.pageUrl ? `<p class="note">${esc(T("no_tab_url"))}</p>` : ""}
      <div id="dyn" class="sec">${pageDyn()}</div></section>
    ${legend()}
    <p class="foot">${esc(T("foot"))}</p>`;
}

// --- tools tab (the hub) ------------------------------------------------------------------------------
function toolList() {
  const ctx = ctxFromInput(S.input);
  const q = S.q.trim().toLowerCase();
  const list = S.reg.tools.filter((x) =>
    (S.role === "all" || x.audiences.includes(S.role)) &&
    (S.cat === "all" || x.categories.includes(S.cat)) &&
    (!q || [x.name, x.subtitle, x.description, x.mn && x.mn.name, x.mn && x.mn.description].join(" ").toLowerCase().includes(q)));
  return list.length ? list.map((x) => toolCard(x, ctx)).join("") : `<p class="note">${esc(T("no_tools"))}</p>`;
}

function toolsView() {
  const recent = S.recent.map((id) => S.reg.tools.find((x) => x.id === id)).filter(Boolean);
  const chip = (group, v, label) => `<button class="btn" type="button" data-act="${group}" data-v="${v}" aria-pressed="${S[group] === v}">${esc(label)}</button>`;
  return `<div class="row"><input id="q" type="search" placeholder="${esc(T("tools_search"))}" value="${esc(S.q)}" aria-label="${esc(T("tools_search"))}"></div>
    ${S.input ? `<p class="note"><code>${esc(S.input.slice(0, 80))}</code></p>` : ""}
    <div class="chips" role="group">${ROLES.map((r) => chip("role", r, T(`role_${r}`))).join("")}</div>
    <div class="chips" role="group">${CATS.map((c) => chip("cat", c, T(`cat_${c}`))).join("")}</div>
    ${recent.length ? `<section class="sec"><h2 class="sec-h">${esc(T("recent_h"))}</h2><div class="chips">${recent.map((x) =>
      `<button class="btn" type="button" data-act="search-tool" data-v="${esc(x.id)}">${esc(tl(x, "name"))}</button>`).join("")}</div></section>` : ""}
    <div class="tools" id="tool-list">${toolList()}</div>`;
}

// --- Mongolia + habits --------------------------------------------------------------------------------
function mongoliaView() {
  const m = S.reg.mongolia;
  if (!m) return "";
  return m.groups.map((g) => `<section class="sec"><h2 class="sec-h">${esc(L(g.title))}</h2>${g.items.map((it) => `
    <article class="card"><h3>${esc(L(it.name))}</h3>
      <p class="tool-desc">${esc(L(it.text))}</p>
      ${it.label ? `<span class="chip">${it.label_url ? ext(it.label_url, L(it.label), "") : esc(L(it.label))}</span>` : ""}
      ${it.note ? `<p class="note">${esc(L(it.note))}</p>` : ""}
      ${!it.verified ? `<span class="chip">${esc(T("status_unverified"))}</span>` : ""}
      ${ext(it.url, it.url ? new URL(it.url).hostname : "", "link-btn")}
    </article>`).join("")}</section>`).join("");
}

function habitsView() {
  const l = S.reg.lessons;
  if (!l) return "";
  const lang = S.lang;
  const sift = `<section class="sec" id="sift"><h2 class="sec-h">${esc(L(l.sift.title))}</h2><ol class="steps">${l.sift.steps.map((s) =>
    `<li><span class="k">${esc(s.key)}</span><span><b>${esc(s[lang][0])}</b><br>${esc(s[lang][1])}</span></li>`).join("")}</ol>
    ${ext(l.sift.attribution.url, l.sift.attribution.text, "link-btn")}</section>`;
  const tactics = `<section class="sec"><h2 class="sec-h">${esc(T("tactic_h"))}</h2>${l.tactics.map((x) => {
    const c = x[lang];
    return `<article class="card"><blockquote class="q">${esc(c.post)}</blockquote><b>${esc(c.q)}</b>
      ${S.revealed[x.id] ? `<p>${esc(c.a)}</p>` : `<button class="btn" type="button" data-act="reveal" data-v="${esc(x.id)}">${esc(T("show_answer"))}</button>`}</article>`;
  }).join("")}</section>`;
  const ifcn = `<section class="sec" id="ifcn"><h2 class="sec-h">${esc(L(l.ifcn.title))}</h2><ol class="checklist">${l.ifcn.items.map((i) =>
    `<li>${esc(i[lang])}</li>`).join("")}</ol><p class="note">${esc(T("ifcn_note"))}</p>${ext(l.ifcn.source, "IFCN", "link-btn")}</section>`;
  return sift + tactics + ifcn;
}

// --- shell --------------------------------------------------------------------------------------------
function serverView() {
  const st = S.online === null ? ["t-mute", "server_wait"] : S.online ? ["t-factcheck", "server_ok"] : ["t-signals", "server_bad"];
  return `<div class="server">
    <label class="lbl" for="api">${esc(T("server_label"))}</label>
    <div class="row"><input id="api" value="${esc(S.api || "http://127.0.0.1:8000")}" spellcheck="false"><button class="btn" type="button" data-act="save">${esc(T("save"))}</button></div>
    <span class="status ${st[0]}">${esc(T(st[1]))}</span>
    <label class="note"><input type="checkbox" id="demoOnly" ${S.demoOnly ? "checked" : ""}> ${esc(T("demo_only"))}</label></div>`;
}

function demoMode() { return S.demoOnly || S.online === false || !navigator.onLine; }

function render() {
  document.documentElement.lang = S.lang;
  document.getElementById("title").textContent = T("app_name");
  langBtn.textContent = T("lang_switch");
  langBtn.setAttribute("aria-label", T("lang_switch_aria"));
  gear.setAttribute("aria-label", T("settings"));
  gear.setAttribute("aria-expanded", String(S.showServer));
  tabsEl.innerHTML = TABS.map((k) => `<button class="tab" role="tab" type="button" data-tab="${k}" aria-selected="${S.tab === k}">${esc(T(`tab_${k}`))}</button>`).join("");

  const parts = [];
  if (demoMode()) parts.push(`<div class="banner" role="status">${esc(T("demo_banner"))}</div>`);
  if (S.showServer) parts.push(serverView());
  if (S.tab === "page") parts.push(S.post ? postView(S.post) : pageView());
  if (S.tab === "tools") parts.push(toolsView());
  if (S.tab === "mongolia") parts.push(mongoliaView());
  if (S.tab === "habits") parts.push(habitsView());
  app.innerHTML = parts.join("");
}

// --- events -------------------------------------------------------------------------------------------
tabsEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (b) { S.tab = b.dataset.tab; render(); window.scrollTo(0, 0); }
});
langBtn.addEventListener("click", () => {
  S.lang = S.lang === "mn" ? "en" : "mn";
  chrome.storage.local.set({ lang: S.lang });
  render();
});
gear.addEventListener("click", () => { S.showServer = !S.showServer; render(); });

app.addEventListener("input", (e) => {
  if (e.target.id === "inp") { S.input = e.target.value; document.getElementById("dyn").innerHTML = pageDyn(); }
  if (e.target.id === "q") { S.q = e.target.value; document.getElementById("tool-list").innerHTML = toolList(); }
});
app.addEventListener("change", (e) => {
  if (e.target.id === "demoOnly") { S.demoOnly = e.target.checked; chrome.storage.local.set({ demoOnly: S.demoOnly }); render(); }
});

app.addEventListener("click", async (e) => {
  const link = e.target.closest("a[data-tool]");
  if (link) remember(link.dataset.tool);
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act, v = el.dataset.v;
  if (act === "tab") { S.tab = el.dataset.tab; render(); window.scrollTo(0, 0); }
  if (act === "focus" && S.post) chrome.runtime.sendMessage({ type: "focus", tabId: S.tabId, id: S.post.id });
  if (act === "clear-post") {
    if (!S.post.synthetic) chrome.storage.session.remove(`sel:${S.tabId}`);
    S.post = null; render();
  }
  if (act === "acc" && S.post) { S.acc[S.post.id] = v; render(); }
  if (act === "check-input") {
    // A pasted claim goes through the same check as a post; it is never written to session storage
    S.post = { id: `inp${Date.now()}`, text: S.input.trim(), imageText: "", media: {}, synthetic: true };
  }
  if ((act === "deep" || act === "check-input") && S.post && !S.checking) {
    S.checking = true; render();
    chrome.runtime.sendMessage({ type: "check", tabId: S.tabId, post: S.post }, (r) => {
      S.checking = false;
      if (S.post && r && r.id === S.post.id) S.post = { ...S.post, result: r };
      render();
    });
  }
  if (act === "lookup") lookup(S.post ? ctxFromPost(S.post) : ctxFromInput(S.input));
  if (act === "tool-api") {
    remember(el.dataset.tool);
    S.tab = "page";
    if (el.dataset.tool === "checker" && S.post && !S.post.result) render();
    else lookup(S.post ? ctxFromPost(S.post) : ctxFromInput(S.input));
  }
  if (act === "route") {
    remember(el.dataset.tool);
    const r = el.dataset.route;
    S.tab = r === "mongolia" ? "mongolia" : "habits";
    render();
    const anchor = r.split("/")[1];
    if (anchor) document.getElementById(anchor)?.scrollIntoView();
  }
  if (act === "role" || act === "cat") { S[act] = v; render(); }
  if (act === "search-tool") { S.q = (S.reg.tools.find((x) => x.id === v) || {}).name || ""; render(); }
  if (act === "reveal") { S.revealed[v] = true; render(); }
  if (act === "copy") {
    try { await navigator.clipboard.writeText(v); el.textContent = T("copied"); } catch { /* clipboard blocked: the text is visible */ }
  }
  if (act === "save") {
    S.api = document.getElementById("api").value.trim().replace(/\/$/, "");
    await chrome.storage.local.set({ api: S.api });
    S.online = null; render(); health();
  }
});

function remember(id) {
  if (!id) return;
  S.recent = [id, ...S.recent.filter((x) => x !== id)].slice(0, 6);
  chrome.storage.local.set({ recent: S.recent });    // tool ids only, never the input or URL
}

function health() {
  chrome.runtime.sendMessage({ type: "health" }, (r) => { S.online = !!(r && r.ok); render(); });
}

async function loadTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  S.tabId = tab ? tab.id : null;
  S.winId = tab ? tab.windowId : null;
  S.pageUrl = tab && R.isHttp(tab.url || "") ? tab.url : "";   // tab.url is only visible after a user gesture (activeTab)
  if (!S.input && S.pageUrl) S.input = S.pageUrl;
  const k = `sel:${S.tabId}`, c = `cov:${S.tabId}`;
  const o = await chrome.storage.session.get([k, c]);
  S.post = o[k] || null;
  S.cov = o[c] || null;
  render();
}

chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== "session") return;
  const k = `sel:${S.tabId}`, c = `cov:${S.tabId}`;
  if (ch[k]) {
    const nv = ch[k].newValue || null;
    const changedPost = !S.post || !nv || nv.id !== S.post.id;
    S.post = nv;
    if (changedPost) { S.tab = "page"; S.checking = false; window.scrollTo(0, 0); }
    render();
  }
  if (ch[c]) { S.cov = ch[c].newValue || null; if (S.tab === "page" && !S.post) render(); }
});
chrome.tabs.onActivated.addListener(({ windowId }) => { if (windowId === S.winId) { S.input = ""; loadTab(); } });
window.addEventListener("online", render);
window.addEventListener("offline", render);

(async () => {
  const get = async (f) => { try { return await (await fetch(chrome.runtime.getURL(`registry/${f}`))).json(); } catch { return null; } };
  const [tools, mongolia, lessons, measurement] = await Promise.all(["tools.json", "mongolia.json", "lessons.json", "measurement.json"].map(get));
  S.reg = { tools: tools || [], mongolia, lessons, measurement };
  const st = await chrome.storage.local.get(["lang", "recent", "demoOnly", "api"]);
  S.lang = st.lang || "mn";
  S.recent = st.recent || [];
  S.demoOnly = !!st.demoOnly;
  S.api = st.api || "";
  await loadTab();
  health();
})();
