// Хажуугийн самбар — сонгосон постын оноо, гол шалтгаан, шалгах хэрэгсэл, өөрөөсөө асуух асуултууд.
// Өгөгдөл: content.js (тэмдэг дарах) → background.js → storage.session["sel:<tabId>"] → энд.

const app = document.getElementById("app");
const gear = document.getElementById("gear");
let tabId = null, winId = null, post = null, online = null, showServer = false;

// Замын тэмдгийн хэлбэр (content.js-тэй ижил): f = дүүргэлт, s = доторх зураас
const SHAPE = {
  ok:   '<circle class="f" cx="8" cy="8" r="6.5"/><path class="s" d="M5 8.2l2 2 4-4.2"/>',
  warn: '<path class="f" d="M8 1.6l6.6 11.6H1.4z"/><path class="s" d="M8 6v3.4M8 11.2v.1"/>',
  stop: '<path class="f" d="M5.2 1.2h5.6l4 4v5.6l-4 4H5.2l-4-4V5.2z"/><path class="s" d="M5.6 8h4.8"/>',
  ad:   '<path class="f" d="M1.5 4.2A1.7 1.7 0 0 1 3.2 2.5h6.1l5.2 5.5-5.2 5.5H3.2a1.7 1.7 0 0 1-1.7-1.7z"/><path class="s" d="M5 8h.01" style="stroke-width:2.6"/>',
  look: '<circle class="f" cx="8" cy="8" r="6.5"/><circle class="s" cx="7.3" cy="7.2" r="2.2" style="stroke-width:1.6"/><path class="s" d="M8.9 8.9l1.9 1.9" style="stroke-width:1.6"/>',
};
const shape = (k) => `<svg class="shape" viewBox="0 0 16 16" aria-hidden="true">${SHAPE[k]}</svg>`;

const ZONE = {
  green:    { tone: "ok",   shape: "ok",   label: "Анхааруулах шинж илрээгүй" },
  yellow:   { tone: "warn", shape: "warn", label: "Эх сурвалжийг шалгаарай" },
  red:      { tone: "stop", shape: "stop", label: "Анхааруулах дохиотой" },
  ad_scam:  { tone: "stop", shape: "stop", label: "Луйврын эрсдэлтэй зар" },
  ad_check: { tone: "warn", shape: "ad",   label: "Зар: авахаасаа өмнө шалга" },
  ad_ok:    { tone: "ad",   shape: "ad",   label: "Зар: луйврын шинжгүй" },
  media:    { tone: "mute", shape: "look", label: "Зураг, видеог шалгах" },
  media_ai: { tone: "warn", shape: "warn", label: "AI-аар хийсэн байж магадгүй" },
};

const ICON = {
  search:  "M7 2.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9zM10.4 10.4l3.1 3.1",
  history: "M8 2a6 6 0 1 0 0 12A6 6 0 1 0 8 2zM8 4.8V8l2.2 1.4",
  image:   "M2.5 3.5h11v9h-11zM2.5 10.5l3-3 3 3 2-2 3 3",
  link:    "M6.5 9.5l3-3M7 4.5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1M9 11.5l-1 1A2.5 2.5 0 0 1 4.5 9l1-1",
  ads:     "M2.5 6.5v3h2l5 3v-9l-5 3zM12 6a2.5 2.5 0 0 1 0 4",
  out:     "M6 3.5h6.5V10M12.5 3.5L5 11",
};
const icon = (k) => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${ICON[k]}"/></svg>`;

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : null);
const clean = (t) => String(t || "").replace(/^[−+✓✔]\s*/, "").replace(/^🖼\s*/, "").replace(/\s*\(загварын дүгнэлт\)/, "");

