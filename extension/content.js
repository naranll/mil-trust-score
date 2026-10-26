// Content script for Facebook (and the demo pages).
// 1) find posts  2) draw a small "Not assessed · Check" badge in a Shadow DOM host  3) on click, open the
// side panel with this post's context. NOTHING is sent to any server from here: the deeper check happens
// only when the user presses "Send for deeper check" in the panel.
// Facebook's HTML changes often, so selectors are lists with fallbacks, and a post whose structure looks
// unexpected gets no badge at all.

(() => {
  const { t } = globalThis.HMI18N;
  let lang = "mn";
  chrome.storage.local.get("lang").then((o) => { lang = o.lang || "mn"; rerenderAll(); }).catch(() => {});
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === "local" && ch.lang) { lang = ch.lang.newValue || "mn"; rerenderAll(); }
  });

  // Постын "хайрцаг": лэнд дээр aria-posinset, бусад газар role=article
  const POST_SELECTORS = ['div[aria-posinset]', 'div[role="article"]'];
  // Постын үндсэн текст байдаг газар (дарааллаар нь оролдоно)
  const MESSAGE_SELECTORS = [
    '[data-ad-rendering-role="story_message"]',
    '[data-ad-comet-preview="message"]',
    '[data-ad-preview="message"]',
  ];
  const MIN_CHARS = 25;

  let counter = 0;
  const posts = new Map();         // id -> {post, anchor, host, data, result}
  let selectedId = null;

  // --- Постын текст олох ----------------------------------------------------
  function findMessage(post) {
    for (const sel of MESSAGE_SELECTORS) {
      const el = post.querySelector(sel);
      if (el && el.innerText.trim().length >= MIN_CHARS) return el;
    }
    // Нөөц: dir="auto" бүхий хамгийн урт текст блок (сэтгэгдлийн хэсгийг тооцохгүй)
    let best = null;
    post.querySelectorAll('div[dir="auto"]').forEach((el) => {
      if (el.closest('[role="article"]') !== post.closest('[role="article"]') && post.matches('[role="article"]')) return;
      if (el.closest('ul')) return;                       // сэтгэгдлүүд ихэвчлэн ul дотор
      const len = el.innerText.trim().length;
      if (len >= MIN_CHARS && (!best || len > best.innerText.trim().length)) best = el;
    });
    return best;
  }

  // Пост доторх гадаад линк (Facebook l.php?u=... гэж ороосон байдаг)
  function findLink(post) {
    const a = post.querySelector('a[href*="l.facebook.com/l.php"], a[href^="http"]:not([href*="facebook.com"])');
    if (!a) return null;
    try {
      const u = new URL(a.href);
      return u.searchParams.get("u") || a.href;
    } catch { return null; }
  }

  // Пост оруулсан пэйж / хүн. Facebook толгой хэсэгт нэрийг линк болгож тавьдаг
  const AUTHOR_SELECTORS = [
    '[data-ad-rendering-role="profile_name"] a',
    'h2 a[role="link"]', 'h3 a[role="link"]', 'h4 a[role="link"]',
    'h2 a', 'h3 a', 'h4 a', 'strong a',
    '[data-hm-author] a',                     // демо хуудас
  ];
  function findAuthor(post) {
    for (const sel of AUTHOR_SELECTORS) {
      const a = post.querySelector(sel);
      const name = a && a.innerText.trim();
      if (name && name.length < 80) {
        const head = a.closest('[data-ad-rendering-role="profile_name"], h2, h3, h4, strong, [data-hm-author]') || a.parentElement;
        // Цэнхэр тэмдэг: aria-label эсвэл title-д "Verified"/"Баталгаажсан" гэж байдаг
        const verified = !!(head && head.parentElement &&
          head.parentElement.querySelector('[aria-label*="erified" i], [title*="erified" i], [aria-label*="аталгаажсан"], [title*="аталгаажсан"]'));
        let url = a.href || "";
        try { const u = new URL(url); url = u.origin + u.pathname + (u.searchParams.get("id") ? `?id=${u.searchParams.get("id")}` : ""); } catch {}
        return { author: name, author_url: url, verified };
      }
    }
    return { author: null, author_url: null, verified: false };
  }

  // --- Зураг, видео ----------------------------------------------------------
  // AI-аар хийсэн эсэхийг бид таамаглахгүй. Facebook өөрөө тавьсан "AI info" шошгыг л уншиж,
  // самбарт «Meta-гийн шошго» гэж харуулна. Шошгын текст БҮТНЭЭРЭЭ таарах ёстой (^…$).
  const AI_LABEL = /^(AI info|Made with AI|AI-generated|AI мэдээлэл|AI-ийн мэдээлэл|AI-аар (бүтээсэн|хийсэн|засварласан)|Хиймэл оюунаар (бүтээсэн|хийсэн))$/i;
  function findMedia(post) {
    const imgs = [...post.querySelectorAll("img")].filter((i) => (i.width || i.naturalWidth) >= 120 && !i.closest("ul"));
    const video = post.querySelector("video");
    let aiLabel = false;
    post.querySelectorAll("span, a, div[role='button']").forEach((el) => {
      if (aiLabel || el.closest("ul") || el.childElementCount > 2) return;
      const s = el.textContent.trim();
      if (s.length < 40 && AI_LABEL.test(s)) aiLabel = true;
    });
    const src = imgs[0]?.currentSrc || imgs[0]?.src || video?.poster || "";
    return { hasImage: imgs.length > 0, hasVideo: !!video, aiLabel, src, el: video || imgs[0] || null };
  }

  // --- Зураг дээрх текст ------------------------------------------------------
  // Facebook-ийн автомат alt текст: «May be an image of text that says '…'» → хашилт доторх хэсэг.
  const QUOTED = /[“"'«‘]([^“”"'«»‘’]{12,})[”"'»’]/g;
  function findImageText(post) {
    const parts = [];
    let firstImg = null;
    post.querySelectorAll("img[alt]").forEach((img) => {
      if (img.width && img.width < 120) return;
      const alt = img.getAttribute("alt") || "";
      let m, found = false;
      QUOTED.lastIndex = 0;
      while ((m = QUOTED.exec(alt))) { parts.push(m[1].trim()); found = true; }
      if (found && !firstImg) firstImg = img;
    });
    return { imageText: [...new Set(parts)].join(". "), imgEl: firstImg };
  }

  // --- Энэ үнэхээр лэнд дээрх пост мөн үү? ------------------------------------
  // Messenger-ийн чат мессеж ч role="article" байдаг — ХУВИЙН ЧАТАД хэзээ ч хүрэхгүй. Reels ч пост биш.
  function isFeedPost(post) {
    if (post.matches('[aria-roledescription="message"]') || post.querySelector('[aria-roledescription="message"]')) return false;
    if (post.closest('[aria-label*="Chat" i], [aria-label*="Messenger" i], [aria-label*="Чат"], [data-pagelet*="Chat"]')) return false;
    return !!post.querySelector('[data-ad-rendering-role="profile_name"], [data-ad-rendering-role="story_message"], [data-ad-preview="message"], [data-hm-author]');
  }

  // --- Зар уу? ------------------------------------------------------------------
  const SPONSORED_RE = /^(Sponsored|Ивээн тэтгэсэн|Ивээн тэтгэгдсэн|Спонсор|Реклам|Сурталчилгаа)$/i;
  function adSignals(post) {
    const has_cta = !!post.querySelector('[data-ad-rendering-role^="cta"]');
    let sponsored = false;
    const head = post.querySelector('[data-ad-rendering-role="profile_name"]');
    const zone = head ? (head.closest("span[dir]")?.parentElement?.parentElement || head.parentElement) : null;
    if (zone) {
      for (const el of zone.querySelectorAll("a, span")) {
        const s = (el.innerText || "").trim();
        if (s.length <= 20 && SPONSORED_RE.test(s)) { sponsored = true; break; }
      }
    }
    if (post.querySelector("[data-hm-sponsored]")) sponsored = true;
    const title = post.querySelector('[data-ad-rendering-role="title"]');
    return { sponsored, has_cta, link_title: title ? title.innerText.trim().slice(0, 200) : null };
  }

  // --- Find posts (local only, no network) -----------------------------------------
  function scan() {
    document.querySelectorAll(POST_SELECTORS.join(",")).forEach((post) => {
      // Сэтгэгдэл (өөр article дотор байгаа article)-ийг алгасна
      if (post.matches('[role="article"]') && post.parentElement?.closest('[role="article"], div[aria-posinset]')) return;
      if (!isFeedPost(post)) return;
      const msgEl = findMessage(post);
      const { imageText, imgEl } = findImageText(post);
      const media = findMedia(post);
      if (!msgEl && !imageText && !media.el) return;
      const text = msgEl ? msgEl.innerText.trim() : "";
      const id = post.dataset.hmId || `hm${++counter}`;
      const prev = posts.get(id);
      // Keep the latest text (Facebook expands "See more" in place) without redrawing an existing badge
      const data = {
        id, text, imageText, url: findLink(post), ...findAuthor(post), ...adSignals(post),
        media: { hasImage: media.hasImage, hasVideo: media.hasVideo, aiLabel: media.aiLabel, src: media.src || "", has: !!media.el },
      };
      if (prev && prev.host.isConnected) { prev.data = data; return; }
      post.dataset.hmId = id;
      // Where to put the badge: above the text, or above the image when there is no text
      let anchor = msgEl;
      if (!anchor) {
        const m = imgEl || media.el;
        anchor = m;
        while (anchor.parentElement && anchor.parentElement !== post &&
               anchor.parentElement.offsetWidth <= m.offsetWidth + 4) anchor = anchor.parentElement;
      }
      if (!anchor || !anchor.parentElement) return;    // unexpected structure: no badge
      const host = document.createElement("div");
      host.className = "hm-host";
      const shadow = host.attachShadow({ mode: "closed" });
      anchor.parentElement.insertBefore(host, anchor);
      const entry = { post, host, shadow, data, result: prev?.result || null };
      posts.set(id, entry);
      draw(entry);
    });
    reportCoverage();
  }

  let covTimer = null;
  function reportCoverage() {
    clearTimeout(covTimer);
    covTimer = setTimeout(() => {
      const live = [...posts.values()].filter((e) => e.host.isConnected);
      chrome.runtime.sendMessage({ type: "coverage", seen: live.length, checked: live.filter((e) => e.result && e.result.checked).length }).catch(() => {});
    }, 400);
  }

  // --- Badge (three honest states, shape + text, never colour alone) -----------------
  const SHAPE = {
    // amber triangle with "!": signals to check
    signals: `<svg viewBox="0 0 16 16" aria-hidden="true"><path class="f" d="M8 1.6l6.6 11.6H1.4z"/><path class="s" d="M8 6v3.4M8 11.2v.1"/></svg>`,
    // blue page with lines: a publisher's fact-check exists
    factcheck: `<svg viewBox="0 0 16 16" aria-hidden="true"><path class="f" d="M3.5 1.5h6l3 3v10h-9z"/><path class="s" d="M5.6 7h4.8M5.6 9.5h4.8M5.6 12h3"/></svg>`,
    // grey ring with a dash: not assessed (never a check mark)
    not_assessed: `<svg viewBox="0 0 16 16" aria-hidden="true"><circle class="o" cx="8" cy="8" r="6"/><path class="d" d="M5.4 8h5.2"/></svg>`,
    pending: `<svg viewBox="0 0 16 16" aria-hidden="true"><circle class="o" cx="8" cy="8" r="6" stroke-dasharray="3 2.4"/></svg>`,
  };
  const CHEVRON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5"/></svg>`;

  const CSS = `
    :host { all: initial; display: block; margin: 6px 0 10px; }
    .b { --ink:#22303a; --mute:#5b6b75; --line:rgba(34,48,58,.14); --chip:#fff; --on:#fff;
         --signals:#b7791f; --factcheck:#2f6fb0; --not_assessed:#6e7b85; --pending:#6e7b85;
         display:flex; flex-direction:column; align-items:flex-start; gap:4px; color:var(--ink);
         font:13px/1.45 "Segoe UI Variable Text","Segoe UI",-apple-system,BlinkMacSystemFont,system-ui,sans-serif; }
    .b[data-theme="dark"] { --ink:#e6ecef; --mute:#a9b6be; --line:rgba(255,255,255,.16); --chip:rgba(255,255,255,.08); --on:#1b1f22;
         --signals:#e3b05a; --factcheck:#7fb2ea; --not_assessed:#9aa7b0; --pending:#9aa7b0; }
    .b { --c: var(--not_assessed); }
    .b[data-state="signals"] { --c: var(--signals); } .b[data-state="factcheck"] { --c: var(--factcheck); }
    .pill { display:inline-flex; align-items:center; gap:7px; min-height:28px; padding:0 5px 0 8px; border-radius:999px;
            border:1px solid color-mix(in srgb, var(--c) 40%, transparent); background:color-mix(in srgb, var(--c) 10%, transparent);
            color:var(--ink); font:inherit; font-weight:600; line-height:1; cursor:pointer; }
    .b[data-state="not_assessed"] .pill, .b[data-state="pending"] .pill { background:transparent; font-weight:500; }
    .pill:hover { background:color-mix(in srgb, var(--c) 18%, transparent); }
    .pill:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
    svg { width:16px; height:16px; flex:none; }
    .f { fill:var(--c); } .s { fill:none; stroke:var(--on); stroke-width:1.6; stroke-linecap:round; }
    .o { fill:none; stroke:var(--c); stroke-width:1.6; } .d { stroke:var(--c); stroke-width:1.8; stroke-linecap:round; }
    .go { display:inline-flex; align-items:center; gap:2px; height:22px; padding:0 6px 0 9px; border-radius:999px;
          background:var(--chip); border:1px solid var(--line); font-size:12px; font-weight:600; }
    .go svg { width:12px; height:12px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
    .sel .pill { box-shadow:0 0 0 2px var(--ink); }
    .reason { margin:0 0 0 2px; max-width:62ch; color:var(--mute); font-size:12.5px; line-height:1.4; }
    @media (prefers-reduced-motion: reduce) { * { transition:none !important; } }`;

  function stateOf(e) {
    if (e.pending) return "pending";
    return (e.result && e.result.state) || "not_assessed";
  }

  function oneLine(e) {
    const r = e.result;
    if (!r) return "";
    if (r.state === "factcheck" && r.factcheck) return t(lang, "fc_close", { publisher: r.factcheck.publisher || "" });
    if (r.state === "signals" && r.signals?.length) {
      const s = r.signals[0];
      const label = globalThis.HMI18N.signalLabel(lang, s);
      return s.found ? `${label}: «${s.found.slice(0, 60)}»` : label;
    }
    return "";
  }

  const isDark = () => document.documentElement.classList.contains("__fb-dark-mode") ||
    (!location.hostname.includes("facebook.com") && matchMedia("(prefers-color-scheme: dark)").matches);

  function draw(e) {
    const state = stateOf(e);
    const label = t(lang, `state_${state}`);
    const line = oneLine(e);
    const tip = state === "not_assessed" ? t(lang, "badge_none_tip") : label;
    e.shadow.innerHTML = `<style>${CSS}</style>
      <div class="b${selectedId === e.data.id ? " sel" : ""}" data-state="${state}" data-theme="${isDark() ? "dark" : "light"}">
        <button class="pill" type="button" title="${esc(tip)}" aria-label="${esc(t(lang, "badge_aria", { state: label }))}">
          ${SHAPE[state]}<span>${esc(label)}</span><span class="go">${esc(t(lang, "badge_go"))}${CHEVRON}</span>
        </button>
        ${line ? `<p class="reason">${esc(line)}</p>` : ""}
      </div>`;
    e.shadow.querySelector(".b").addEventListener("click", (ev) => ev.stopPropagation());  // keep Facebook from opening the post
    e.shadow.querySelector(".pill").addEventListener("click", (ev) => { ev.preventDefault(); openPanel(e); });
  }

  function rerenderAll() { posts.forEach((e) => { if (e.host.isConnected) draw(e); }); }

  function openPanel(e) {
    const prev = selectedId;
    selectedId = e.data.id;
    if (prev && posts.get(prev)) draw(posts.get(prev));
    draw(e);
    // Only JSON-safe values; no DOM. This goes to chrome.storage.session, not to any server.
    const post = { ...e.data, page: location.href, result: e.result };
    chrome.runtime.sendMessage({ type: "open-panel", post }, (resp) => {
      if (chrome.runtime.lastError || (resp && resp.ok === false)) toast(t(lang, "toast_panel_fail"));
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "result") {
      const e = posts.get(msg.id);
      if (!e) return;
      e.pending = false;
      e.result = msg.result;
      if (e.host.isConnected) draw(e);
      reportCoverage();
    }
    if (msg.type === "pending") {
      const e = posts.get(msg.id);
      if (e) { e.pending = true; draw(e); }
    }
    if (msg.type === "focus") {
      const e = posts.get(msg.id);
      if (!e) return;
      e.post.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      e.post.classList.remove("hm-flash"); void e.post.offsetWidth; e.post.classList.add("hm-flash");
    }
  });

  new MutationObserver(() => {
    const th = isDark() ? "dark" : "light";
    posts.forEach((e) => { const b = e.shadow.querySelector(".b"); if (b) b.dataset.theme = th; });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  const TOAST_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6l6.6 11.6H1.4z" fill="#e3b05a"/><path d="M8 6v3.4M8 11.2v.1" stroke="#22303a" stroke-width="1.7" stroke-linecap="round"/></svg>`;
  function toast(msg) {
    document.getElementById("hm-toast")?.remove();
    const el = document.createElement("div");
    el.id = "hm-toast"; el.setAttribute("role", "status");
    el.innerHTML = `${TOAST_ICON}<span>${esc(msg)}</span>`;
    el.addEventListener("click", () => el.remove());
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 8000);
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  // Facebook adds posts while scrolling
  let scanTimer = null;
  new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 700);
  }).observe(document.body, { childList: true, subtree: true });
  scan();
})();
