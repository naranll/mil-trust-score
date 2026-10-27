// Tools tab (tab 2 of the side panel). Icon-first, compact, almost no body text:
//   yellow top band with one input  ->  role row  ->  "now" row (tools ready for your input)  ->  12 tiles.
// Press a tile to see its tools, press a tool to see what it can't tell you and one big Open button.
// Renders the shared registry (registry/*.json). Everything is scoped under .tb (tools.css).
// Needs: i18n.js (HMI18N) and registry/buildLink.js (HMRegistry).
//
// Privacy: opening this tab sends nothing. "Look up" (or opening Wayback / RDAP) sends only the link the user
// typed or the link of the selected post, through our server, to the Internet Archive and the domain registry.
(function (root) {
  const { t } = root.HMI18N;
  const R = root.HMRegistry;

  // Home grid: [id, emoji]. No robots, brains, sparkles, red crosses or flag emoji (design system v3).
  const TILES = [
    ["images", "🖼️"], ["video", "🎬"], ["claims", "💬"], ["sources", "🌐"],
    ["archives", "🕰️"], ["ai-signals", "🏷️"], ["geolocation", "📍"], ["documents", "🗂️"],
    ["habits", "💡"], ["mongolia", "🐎"], ["recent", "🕘"], ["all", "🧩"],
  ];
  const ROLES = [["all", "👥"], ["journalist", "📰"], ["editor", "✍️"], ["researcher", "🎓"], ["office", "🏢"]];
  const SIFT_ICONS = ["✋", "🔎", "📰", "🧵"];
  const KIND_ICON = { url: "🔗", image_url: "🖼️", domain: "🌐", claim: "💬", none: "🔗", post: "📌" };

  const TB = {
    lang: "mn", nav: { view: "home", cat: null }, sel: null,
    input: "", post: null, pageUrl: "", role: "all", recent: [],
    ctx: {}, practice: 0, revealed: false,
    loaded: false, drawn: false, reg: { tools: [], mongolia: null, lessons: null }, host: null, opts: {},
  };
  const T = (k, v) => t(TB.lang, k, v);

  // --- helpers ----------------------------------------------------------------------------------------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (R.isHttp(u || "") ? u : null);
  const tl = (tool, f) => (TB.lang === "mn" && tool.mn && tool.mn[f]) || tool[f] || "";
  const L = (o) => (typeof o === "string" ? o : (o && (o[TB.lang] || o.en || o.mn)) || "");
  // Outline icons: 24px grid, 2px stroke, round caps and joins (design system v3). Icon-only buttons carry aria-labels.
  const I = {
    out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/></svg>',
  };
  const ext = (url, label, cls, extra = "") =>
    safeUrl(url) ? `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer" ${extra}>${label}${I.out}</a>` : "";
  const roleOk = (x) => TB.role === "all" || (x.audiences || []).includes(TB.role);

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
  // What the tab works on: what the user typed, else the selected post, else the current page
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
  const ready = (tool, ctx) => tool.input !== "none" && !!valueFor(tool, ctx) &&
    (tool.open.mode === "api" ? ["wayback", "rdap"].includes(tool.open.adapter) : tool.open.template.includes("{U}"));
  const toolById = (id) => TB.reg.tools.find((x) => x.id === id);

  // --- lookups (background.js -> /api/wayback, /api/rdap) ---------------------------------------------
  const lookupKinds = (ctx) => [ctx.url && ["wayback", ctx.url], ctx.domain && ["rdap", ctx.domain]].filter(Boolean);
  function lookup(kinds) {
    for (const [kind, value] of kinds) {
      const k = `${kind}:${value}`;
      if (TB.ctx[k] && (TB.ctx[k].loading || TB.ctx[k].ok)) continue;
      TB.ctx[k] = { loading: true };
      chrome.runtime.sendMessage({ type: "context", kind, value }, (r) => {
        TB.ctx[k] = r || { ok: false, reason: "offline" };
        renderView();
      });
    }
    renderView();
  }

  // Compact result card: icons and dates, no sentences
  function resultCard(kind, value) {
    const d = TB.ctx[`${kind}:${value}`];
    if (!d) return "";
    const cached = d.cached ? `<span class="tb-cached" title="${esc(T("cached"))}">💾 ${esc(T("cached"))}</span>` : "";
    if (d.loading) return `<div class="tb-res"><span class="tb-spin" aria-hidden="true"></span>${esc(T("checking"))}</div>`;
    if (kind === "wayback") {
      const body = d.ok && d.archived
        ? `<span class="tb-res-ico">🕰️</span>${ext(d.first && d.first.url, esc((d.first && d.first.date) || "—"), "tb-link")}<span aria-hidden="true">→</span>${ext(d.latest && d.latest.url, esc((d.latest && d.latest.date) || "—"), "tb-link")}`
        : `<span class="tb-res-ico">🕰️</span><span class="tb-dim">${esc(T(d.ok ? "archive_none" : d.reason === "rate_limited" ? "archive_rate" : "card_failed"))}</span>${ext(d.history_url || d.fallback_url || `https://web.archive.org/web/*/${value}`, "", "tb-link tb-link-ico")}`;
      return `<div class="tb-res">${body}${cached}</div>`;
    }
    const body = d.ok
      ? `<span class="tb-res-ico">📅</span><b>${esc(d.registered || "—")}</b>${d.registrar ? `<span class="tb-dim">· ${esc(d.registrar)}</span>` : ""}`
      : `<span class="tb-res-ico">📅</span><span class="tb-dim">${esc(T(d.reason === "no_rdap_for_tld" ? "rdap_none" : "card_failed"))}</span>${ext(d.whois_url || d.fallback_url || `https://www.whois.com/whois/${encodeURIComponent(value)}`, "WHOIS", "tb-link")}`;
    return `<div class="tb-res">${body}${cached}</div>`;
  }

  // --- tiles and sheets -------------------------------------------------------------------------------
  const toolTile = (tool, ctx, cls = "") => `<button class="tb-tile ${cls}" type="button" data-tb="pick" data-v="${esc(tool.id)}" aria-pressed="${TB.sel === tool.id}" aria-label="${esc(tool.short)}: ${esc(tl(tool, "name"))}">
      <span class="tb-ico" aria-hidden="true">${tool.icon}</span><span class="tb-lab">${esc(tool.short)}</span>${ready(tool, ctx) ? '<i class="tb-dot" aria-hidden="true"></i>' : ""}</button>`;

  function toolSheet(tool, ctx) {
    const value = valueFor(tool, ctx);
    const chips = [
      `<span class="tb-chip">${esc(T(`cost_${tool.cost}`))}</span>`,
      tool.needsLogin ? `<span class="tb-chip">🔑 ${esc(T("needs_login"))}</span>` : "",
      tool.status !== "ok" ? `<span class="tb-chip" title="${esc(T(`status_${tool.status}`))}">🚧</span>` : "",
    ].join("");
    let act = "", extra = "";
    if (tool.open.mode === "deeplink") {
      const link = R.buildLink(tool, value);
      if (link) act = ext(link.url, esc(T("open")), "tb-cta", `data-tool="${esc(tool.id)}"`);
      if (link && !link.prefilled && value) {
        extra = `<div class="tb-copy"><code>${esc(value)}</code><button class="tb-btn" type="button" data-tb="copy" data-v="${esc(value)}">${I.copy}${esc(T("copy"))}</button></div>
          <p class="tb-hint">${esc(T("paste_hint"))}</p>`;
      }
    } else if (tool.open.mode === "api") {
      if (tool.open.adapter === "checker") {
        act = `<button class="tb-cta" type="button" data-tb="main" data-tool="${esc(tool.id)}">${esc(T("open"))}</button>`;
      } else if (value) {
        extra = resultCard(tool.open.adapter, value) + `<p class="tb-hint">🔒 ${esc(T("sent_note"))}</p>`;
      } else {
        extra = `<p class="tb-hint">${KIND_ICON[tool.input] || "🔗"} ${esc(T("find_ph"))}</p>`;
      }
    } else {
      act = `<button class="tb-cta" type="button" data-tb="route" data-route="${esc(tool.open.route)}" data-tool="${esc(tool.id)}">${esc(T("open"))}</button>`;
    }
    return `<section class="tb-sheet" aria-live="polite">
      <div class="tb-sheet-head"><span class="tb-ico big" aria-hidden="true">${tool.icon}</span>
        <div class="tb-sheet-name"><b>${esc(tl(tool, "name"))}</b><div class="tb-chips">${chips}</div></div>
        <button class="tb-x" type="button" data-tb="close" aria-label="${esc(T("close_aria"))}">${I.x}</button></div>
      <p class="tb-warn"><span aria-hidden="true">⚠️</span>${esc(tl(tool, "limits"))}</p>
      ${extra}${act}</section>`;
  }

  // --- views ------------------------------------------------------------------------------------------
  function roleRow() {
    return `<div class="tb-roles" role="group">${ROLES.map(([r, e]) =>
      `<button class="tb-role" type="button" data-tb="role" data-v="${r}" aria-pressed="${TB.role === r}"><span aria-hidden="true">${e}</span>${esc(T(`rs_${r}`))}</button>`).join("")}</div>`;
  }

  function nowRow(ctx) {
    const tools = TB.reg.tools.filter((x) => roleOk(x) && ready(x, ctx))
      .sort((a, b) => ({ image_url: 0, claim: 1, text: 1, url: 2, domain: 3 }[a.input] ?? 9) - ({ image_url: 0, claim: 1, text: 1, url: 2, domain: 3 }[b.input] ?? 9))
      .slice(0, 4);
    if (!tools.length) return "";
    const tiles = tools.map((x) => {
      if (x.open.mode === "deeplink") {
        const link = R.buildLink(x, valueFor(x, ctx));
        if (link && link.prefilled) {
          return `<a class="tb-tile tb-now" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer" data-tool="${esc(x.id)}" aria-label="${esc(x.short)}: ${esc(T("open"))}">
            <span class="tb-ico" aria-hidden="true">${x.icon}</span><span class="tb-lab">${esc(x.short)}</span>${I.out}</a>`;
        }
      }
      return toolTile(x, ctx, "tb-now");
    }).join("");
    return `<section class="tb-sec"><h3 class="tb-h">⚡ ${esc(T("quick_h"))}</h3><div class="tb-now-row">${tiles}</div>
      ${lookupKinds(ctx).map(([k, v]) => resultCard(k, v)).join("")}</section>`;
  }

  function homeView(ctx) {
    const tiles = TILES.map(([id, e]) => `<button class="tb-tile" type="button" data-tb="nav" data-v="${id}"><span class="tb-ico" aria-hidden="true">${e}</span>
        <span class="tb-lab">${esc(T(`tile_${id}`))}</span></button>`).join("");
    return `${roleRow()}${nowRow(ctx)}<div class="tb-grid tb-grid4">${tiles}</div>`;
  }

  const barRow = (icon, title) => `<div class="tb-bar"><button class="tb-back" type="button" data-tb="home" aria-label="${esc(T("back_aria"))}">${I.back}</button>
    <h3 class="tb-bar-title"><span aria-hidden="true">${icon}</span> ${esc(title)}</h3></div>`;

  function listView(ctx) {
    const { view, cat } = TB.nav;
    let tools, icon, title, cls = "";
    if (view === "recent") {
      tools = TB.recent.map(toolById).filter((x) => x && roleOk(x)); icon = "🕘"; title = T("tile_recent");
    } else if (view === "all") {
      tools = TB.reg.tools.filter(roleOk); icon = "🧩"; title = T("tile_all"); cls = "tb-grid4";
    } else {
      tools = TB.reg.tools.filter((x) => x.categories.includes(cat) && roleOk(x));
      icon = (TILES.find(([id]) => id === cat) || [0, "🧰"])[1]; title = T(`tile_${cat}`);
    }
    const sel = TB.sel && toolById(TB.sel);
    return `${barRow(icon, title)}
      ${tools.length ? `<div class="tb-grid ${cls}">${tools.map((x) => toolTile(x, ctx)).join("")}</div>` : `<p class="tb-empty" aria-hidden="true">${icon}</p>`}
      ${sel ? toolSheet(sel, ctx) : ""}`;
  }

  function mongoliaView() {
    const m = TB.reg.mongolia;
    const items = m ? m.groups.flatMap((g) => g.items) : [];
    const sel = items.find((x) => x.id === TB.sel);
    return `${barRow("🐎", T("tile_mongolia"))}
      <div class="tb-grid">${items.map((it) => `<button class="tb-tile" type="button" data-tb="pickmn" data-v="${esc(it.id)}" aria-pressed="${TB.sel === it.id}" aria-label="${esc(L(it.name))}">
        <span class="tb-ico" aria-hidden="true">${it.icon}</span><span class="tb-lab">${esc(L(it.short))}</span></button>`).join("")}</div>
      ${sel ? `<section class="tb-sheet" aria-live="polite"><div class="tb-sheet-head"><span class="tb-ico big" aria-hidden="true">${sel.icon}</span>
          <div class="tb-sheet-name"><b>${esc(L(sel.name))}</b>${sel.label ? `<div class="tb-chips"><span class="tb-chip">${sel.label_url ? ext(sel.label_url, esc(L(sel.label)), "tb-link") : esc(L(sel.label))}</span></div>` : ""}</div>
          <button class="tb-x" type="button" data-tb="close" aria-label="${esc(T("close_aria"))}">${I.x}</button></div>
        <p class="tb-desc">${esc(L(sel.text))}</p>
        ${sel.note ? `<p class="tb-warn"><span aria-hidden="true">⚠️</span>${esc(L(sel.note))}</p>` : ""}
        ${sel.url ? ext(sel.url, esc(new URL(sel.url).hostname), "tb-cta") : ""}</section>` : ""}`;
  }

  function habitsView() {
    const l = TB.reg.lessons, lang = TB.lang;
    if (!l) return barRow("💡", T("tile_habits"));
    const [kind, idx] = String(TB.sel || "").split(":");
    let sheet = "";
    if (kind === "sift" && l.sift.steps[+idx]) {
      const s = l.sift.steps[+idx];
      sheet = `<b>${esc(s.key)} ${SIFT_ICONS[+idx]} ${esc(s[lang][0])}</b><p class="tb-desc">${esc(s[lang][1])}</p>`;
    } else if (kind === "ifcn" && l.ifcn.items[+idx]) {
      sheet = `<b>📋 ${+idx + 1}. ${esc(l.ifcn.items[+idx][lang])}</b>`;
    }
    const tc = l.tactics[TB.practice % l.tactics.length], c = tc[lang];
    return `${barRow("💡", T("tile_habits"))}
      <section class="tb-sec"><h3 class="tb-h">🧭 SIFT</h3>
        <div class="tb-letters" role="group">${l.sift.steps.map((s, i) => `<button class="tb-letter" type="button" data-tb="hab" data-v="sift:${i}" aria-pressed="${TB.sel === `sift:${i}`}" aria-label="${esc(s[lang][0])}">
          <b>${esc(s.key)}</b><span aria-hidden="true">${SIFT_ICONS[i]}</span></button>`).join("")}</div>
        <h3 class="tb-h">📋 IFCN</h3>
        <div class="tb-letters" role="group">${l.ifcn.items.map((it, i) => `<button class="tb-letter small" type="button" data-tb="hab" data-v="ifcn:${i}" aria-pressed="${TB.sel === `ifcn:${i}`}" aria-label="${esc(it[lang])}"><b>${i + 1}</b></button>`).join("")}</div>
        ${sheet ? `<section class="tb-sheet" aria-live="polite">${sheet}</section>` : ""}</section>
      <section class="tb-sec"><h3 class="tb-h">🎯 ${esc(T("practice_h"))}</h3>
        <article class="tb-card"><blockquote class="tb-quote">${esc(c.post)}</blockquote><b>🤔 ${esc(c.q)}</b>
          ${TB.revealed ? `<p class="tb-desc">${esc(c.a)}</p>` : ""}
          <div class="tb-row"><button class="tb-btn" type="button" data-tb="reveal" ${TB.revealed ? "disabled" : ""}>👀 ${esc(T("reveal"))}</button>
            <button class="tb-btn" type="button" data-tb="next" aria-label="next">${(TB.practice % l.tactics.length) + 1}/${l.tactics.length} ›</button></div></article></section>`;
  }

  function viewHtml() {
    if (!TB.loaded) return `<p class="tb-empty" aria-hidden="true">⏳</p>`;
    const ctx = currentCtx();
    switch (TB.nav.view) {
      case "home": return homeView(ctx);
      case "mongolia": return mongoliaView();
      case "habits": return habitsView();
      default: return listView(ctx);   // cat | recent | all
    }
  }

  // --- shell: hero (static) + view (re-rendered) ------------------------------------------------------
  function kindIcon() {
    if (TB.input.trim()) return KIND_ICON[ctxFromInput(TB.input).kind] || "🔗";
    return TB.post ? KIND_ICON.post : (TB.pageUrl ? "🌐" : "🔗");
  }

  function heroHtml() {
    return `<header class="tb-top">
      <div class="tb-find"><label class="tb-find-box"><span id="tb-kind" aria-hidden="true">${kindIcon()}</span>
        <input id="tb-inp" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="${esc(T("find_ph"))}" aria-label="${esc(T("input_label"))}" value="${esc(TB.input)}"></label>
        <button class="tb-go" type="button" data-tb="go">${I.search}${esc(T("go"))}</button>
        <button class="tb-lang" type="button" data-tb="lang" aria-label="${esc(T("lang_switch_aria"))}">${esc(T("lang_switch"))}</button></div>
      <p class="tb-how" aria-hidden="true"><span>1 🔗 ${esc(T("how_1"))}</span><span>2 👆 ${esc(T("how_2"))}</span><span>3 ↗ ${esc(T("how_3"))}</span></p>
    </header>`;
  }

  function fullHtml() {
    return `<section class="tb" aria-label="${esc(T("box_title"))}">${heroHtml()}<div class="tb-body" id="tb-view">${viewHtml()}</div></section>`;
  }
  function render() {
    if (!TB.host) return;
    TB.host.classList.toggle("still", TB.drawn);      // the panel's entrance animation plays once only
    TB.host.innerHTML = fullHtml();
    TB.drawn = true;
  }
  function renderView() {
    const v = TB.host && TB.host.querySelector("#tb-view");
    if (!v) return;
    v.innerHTML = viewHtml();
    const k = TB.host.querySelector("#tb-kind"); if (k) k.textContent = kindIcon();
    v.querySelector(".tb-sheet")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function remember(id) {
    if (!id) return;
    TB.recent = [id, ...TB.recent.filter((x) => x !== id)].slice(0, 8);
    try { chrome.storage.local.set({ tbRecent: TB.recent }); } catch { /* tool ids only, never the input */ }
  }
  const go = (view, cat = null) => { TB.nav = { view, cat }; TB.sel = null; TB.revealed = false; renderView(); };

  // --- events (delegated from the side panel's #app, so they survive its re-renders) ------------------
  async function onClick(e) {
    const a = e.target.closest("a[data-tool]");
    if (a) remember(a.dataset.tool);
    const el = e.target.closest("[data-tb]");
    if (!el || !e.target.closest(".tb")) return;
    const act = el.dataset.tb, v = el.dataset.v;
    if (act === "lang") { TB.lang = TB.lang === "mn" ? "en" : "mn"; try { chrome.storage.local.set({ tbLang: TB.lang }); } catch {} render(); return; }
    if (act === "role") { TB.role = v; renderView(); }
    if (act === "home") go("home");
    if (act === "nav") {
      if (["mongolia", "habits", "recent", "all"].includes(v)) go(v); else go("cat", v);
    }
    if (act === "pick") {
      TB.sel = TB.sel === v ? null : v;
      const tool = toolById(v);
      if (TB.sel && tool && tool.open.mode === "api" && ["wayback", "rdap"].includes(tool.open.adapter)) {
        remember(v);
        const value = valueFor(tool, currentCtx());
        if (value) { lookup([[tool.open.adapter, value]]); return; }   // pressing the tool is the explicit action
      }
      renderView();
    }
    if (act === "pickmn" || act === "hab") { TB.sel = TB.sel === v ? null : v; renderView(); }
    if (act === "close") { TB.sel = null; renderView(); }
    if (act === "go") {
      const kinds = lookupKinds(currentCtx());
      if (kinds.length) lookup(kinds); else TB.host.querySelector("#tb-inp")?.focus();
    }
    if (act === "main") { remember(el.dataset.tool); if (TB.opts.onGoMain) TB.opts.onGoMain(); }
    if (act === "route") {
      remember(el.dataset.tool);
      const r = el.dataset.route;
      if (r === "mongolia") go("mongolia"); else { go("habits"); }
    }
    if (act === "reveal") { TB.revealed = true; renderView(); }
    if (act === "next") { TB.practice += 1; TB.revealed = false; renderView(); }
    if (act === "copy") {
      try { await navigator.clipboard.writeText(v); el.textContent = T("copied"); } catch { /* clipboard blocked: the text is visible */ }
    }
  }
  function onInput(e) {
    if (e.target.id !== "tb-inp" || !e.target.closest(".tb")) return;
    TB.input = e.target.value;
    renderView();
  }
  function onKey(e) {
    if (e.key === "Enter" && e.target.id === "tb-inp") TB.host.querySelector("[data-tb=go]")?.click();
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

  root.HMTools = {
    // Draw the tab into `host`. opts: { post, onGoMain }
    async mount(host, opts = {}) {
      TB.host = host; TB.opts = opts; TB.post = opts.post || null; TB.drawn = false;
      render();
      if (!TB.loaded) await loadReg();
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        TB.pageUrl = tab && R.isHttp(tab.url || "") ? tab.url : "";
      } catch { TB.pageUrl = ""; }
      if (TB.host === host) render();
    },
    attach(app) { app.addEventListener("click", onClick); app.addEventListener("input", onInput); app.addEventListener("keydown", onKey); },
  };
})(globalThis);