// --- Шалтгаан -------------------------------------------------------------
// Гол 3 анхааруулах шинж + 2 итгэл нэмэх шинж. Урт тайлбар биш: юу олдсон, яагаад анхаарах.
function reasons(r, isAd, z) {
  const bad = (isAd ? r.scam : (r.evidence && r.evidence.length ? r.evidence : r.risks)) || [];
  const good = (isAd ? r.legit : r.trust_signals) || [];
  const item = (x, kind) => {
    if (typeof x === "string") x = { text: x };
    const model = x.id === "style_model" || /загварын дүгнэлт/.test(x.text || "");
    const text = clean(x.text);
    const found = x.found && x.id !== "factcheck" ? `<span class="q">«${esc(x.found.slice(0, 80))}»</span> ` : "";
    return `<li>
      <span class="${kind === "good" ? "plus" : "dot"}" aria-hidden="true"></span>
      <span class="r-body">
        <span class="r-main">${found}${esc(text || x.found)}</span>
        ${x.why ? `<span class="r-why">${esc(x.why)}</span>` : ""}
        ${model ? `<span class="tag">загварын таамаг, нотолгоо биш</span>` : ""}
      </span></li>`;
  };
  const rows = bad.slice(0, 3).map((x) => item(x, "bad")).concat(good.slice(0, 2).map((x) => item(x, "good")));
  return rows.length ? `<section class="sec t-${z.tone}"><h2 class="sec-h">Яагаад?</h2><ul class="reasons">${rows.join("")}</ul></section>` : "";
}

// --- Шалгах хэрэгсэл ------------------------------------------------------
// Хамгийн хэрэгтэй 5 нь: мэдэгдлийг хайх → албан эх сурвалж → зураг → линк → пэйжийн түүх
function tools(p, r) {
  const out = [];
  const m = p.media || {};
  const links = r.status === "ok" ? r.check_links || [] : [];
  const google = links.find((l) => /google/i.test(l.url));
  const others = links.filter((l) => l !== google);
  if (google) out.push(["search", google.title, google.url]);
  if (others[1]) out.push(["search", others[1].title, others[1].url]);      // [0]=MFCC, [1..]=сэдвийн албан эх сурвалж
  if (m.has) {
    const lens = /^https?:/.test(m.src) ? `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(m.src)}` : "https://lens.google.com/";
    out.push(["image", m.hasVideo ? "Видеоны зургийг урвуу хайх" : "Зургийг урвуу хайх", lens]);
  }
  if (p.url) {
    try { const host = new URL(p.url).hostname; out.push(["link", `${host} хэзээ бүртгэгдсэн бэ`, `https://www.whois.com/whois/${host}`]); } catch {}
  }
  if (others[0]) out.push(["search", others[0].title, others[0].url]);
  if (p.author_url) out.push(["history", "Пэйж хэзээ үүссэн, нэрээ сольсон эсэх", `${p.author_url.replace(/\/$/, "")}/about_profile_transparency`]);
  if (p.author) out.push(["ads", "Энэ пэйжийн явуулж буй зарууд",
    `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=MN&search_type=keyword_unordered&q=${encodeURIComponent(p.author)}`]);
  const rows = out.filter(([, , u]) => safeUrl(u)).slice(0, 5).map(([k, t, u]) =>
    `<a class="tool" href="${esc(u)}" target="_blank" rel="noopener">${icon(k)}<span>${esc(t)}</span>${icon("out")}</a>`);
  return rows.length ? `<section class="sec"><h2 class="sec-h">Өөрөө шалгах</h2><div class="tools">${rows.join("")}</div></section>` : "";
}

// --- Өөрөөсөө асуу (MIL-ийн гол дадал) ------------------------------------
function asks(p, r, kind) {
  const base = {
    claim: ["Хэн бичсэн бэ? Мэдээллийн байгууллага уу, хувь хүн үү?", "Хэзээ, хаана болсон бэ? Огноо, газар тодорхой юу?", "Үүнийг тараахаар хэн ашиг хүртэх вэ?"],
    ad:    ["Танаас мөнгө, картын мэдээлэл урьдчилж хүсэж байна уу?", "Үнэ, бэлэг нь хэт сайхан сонсогдож байна уу?", "Пэйж нь хэр удаан үйл ажиллагаа явуулж байгаа вэ?"],
    media: ["Энэ зураг, видео өмнө нь өөр газар гарч байсан уу?", "Гар хуруу, бичиг, сүүдэр, уруулын хөдөлгөөн хачин харагдаж байна уу?", "Хаана, хэзээ авсан нь тодорхой юу?"],
  }[kind];
  const list = [...new Set([r.reflect && r.reflect.ask, ...base].filter(Boolean))].slice(0, 3);
  return `<section class="sec"><h2 class="sec-h">Хуваалцахаасаа өмнө асуу</h2><ol class="asks">${list.map((q) => `<li>${esc(q)}</li>`).join("")}</ol></section>`;
}

