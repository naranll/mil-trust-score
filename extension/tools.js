// Tools box: a self-contained mini app inside the side panel's "Хэрэгсэл" tab.
// Task-first tool list (from the shared registry), Mongolia sources, habit lessons, and lookup cards
// (archive history, domain registration). Everything is scoped under .tb (tools.css), so it cannot clash with
// the main tab (sidepanel.js). Needs: i18n.js (HMI18N) and registry/buildLink.js (HMRegistry).
//
// Privacy: opening this tab sends nothing. "Look up" sends only the link the user typed or the link of the
// selected post, through our server, to the Internet Archive and the domain registry.
(function (root) {
  const { t } = root.HMI18N;
  const R = root.HMRegistry;

  const TB = {
    lang: "mn", view: "tools",             // view: tools | mongolia | habits
    input: "", post: null, pageUrl: "",
    role: "all", cat: "all", q: "", recent: [],
    ctx: {}, revealed: {}, loaded: false,
    reg: { tools: [], mongolia: null, lessons: null },
    host: null, opts: {},                  // host: element we render into
  };
  const T = (k, v) => t(TB.lang, k, v);
  const ROLES = ["all", "journalist", "editor", "researcher", "office"];
  const CATS = ["all", "images", "video", "claims", "sources", "archives", "ai-signals", "geolocation", "documents", "habits"];
  const VIEWS = ["tools", "mongolia", "habits"];

  // --- helpers ----------------------------------------------------------------------------------------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (R.isHttp(u || "") ? u : null);
  const tl = (tool, f) => (TB.lang === "mn" && tool.mn && tool.mn[f]) || tool[f] || "";
  const L = (o) => (o && (o[TB.lang] || o.en || o.mn)) || "";
  const OUT = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5h6.5V10M12.5 3.5L5 11"/></svg>`;
  const ext = (url, label, cls = "tb-open", extra = "") =>
    safeUrl(url) ? `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer" ${extra}>${esc(label)}${OUT}</a>` : "";
  const cachedTag = (d) => (d && d.cached ? `<span class="tb-cached">${esc(T("cached"))}</span>` : "");

  function claimQuery(text, n = 10) {
    const s = String(text || "").replace(/\[[^\]]+\]|https?:\/\/\S+|[^\p{L}\p{N}\s%-]/gu, " ");
    return s.split(/\s+/).filter(Boolean).slice(0, n).join(" ");
  }
  function ctxFromInput(raw) {
    const d = R.detectInput(raw);
    const c = { kind: d.kind, url: "", image_url: "", domain: "", text: "" };
    if (d.kind === "url") { c.url = d.value; c.domain = R.hostOf(d.value); }
    if (d.kind === "image_url") c.image_url = d.value;
    if (d.kind === "domain") c.domain = d.value;
    if (d.kind === "claim") c.text = d.value;
    return c;
  }
  function ctxFromPost(p) {
    const m = p.media || {};
    return { kind: "post", url: p.url || "", image_url: R.isHttp(m.src) ? m.src : "", domain: R.hostOf(p.url || ""),
             text: claimQuery(p.text || p.imageText), author: p.author || "" };
  }
  // What the box works on: what the user typed, else the selected post, else the current page
  function currentCtx() {
    if (TB.input.trim()) return ctxFromInput(TB.input);
    if (TB.post) return ctxFromPost(TB.post);
    return ctxFromInput(TB.pageUrl);
  }
  function valueFor(tool, ctx) {
    if (tool.id === "meta-ad-library") return ctx.author || "";
    if (tool.id === "mfcc-search") return claimQuery(ctx.text, 5);
    return R.valueFor(tool, ctx);
  }

  // --- tool cards -------------------------------------------------------------------------------------
  function toolCard(tool, ctx) {
    const value = ctx ? valueFor(tool, ctx) : "";
    let action = "", copy = "";
    if (tool.open.mode === "deeplink") {
      const link = R.buildLink(tool, value);
      if (link) action = ext(link.url, T("open"), "tb-open", `data-tool="${esc(tool.id)}"`);
      if (link && !link.prefilled && value) {
        copy = `<div class="tb-copy"><code>${esc(value)}</code><button class="tb-btn" type="button" data-tb="copy" data-v="${esc(value)}">${esc(T("copy"))}</button></div>
                <p class="tb-note">${esc(T("not_prefilled"))}</p>`;
      }
    } else if (tool.open.mode === "api") {
      action = `<button class="tb-open" type="button" data-tb="tool-api" data-tool="${esc(tool.id)}">${esc(T("in_panel"))}</button>`;
    } else {
      action = `<button class="tb-open" type="button" data-tb="route" data-route="${esc(tool.open.route)}" data-tool="${esc(tool.id)}">${esc(T("in_panel"))}</button>`;
    }
    const chips = [
      `<span class="tb-chip">${esc(T(`cost_${tool.cost}`))}</span>`,
      tool.needsLogin ? `<span class="tb-chip">${esc(T("needs_login"))}</span>` : "",
      tool.status !== "ok" ? `<span class="tb-chip">${esc(T(`status_${tool.status}`))}</span>` : "",
    ].join("");
    return `<article class="tb-tool">
      <div class="tb-tool-top"><div class="tb-tool-name">${esc(tl(tool, "name"))}${tool.subtitle ? `<div class="tb-sub">${esc(tool.subtitle)}</div>` : ""}</div>${action}</div>
      <p class="tb-desc">${esc(tl(tool, "description"))}</p>
      <p class="tb-lim"><b>${esc(T("limits"))}</b> ${esc(tl(tool, "limits"))}</p>
      <div class="tb-chips">${chips}</div>${copy}
    </article>`;
  }

  // Tools that can use what we have, most specific first
  function suggested(ctx, max = 6) {
    const order = { image_url: 0, claim: 1, text: 1, url: 2, domain: 3 };
    return TB.reg.tools
      .filter((x) => x.open.mode === "deeplink" && x.input !== "none" && x.status !== "broken" && x.open.template.includes("{U}") && valueFor(x, ctx))
      .sort((a, b) => (order[a.input] ?? 9) - (order[b.input] ?? 9))
      .slice(0, max);
  }

  // --- lookup cards (through background.js -> /api/wayback, /api/rdap) ----------------------------------
  const lookupKinds = (ctx) => [ctx.url && ["wayback", ctx.url], ctx.domain && ["rdap", ctx.domain]].filter(Boolean);

  function lookup() {
    for (const [kind, value] of lookupKinds(currentCtx())) {
      const k = `${kind}:${value}`;
      if (TB.ctx[k] && !TB.ctx[k].loading && TB.ctx[k].ok) continue;
      TB.ctx[k] = { loading: true };
      chrome.runtime.sendMessage({ type: "context", kind, value }, (r) => {
        TB.ctx[k] = r || { ok: false, reason: "offline" };
        update();
      });
    }
    update();
  }

  const toolLimits = (id) => tl(TB.reg.tools.find((x) => x.id === id) || {}, "limits");

  function archiveCard(value, d) {
    const fallback = (d && d.fallback_url) || `https://web.archive.org/web/*/${value}`;
    let body;
    if (d.loading) body = `<p class="tb-note">${esc(T("checking"))}</p>`;
    else if (d.ok && d.archived) {
      body = `<dl class="tb-kv">
        ${d.first ? `<dt>${esc(T("archive_first"))}</dt><dd>${ext(d.first.url, d.first.date || "", "tb-link")}</dd>` : ""}
        ${d.latest ? `<dt>${esc(T("archive_latest"))}</dt><dd>${ext(d.latest.url, d.latest.date || "", "tb-link")}</dd>` : ""}</dl>`;
    } else if (d.ok) body = `<p class="tb-note">${esc(T("archive_none"))}</p>`;
    else body = `<p class="tb-note">${esc(T(d.reason === "rate_limited" ? "archive_rate" : "card_failed"))}</p>`;
    return `<section class="tb-card"><h3>${esc(T("card_archive"))}</h3>${cachedTag(d)}${body}
      <p class="tb-lim">${esc(toolLimits("wayback"))}</p>${ext(d.history_url || fallback, T("open_directly"), "tb-link")}</section>`;
  }

  function domainCard(value, d) {
    const whois = d.whois_url || d.fallback_url || `https://www.whois.com/whois/${encodeURIComponent(value)}`;
    let body;
    if (d.loading) body = `<p class="tb-note">${esc(T("checking"))}</p>`;
    else if (d.ok) {
      body = `<dl class="tb-kv"><dt>Domain</dt><dd>${esc(d.domain)}</dd>
        ${d.registered ? `<dt>${esc(T("registered"))}</dt><dd>${esc(d.registered)}</dd>` : ""}
        ${d.registrar ? `<dt>${esc(T("registrar"))}</dt><dd>${esc(d.registrar)}</dd>` : ""}
        ${d.expires ? `<dt>${esc(T("expires"))}</dt><dd>${esc(d.expires)}</dd>` : ""}</dl>`;
    } else body = `<p class="tb-note">${esc(T(d.reason === "no_rdap_for_tld" ? "rdap_none" : "card_failed"))}</p>`;
    return `<section class="tb-card"><h3>${esc(T("card_domain"))}</h3>${cachedTag(d)}${body}
      <p class="tb-lim">${esc(toolLimits("rdap"))}</p>${ext(whois, "WHOIS", "tb-link")}</section>`;
  }

  function contextCards(ctx) {
    return lookupKinds(ctx).map(([kind, value]) => {
      const d = TB.ctx[`${kind}:${value}`];
      if (!d) return "";
      return kind === "wayback" ? archiveCard(value, d) : domainCard(value, d);
    }).join("");
  }

  // --- views ------------------------------------------------------------------------------------------
  function inputBlock() {
    const ctx = currentCtx();
    const typed = TB.input.trim();
    const source = typed ? (ctx.kind !== "none" ? T(`kind_${ctx.kind}`) : "") : (TB.post ? T("from_post") : (TB.pageUrl ? T("from_page") : ""));
    const busy = lookupKinds(ctx).some(([k, v]) => TB.ctx[`${k}:${v}`]?.loading);
    const sug = suggested(ctx);
    return `<label class="tb-lbl" for="tb-inp">${esc(T("input_label"))}</label>
      <textarea id="tb-inp" placeholder="${esc(T("input_ph"))}" spellcheck="false">${esc(TB.input)}</textarea>
      <div id="tb-dyn" class="tb-sec">${dynBlock(ctx, source, busy, sug)}</div>`;
  }
  function dynBlock(ctx, source, busy, sug) {
    return `${source ? `<span class="tb-chip">${esc(source)}</span>` : ""}
      ${lookupKinds(ctx).length ? `<div class="tb-row"><button class="tb-btn" type="button" data-tb="lookup" ${busy ? "disabled" : ""}>${esc(T("lookup"))}</button></div>
        <p class="tb-note">${esc(T("lookup_note"))}</p>` : ""}
      ${contextCards(ctx)}
      ${sug.length ? `<div class="tb-tools">${sug.map((x) => toolCard(x, ctx)).join("")}</div>` : ""}`;
  }
  function refreshDyn() {
    const el = TB.host && TB.host.querySelector("#tb-dyn");
    if (!el) return;
    const ctx = currentCtx(), typed = TB.input.trim();
    const source = typed ? (ctx.kind !== "none" ? T(`kind_${ctx.kind}`) : "") : (TB.post ? T("from_post") : (TB.pageUrl ? T("from_page") : ""));
    el.innerHTML = dynBlock(ctx, source, lookupKinds(ctx).some(([k, v]) => TB.ctx[`${k}:${v}`]?.loading), suggested(ctx));
  }

  function toolList() {
    const ctx = currentCtx();
    const q = TB.q.trim().toLowerCase();
    const list = TB.reg.tools.filter((x) =>
      (TB.role === "all" || x.audiences.includes(TB.role)) &&
      (TB.cat === "all" || x.categories.includes(TB.cat)) &&
      (!q || [x.name, x.subtitle, x.description, x.mn && x.mn.name, x.mn && x.mn.description].join(" ").toLowerCase().includes(q)));
    return list.length ? list.map((x) => toolCard(x, ctx)).join("") : `<p class="tb-note">${esc(T("no_tools"))}</p>`;
  }

  function toolsView() {
    const recent = TB.recent.map((id) => TB.reg.tools.find((x) => x.id === id)).filter(Boolean);
    const chip = (key, v, label) => `<button class="tb-btn tb-pill" type="button" data-tb="${key}" data-v="${v}" aria-pressed="${TB[key] === v}">${esc(label)}</button>`;
    return `${inputBlock()}
      <div class="tb-sec"><input id="tb-q" type="search" class="tb-search" placeholder="${esc(T("tools_search"))}" value="${esc(TB.q)}" aria-label="${esc(T("tools_search"))}">
        <div class="tb-chips" role="group">${ROLES.map((r) => chip("role", r, T(`role_${r}`))).join("")}</div>
        <div class="tb-chips" role="group">${CATS.map((c) => chip("cat", c, T(`cat_${c}`))).join("")}</div></div>
      ${recent.length ? `<div class="tb-sec"><h3 class="tb-h">${esc(T("recent_h"))}</h3><div class="tb-chips">${recent.map((x) =>
        `<button class="tb-btn tb-pill" type="button" data-tb="search-tool" data-v="${esc(x.id)}">${esc(tl(x, "name"))}</button>`).join("")}</div></div>` : ""}
      <div class="tb-tools" id="tb-list">${toolList()}</div>`;
  }

  function mongoliaView() {
    const m = TB.reg.mongolia;
    if (!m) return `<p class="tb-note">${esc(T("card_failed"))}</p>`;
    return m.groups.map((g) => `<section class="tb-sec"><h3 class="tb-h">${esc(L(g.title))}</h3>${g.items.map((it) => `
      <article class="tb-card"><h4>${esc(L(it.name))}</h4>
        <p class="tb-desc">${esc(L(it.text))}</p>
        ${it.label ? `<span class="tb-chip">${it.label_url ? ext(it.label_url, L(it.label), "tb-link") : esc(L(it.label))}</span>` : ""}
        ${it.note ? `<p class="tb-note">${esc(L(it.note))}</p>` : ""}
        ${!it.verified ? `<span class="tb-chip">${esc(T("status_unverified"))}</span>` : ""}
        ${it.url ? ext(it.url, new URL(it.url).hostname, "tb-link") : ""}
      </article>`).join("")}</section>`).join("");
  }

  function habitsView() {
    const l = TB.reg.lessons, lang = TB.lang;
    if (!l) return `<p class="tb-note">${esc(T("card_failed"))}</p>`;
    const sift = `<section class="tb-sec" id="tb-sift"><h3 class="tb-h">${esc(L(l.sift.title))}</h3><ol class="tb-steps">${l.sift.steps.map((s) =>
      `<li><span class="tb-k">${esc(s.key)}</span><span><b>${esc(s[lang][0])}</b><br>${esc(s[lang][1])}</span></li>`).join("")}</ol>
      ${ext(l.sift.attribution.url, l.sift.attribution.text, "tb-link")}</section>`;
    const tactics = `<section class="tb-sec"><h3 class="tb-h">${esc(T("tactic_h"))}</h3>${l.tactics.map((x) => {
      const c = x[lang];
      return `<article class="tb-card"><blockquote class="tb-quote">${esc(c.post)}</blockquote><b>${esc(c.q)}</b>
        ${TB.revealed[x.id] ? `<p>${esc(c.a)}</p>` : `<button class="tb-btn" type="button" data-tb="reveal" data-v="${esc(x.id)}">${esc(T("show_answer"))}</button>`}</article>`;
    }).join("")}</section>`;
    const ifcn = `<section class="tb-sec" id="tb-ifcn"><h3 class="tb-h">${esc(L(l.ifcn.title))}</h3><ol class="tb-list">${l.ifcn.items.map((i) =>
      `<li>${esc(i[lang])}</li>`).join("")}</ol><p class="tb-note">${esc(T("ifcn_note"))}</p>${ext(l.ifcn.source, "IFCN", "tb-link")}</section>`;
    return sift + tactics + ifcn;
  }

  // --- shell ------------------------------------------------------------------------------------------
  function html() {
    const body = !TB.loaded ? `<p class="tb-note">${esc(T("checking"))}</p>`
      : TB.view === "mongolia" ? mongoliaView() : TB.view === "habits" ? habitsView() : toolsView();
    return `<section class="tb" aria-label="${esc(T("box_title"))}">
      <header class="tb-head"><strong>${esc(T("box_title"))}</strong>
        <button class="tb-lang" type="button" data-tb="lang" aria-label="${esc(T("lang_switch_aria"))}">${esc(T("lang_switch"))}</button></header>
      <nav class="tb-nav" role="tablist">${VIEWS.map((v) =>
        `<button class="tb-tab" role="tab" type="button" data-tb="view" data-v="${v}" aria-selected="${TB.view === v}">${esc(T(`tab_${v}`))}</button>`).join("")}</nav>
      <div class="tb-body">${body}</div></section>`;
  }

  function update() { if (TB.host && TB.host.querySelector(".tb")) { render(); } }
  // The panel animates #app's children on every render; only the first draw of the box should play it
  function render() {
    if (!TB.host) return;
    TB.host.classList.toggle("still", TB.drawn);
    TB.host.innerHTML = html();
    TB.drawn = true;
  }

  function remember(id) {
    if (!id) return;
    TB.recent = [id, ...TB.recent.filter((x) => x !== id)].slice(0, 6);
    try { chrome.storage.local.set({ tbRecent: TB.recent }); } catch { /* tool ids only, never the input */ }
  }

  // --- events (delegated from the side panel's #app, so they survive re-renders) -----------------------
  async function onClick(e) {
    const a = e.target.closest("a[data-tool]");
    if (a) remember(a.dataset.tool);
    const el = e.target.closest("[data-tb]");
    if (!el || !e.target.closest(".tb")) return;
    const act = el.dataset.tb, v = el.dataset.v;
    if (act === "view") { TB.view = v; render(); }
    if (act === "lang") { TB.lang = TB.lang === "mn" ? "en" : "mn"; try { chrome.storage.local.set({ tbLang: TB.lang }); } catch {} render(); }
    if (act === "role" || act === "cat") { TB[act] = v; render(); }
    if (act === "search-tool") { TB.q = (TB.reg.tools.find((x) => x.id === v) || {}).name || ""; render(); }
    if (act === "reveal") { TB.revealed[v] = true; render(); }
    if (act === "lookup") lookup();
    if (act === "tool-api") {
      remember(el.dataset.tool);
      if (el.dataset.tool === "checker") { if (TB.opts.onGoMain) TB.opts.onGoMain(); }   // our checker lives in the main tab
      else { TB.view = "tools"; lookup(); }
    }
    if (act === "route") {
      remember(el.dataset.tool);
      const r = el.dataset.route;
      TB.view = r === "mongolia" ? "mongolia" : "habits";
      render();
      const anchor = r.split("/")[1];
      if (anchor) TB.host.querySelector(`#tb-${anchor}`)?.scrollIntoView();
    }
    if (act === "copy") {
      try { await navigator.clipboard.writeText(v); el.textContent = T("copied"); } catch { /* clipboard blocked: the text is visible */ }
    }
  }
  function onInput(e) {
    if (!e.target.closest(".tb")) return;
    if (e.target.id === "tb-inp") { TB.input = e.target.value; refreshDyn(); }
    if (e.target.id === "tb-q") { TB.q = e.target.value; const l = TB.host.querySelector("#tb-list"); if (l) l.innerHTML = toolList(); }
  }

  async function loadReg() {
    const get = async (f) => { try { return await (await fetch(chrome.runtime.getURL(`registry/${f}`))).json(); } catch { return null; } };
    const [tools, mongolia, lessons] = await Promise.all(["tools.json", "mongolia.json", "lessons.json"].map(get));
    TB.reg = { tools: tools || [], mongolia, lessons };
    const st = await chrome.storage.local.get(["tbLang", "tbRecent"]);
    TB.lang = st.tbLang || "mn";
    TB.recent = st.tbRecent || [];
    TB.loaded = true;
  }

  // Public API used by sidepanel.js
  root.HMTools = {
    // Draw the box into `host`. opts: { post, onGoMain }
    async mount(host, opts = {}) {
      TB.host = host; TB.opts = opts; TB.post = opts.post || null; TB.drawn = false;
      render();
      if (!TB.loaded) { await loadReg(); }
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        TB.pageUrl = tab && R.isHttp(tab.url || "") ? tab.url : "";
      } catch { TB.pageUrl = ""; }
      if (TB.host === host) render();
    },
    attach(app) { app.addEventListener("click", onClick); app.addEventListener("input", onInput); },
  };
})(globalThis);