function laws(r) {
  if (!r.laws || !r.laws.length) return "";
  return `<details class="fold"><summary>Мэдэх нь зүйтэй хууль</summary><ul class="laws">${r.laws.map((l) =>
    `<li><b>${esc(l.title)}</b> ${esc(l.text)}${safeUrl(l.url) ? ` <a href="${esc(l.url)}" target="_blank" rel="noopener">legalinfo.mn</a>` : ""}</li>`).join("")}</ul>
    <p class="note">Хуулийн зөвлөгөө биш, мэдээлэл. Зөрчсөн эсэхийг зөвхөн шүүх тогтооно.</p></details>`;
}

// --- Оноо -----------------------------------------------------------------
function scoreBlock(p, r, z, isAd) {
  const notes = [
    r.source_unverified && "Эх сурвалж нь бүртгэлгүй тул 69-өөс дээш оноо өгөхгүй.",
    r.translit && "Латин үсгээр бичсэнийг кирилл болгож шалгасан тул нарийвчлал бага.",
    r.from_image && "Үнэлгээг зураг дээрх бичвэрээс хийсэн.",
    r.scorer === "llm" && `Постыг хиймэл оюун уншиж үнэлсэн${r.model ? ` (${r.model})` : ""}.`,
  ].filter(Boolean);
  const hasNum = typeof r.trust === "number";
  const v = hasNum ? Math.max(0, Math.min(100, Math.round(r.trust))) : null;
  return `<section class="score t-${z.tone}" aria-label="Итгэлцлийн оноо">
    ${hasNum ? `
      <div class="score-top">
        <span class="num" aria-label="${v} / 100">${v}<small>/100</small></span>
        <span class="zone">${shape(z.shape)}${esc(z.label)}</span>
      </div>
      <div class="scale" aria-hidden="true"><i class="t-stop"></i><i class="t-warn"></i><i class="t-ok"></i><b style="--v:${v}%"></b></div>
      <div class="scale-nums" aria-hidden="true"><span>0</span><span>40</span><span><span>70</span><span>100</span></span></div>`
    : `<span class="zone zone-big">${shape(z.shape)}${esc(z.label)}</span>`}
    ${r.summary ? `<p class="sum">${esc(r.summary)}</p>` : ""}
    ${notes.map((n) => `<p class="note">${esc(n)}</p>`).join("")}
  </section>`;
}

function factcheck(r) {
  const f = r.factcheck;
  if (!f) return "";
  return `<div class="callout t-stop"><b>Өмнө нь шалгагдсан мэдэгдэлтэй төстэй</b>
    <span>«${esc(String(f.claim).slice(0, 140))}»</span>
    ${safeUrl(f.url) ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.by || "Шалгалт")}-ийн шалгалтыг унших</a>` : ""}</div>`;
}

function postView(p) {
  const r = p.r || {};
  const m = p.media || {};
  const ok = r.status === "ok";
  const isAd = ok && String(r.zone).startsWith("ad_");
  const z = ZONE[ok ? r.zone : (m.aiLabel ? "media_ai" : "media")] || ZONE.media;
  const kind = !ok ? "media" : (isAd ? "ad" : "claim");
  const quote = [p.text, p.imageText && `[зураг] ${p.imageText}`].filter(Boolean).join(" ");
  const aiNote = m.aiLabel ? `<div class="callout t-warn">Facebook энэ ${m.hasVideo ? "видеог" : "зургийг"} «AI-аар хийсэн эсвэл засварласан» гэж тэмдэглэсэн.</div>` : "";
  return `
    <div class="post">
      <div class="post-who"><b>${esc(p.author || "Нэр тодорхойгүй")}</b><button class="link-btn" type="button" data-act="focus">Постод очих</button></div>
      ${quote ? `<p class="post-text">${esc(quote)}</p>` : ""}
    </div>
    ${ok ? scoreBlock(p, r, z, isAd) : `<section class="score t-${z.tone}"><span class="zone zone-big">${shape(z.shape)}${esc(z.label)}</span>
      <p class="sum">Бичвэргүй тул оноо өгөөгүй. Зураг, видеог доорх аргаар өөрөө шалгаарай.</p></section>`}
    ${aiNote}
    ${ok ? factcheck(r) : ""}
    ${ok ? reasons(r, isAd, z) : ""}
    ${tools(p, r)}
    ${asks(p, r, kind)}
    ${ok ? laws(r) : ""}
    <p class="foot">Автомат үнэлгээ, магадлал биш. Итгэх эсэхээ та өөрөө шийднэ.</p>`;
}

function emptyView() {
  const row = (k, t) => `<li class="t-${ZONE[k].tone}">${shape(ZONE[k].shape)}<span>${t}</span></li>`;
  return `<div class="empty">
    <h1>Лэнд дээрх тэмдэг дээр дарахад тухайн постын оноо, шалтгаан энд гарна.</h1>
    <ul class="legend">
      ${row("green", "Анхааруулах шинж илрээгүй")}
      ${row("yellow", "Эх сурвалжийг шалгаарай")}
      ${row("red", "Анхааруулах дохиотой")}
      ${row("ad_ok", "Зар")}
    </ul>
    <p class="note">Тэмдэггүй пост бол шалгагдаагүй, «үнэн» гэсэн үг биш.</p>
  </div>`;
}

function offlineView() {
  return `<div class="callout t-stop" role="alert"><b>Сервертэй холбогдсонгүй</b>
    <span>Постууд оноогдохгүй байна. Backend-ээ асаагаад дахин шалгана уу:</span>
    <code>uvicorn app.main:app --port 8000</code>
    <div class="row"><button class="btn btn-pri" type="button" data-act="retry">Дахин шалгах</button>
    <button class="btn" type="button" data-act="server">Хаяг солих</button></div></div>`;
}

async function serverView() {
  const { api } = await chrome.storage.local.get("api");
  const st = online === null ? ["t-mute", "Шалгаж байна…"] : online ? ["t-ok", "Сервер ажиллаж байна"] : ["t-stop", "Холбогдохгүй байна"];
  return `<div class="server">
    <label for="api">Серверийн хаяг</label>
    <div class="row"><input id="api" value="${esc(api || "http://127.0.0.1:8000")}" spellcheck="false"><button class="btn" type="button" data-act="save">Хадгалах</button></div>
    <span class="status ${st[0]}">${st[1]}</span></div>`;
}

async function render() {
  const parts = [];
  if (online === false) parts.push(offlineView());
  if (showServer) parts.push(await serverView());
  parts.push(post ? postView(post) : emptyView());
  app.innerHTML = parts.join("");
  gear.setAttribute("aria-expanded", String(showServer));
}

function check() {
  chrome.runtime.sendMessage({ type: "health" }, (r) => { online = !!(r && r.ok); render(); });
}

async function load() {
  const k = `sel:${tabId}`;
  const o = await chrome.storage.session.get(k);
  post = o[k] || null;
  render();
}

app.addEventListener("click", async (e) => {
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (act === "focus" && post) chrome.runtime.sendMessage({ type: "focus", tabId, id: post.id });
  if (act === "retry") { online = null; render(); check(); }
  if (act === "server") { showServer = true; await render(); document.getElementById("api")?.focus(); }
  if (act === "save") {
    const v = document.getElementById("api").value.trim().replace(/\/$/, "");
    await chrome.storage.local.set({ api: v });
    online = null; render(); check();
  }
});
gear.addEventListener("click", () => { showServer = !showServer; render(); });

chrome.storage.onChanged.addListener((ch, area) => {
  if (area === "session" && ch[`sel:${tabId}`]) { post = ch[`sel:${tabId}`].newValue || null; render(); app.scrollTop = 0; window.scrollTo(0, 0); }
});
chrome.tabs.onActivated.addListener(({ tabId: t, windowId: w }) => { if (w === winId) { tabId = t; load(); } });

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab ? tab.id : null;
  winId = tab ? tab.windowId : null;
  await load();
  check();
})();
