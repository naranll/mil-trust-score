// Content script — Facebook хуудсан дээр ажиллана.
// 1) Пост олох  2) Текст + линк авах  3) Background руу илгээх  4) Оноог постын дээр харуулах
// Facebook-ийн HTML байнга өөрчлөгддөг тул selector-уудыг жагсаалтаар, нөөцтэйгээр бичсэн.

(() => {
  // Постын "хайрцаг": лэнд дээр aria-posinset, бусад газар role=article
  const POST_SELECTORS = ['div[aria-posinset]', 'div[role="article"]'];
  // Постын үндсэн текст байдаг газар (дарааллаар нь оролдоно)
  const MESSAGE_SELECTORS = [
    '[data-ad-rendering-role="story_message"]',
    '[data-ad-comet-preview="message"]',
    '[data-ad-preview="message"]',
  ];
  const MIN_CHARS = 25;            // үүнээс богино текстийг огт илгээхгүй

  let counter = 0;
  const pending = new Map();       // id -> {post, msgEl, text}
  let timer = null;

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

  // --- Зураг, видео (медиа) ---------------------------------------------------
  // AI-аар хийсэн эсэхийг "87% AI" гэх мэт тоогоор хэлэх найдвартай арга одоогоор байхгүй
  // (Facebook зургийг шахдаг тул илрүүлэгчид бодит зургийг ч AI гэж андуурдаг).
  // Тиймээс: (1) Facebook өөрөө тавьсан "AI info" шошгыг уншина, (2) хэрэглэгчид зургийг
  // урвуу хайлтаар (Google Lens) шалгах товч өгнө, (3) юуг ажиглахыг зааж өгнө.
  // Шошгын текст БҮТНЭЭРЭЭ таарах ёстой (^…$): эс бөгөөд «AI мэдээлэл» гэсэн пэйжийн нэр, hashtag,
  // сэтгэгдлийг «Facebook тэмдэглэсэн» гэж худал хэлчихнэ
  const AI_LABEL = /^(AI info|Made with AI|AI-generated|AI мэдээлэл|AI-ийн мэдээлэл|AI-аар (бүтээсэн|хийсэн|засварласан)|Хиймэл оюунаар (бүтээсэн|хийсэн))$/i;
  function findMedia(post) {
    // Сэтгэгдлийн (ul доторх) зураг, шошгыг тооцохгүй
    const imgs = [...post.querySelectorAll("img")].filter((i) => (i.width || i.naturalWidth) >= 120 && !i.closest("ul"));
    const video = post.querySelector("video");
    let aiLabel = false;
    post.querySelectorAll("span, a, div[role='button']").forEach((el) => {
      if (aiLabel || el.closest("ul") || el.childElementCount > 2) return;
      const t = el.textContent.trim();
      if (t.length < 40 && AI_LABEL.test(t)) aiLabel = true;
    });
    const src = imgs[0]?.currentSrc || imgs[0]?.src || video?.poster || "";
    return { hasImage: imgs.length > 0, hasVideo: !!video, aiLabel, src, el: video || imgs[0] || null };
  }

  // --- Зураг дээрх текст ------------------------------------------------------
  // Facebook зураг бүрт автоматаар alt текст үүсгэдэг бөгөөд зурагт бичвэр байвал
  // «May be an image of text that says '…'» / «…гэсэн текст» гэж бичвэрийг нь хашилтад оруулдаг.
  // Тиймээс OCR-гүйгээр alt-аас хашилт доторх хэсгийг авна (хурдан, нэмэлт програм хэрэггүй).
  const QUOTED = /[“"'«‘]([^“”"'«»‘’]{12,})[”"'»’]/g;
  function findImageText(post) {
    const parts = [];
    let firstImg = null;
    post.querySelectorAll("img[alt]").forEach((img) => {
      if (img.width && img.width < 120) return;          // профайл зураг, emoji-г алгасна
      const alt = img.getAttribute("alt") || "";
      let m, found = false;
      QUOTED.lastIndex = 0;
      while ((m = QUOTED.exec(alt))) { parts.push(m[1].trim()); found = true; }
      if (found && !firstImg) firstImg = img;
    });
    const text = [...new Set(parts)].join(". ");
    return { imageText: text, imgEl: firstImg };
  }

  // --- Энэ үнэхээр лэнд дээрх пост мөн үү? ------------------------------------
  // Facebook Messenger-ийн чат мессеж ч role="article" байдаг (fb_structure.json-оор илэрсэн) —
  // хүмүүсийн ХУВИЙН ЧАТЫГ серверт илгээхгүйн тулд заавал алгасна. Reels-ийн карусель ч пост биш.
  function isFeedPost(post) {
    if (post.matches('[aria-roledescription="message"]') || post.querySelector('[aria-roledescription="message"]')) return false;
    if (post.closest('[aria-label*="Chat" i], [aria-label*="Messenger" i], [aria-label*="Чат"], [data-pagelet*="Chat"]')) return false;
    // Пост гэж үзэх нөхцөл: зохиогчийн нэр эсвэл постын текстийн Facebook тэмдэглэгээ (эсвэл демо хуудасны)
    return !!post.querySelector('[data-ad-rendering-role="profile_name"], [data-ad-rendering-role="story_message"], [data-ad-preview="message"], [data-hm-author]');
  }

  // --- Зар уу? ------------------------------------------------------------------
  // Facebook «Sponsored» гэдэг үгийг үсгээр нь хувааж, хольж нуудаг тул DOM-оос биш, хэрэглэгчид
  // ХАРАГДАЖ БАЙГАА текстээс (innerText) хайна. Мөн зарын «Send message / Shop now» товч (cta).
  const SPONSORED_RE = /^(Sponsored|Ивээн тэтгэсэн|Ивээн тэтгэгдсэн|Спонсор|Реклам|Сурталчилгаа)$/i;
  function adSignals(post) {
    const has_cta = !!post.querySelector('[data-ad-rendering-role^="cta"]');
    let sponsored = false;
    const head = post.querySelector('[data-ad-rendering-role="profile_name"]');
    const zone = head ? (head.closest("span[dir]")?.parentElement?.parentElement || head.parentElement) : null;
    if (zone) {
      for (const el of zone.querySelectorAll("a, span")) {
        const t = (el.innerText || "").trim();
        if (t.length <= 20 && SPONSORED_RE.test(t)) { sponsored = true; break; }
      }
    }
    // Демо хуудас: data-hm-sponsored
    if (post.querySelector("[data-hm-sponsored]")) sponsored = true;
    const title = post.querySelector('[data-ad-rendering-role="title"]');
    return { sponsored, has_cta, link_title: title ? title.innerText.trim().slice(0, 200) : null };
  }

  // --- Шинэ постуудыг хайх --------------------------------------------------
  function scan() {
    document.querySelectorAll(POST_SELECTORS.join(",")).forEach((post) => {
      // Сэтгэгдэл (өөр article дотор байгаа article)-ийг алгасна
      if (post.matches('[role="article"]') && post.parentElement?.closest('[role="article"], div[aria-posinset]')) return;
      if (!isFeedPost(post)) return;
      const msgEl = findMessage(post);
      const { imageText, imgEl } = findImageText(post);
      // Хурдны хамгаалалт: Facebook DOM-оо секунд тутам өөрчилдөг тул өмнө шалгасан, текст нь
      // өөрчлөгдөөгүй постын хүнд (бүх span-ийг гүйх) медиа шалгалтыг 3-аас олон удаа хийхгүй
      const cheapKey = `${msgEl ? msgEl.innerText.length : 0}|${imageText.length}|${post.querySelectorAll("img,video").length}`;
      if (post.dataset.hmCheap === cheapKey && Number(post.dataset.hmTries || 0) >= 3) return;
      post.dataset.hmCheap = cheapKey;
      post.dataset.hmTries = String(Number(post.dataset.hmTries || 0) + 1);
      const media = findMedia(post);
      if (!msgEl && !imageText && !media.el) return;     // текст ч, зураг/видео ч алга
      const text = msgEl ? msgEl.innerText.trim() : "";
      // Өмнө нь шалгасан бол: текст 30%+ уртассан эсвэл зурагны бичвэр шинээр гарсан үед л дахин илгээнэ
      const prev = Number(post.dataset.hmLen || 0), prevImg = Number(post.dataset.hmImg || 0);
      const mediaKey = `${media.hasImage}|${media.hasVideo}|${media.aiLabel}`;
      if (post.dataset.hmId && text.length < prev * 1.3 && imageText.length <= prevImg &&
          post.dataset.hmMedia === mediaKey) return;
      post.dataset.hmMedia = mediaKey;
      post.dataset.hmLen = String(text.length);
      post.dataset.hmImg = String(imageText.length);
      const id = post.dataset.hmId || `hm${++counter}`;
      post.dataset.hmId = id;
      const au = findAuthor(post);
      // Console дээр харагдана → trusted_pages.json-д нэр/slug нэмэхэд хэрэгтэй
      console.debug("[Итгэлцлийн оноо] зохиогч:", au.author, au.author_url, au.verified ? "(verified)" : "",
                    imageText ? `| зурган бичвэр: ${imageText.slice(0, 80)}` : "");
      // Тэмдгийг тавих газар: постын текст байхгүй бол зургийн дээр
      let anchor = msgEl;
      if (!anchor) {
        // Зургийг тойрсон (зурагтайгаа ижил өргөнтэй) контейнероос гарч, пост дотроо үлдэнэ
        const m = imgEl || media.el;
        anchor = m;
        while (anchor.parentElement && anchor.parentElement !== post &&
               anchor.parentElement.offsetWidth <= m.offsetWidth + 4) anchor = anchor.parentElement;
      }
      pending.set(id, { post, msgEl: anchor, text, imageText, media, url: findLink(post), ...au, ...adSignals(post) });
    });
    if (pending.size) flushSoon();
  }

  // Олон постыг нэг дор илгээнэ (гүйлгэх үед сервер рүү хүсэлт цөөрнө)
  function flushSoon() {
    clearTimeout(timer);
    timer = setTimeout(flush, 500);
  }

  function flush() {
    const batch = [...pending.entries()].slice(0, 20);
    batch.forEach(([id]) => pending.delete(id));
    const items = batch.map(([id, p]) => ({
      id, text: p.text, image_text: p.imageText, url: p.url, author: p.author, author_url: p.author_url, verified: p.verified,
      sponsored: p.sponsored, has_cta: p.has_cta, link_title: p.link_title,
    }));
    chrome.runtime.sendMessage({ type: "score", items }, (resp) => {
      if (!resp || resp.error) {
        console.warn("[Итгэлцлийн оноо] сервертэй холбогдсонгүй:", resp && resp.error);
        toast("Итгэлцлийн оноо: сервер асаагүй тул постууд шалгагдахгүй байна. uvicorn-оо асаана уу.");
        return;
      }
      document.getElementById("hm-toast")?.remove();
      resp.results.forEach((r) => {
        const p = batch.find(([id]) => id === r.id)?.[1];
        if (p) render(p, r);
      });
    });
    if (pending.size) flushSoon();
  }

  // --- Тэмдэг (badge) зурах -------------------------------------------------
  // Дизайны зарчим: замын тэмдгийн ХЭЛБЭР (● ▲ ⬣ ▭) нь өнгөнөөс гадна утгыг дамжуулна —
  // өнгөт харалган хүн ч ялгана, emoji шиг OS бүрт өөр харагдахгүй (inline SVG).
  const SHAPE = {
    ok:   `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M5 8.2l2 2 4-4.2" fill="none" stroke="var(--hm-on)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    warn: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6l6.6 11.6H1.4z"/><path d="M8 6v3.4M8 11.2v.1" stroke="var(--hm-on)" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    stop: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.2 1.2h5.6l4 4v5.6l-4 4H5.2l-4-4V5.2z"/><path d="M5.6 8h4.8" stroke="var(--hm-on)" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    ad:   `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 4.2A1.7 1.7 0 0 1 3.2 2.5h6.1l5.2 5.5-5.2 5.5H3.2a1.7 1.7 0 0 1-1.7-1.7z"/><circle cx="5" cy="8" r="1.3" fill="var(--hm-on)"/></svg>`,
    look: `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.5 10.5l3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  };
  // Бүс бүрийн хэлбэр, өнгө, шошго (шошго = систем юу хэмждэгийг яг хэлнэ)
  const BADGE = {
    green:    { tone: "ok",   shape: "ok",   label: "Анхааруулах шинж илрээгүй", compact: true },
    yellow:   { tone: "warn", shape: "warn", label: "Эх сурвалжийг шалгаарай" },
    red:      { tone: "stop", shape: "stop", label: "Анхааруулах дохиотой" },
    ad_scam:  { tone: "stop", shape: "stop", label: "Луйврын эрсдэлтэй зар" },
    ad_check: { tone: "warn", shape: "ad",   label: "Зар: авахаасаа өмнө шалга" },
    ad_ok:    { tone: "ad",   shape: "ad",   label: "Зар: луйврын шинжгүй" },
    media:    { tone: "mute", shape: "look", label: "Зураг, видеог шалгах" },
    media_ai: { tone: "warn", shape: "warn", label: "AI-аар хийсэн байж магадгүй" },
  };

  // Facebook-ийн өөрийн харанхуй горим (OS-оос хамааралгүй) — <html class="__fb-dark-mode">
  const isDark = () => document.documentElement.classList.contains("__fb-dark-mode") ||
    (!location.hostname.includes("facebook.com") && matchMedia("(prefers-color-scheme: dark)").matches);
  new MutationObserver(() => {
    const t = isDark() ? "dark" : "light";
    document.querySelectorAll(".hm-badge").forEach((b) => { b.dataset.theme = t; });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  // Нэг шалтгаан = юу олдсон («…») + яагаад анхаарах вэ + (байвал) эх сурвалж
  function reasonItem(x, kind) {
    if (typeof x === "string") x = { text: x };
    const model = kind === "model" || /загварын дүгнэлт/.test(x.text || "");
    const text = (x.text || "").replace(/\s*\(загварын дүгнэлт\)/, "");
    return `<li class="hm-r${model ? " hm-r-model" : ""}">
        ${x.found ? `<span class="hm-q">«${esc(x.found)}»</span>` : ""}
        <span>${esc(text)}</span>
        ${x.why ? `<span class="hm-why">${esc(x.why)}</span>` : ""}
        ${x.src_url ? `<a class="hm-src" href="${esc(x.src_url)}" target="_blank" rel="noopener">${esc(x.src_name || "Эх сурвалж")}</a>` : ""}
        ${model ? `<span class="hm-tag">загварын таамаг, нотолгоо биш</span>` : ""}
      </li>`;
  }
  function reasonList(title, arr, kind) {
    if (!arr || !arr.length) return "";
    // Загварын таамгийг үргэлж хамгийн сүүлд
    const sorted = [...arr].sort((a, b) => /загварын дүгнэлт/.test(a.text || a) - /загварын дүгнэлт/.test(b.text || b));
    return `<section class="hm-sec"><h4 class="hm-h">${title}</h4><ul class="hm-list">${sorted.map((x) => reasonItem(x, kind)).join("")}</ul></section>`;
  }
  // Хураагддаг хэсэг: <details> — гарын товчлуураар ч нээгдэнэ, нэмэлт JS хэрэггүй
  function fold(title, body) {
    if (!body) return "";
    return `<details class="hm-fold"><summary>${title}</summary><div class="hm-fold-body">${body}</div></details>`;
  }
  function linkRow(links) {
    const ok = links.filter(Boolean);
    return ok.length ? `<div class="hm-links">${ok.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join("")}</div>` : "";
  }

  function mediaBody(m) {
    if (!m || !m.el) return "";
    const kind = m.hasVideo ? "видео" : "зураг";
    const lens = /^https?:/.test(m.src) ? [[`Энэ ${kind} өмнө нь хаана гарсныг хайх`, `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(m.src)}`]] : [];
    const tips = m.hasVideo
      ? ["Хуучин видеог шинэ үйл явдал мэт тараах нь хамгийн түгээмэл заль. Нэг кадрыг screenshot хийгээд lens.google.com-д хай.",
         "Дуу хоолой уруулын хөдөлгөөнтэй таарахгүй, нүүр «хальтирч» байвал AI-аар хийсэн (deepfake) байж болно.",
         "Хаана, хэзээ авсан нь тодорхой юу? Цаг агаар, хэл, машины дугаар таарч байна уу?"]
      : ["Хуучин зургийг шинэ үйл явдал мэт тараах нь хамгийн түгээмэл заль.",
         "AI зурагт гар, хуруу, бичиг үсэг, сүүдэр, арын хүмүүс ихэвчлэн хачин харагддаг.",
         "Зураг дээрх бичвэр постын тайлбартай таарч байна уу?"];
    return `${m.aiLabel ? `<p class="hm-callout hm-tone-warn">Facebook энэ ${kind}г «AI-аар хийсэн эсвэл засварласан» гэж тэмдэглэсэн.</p>` : ""}
      ${linkRow(lens)}<ul class="hm-list hm-plain">${tips.map((t) => `<li>${t}</li>`).join("")}</ul>`;
  }

  function pageHistoryBody(p) {
    if (!p.author) return "";
    const lib = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=MN&search_type=keyword_unordered&q=${encodeURIComponent(p.author)}`;
    const about = p.author_url ? `${p.author_url.replace(/\/$/, "")}/about_profile_transparency` : null;
    return `${linkRow([about && ["Хэзээ үүссэн, нэрээ сольсон эсэх", about], ["Ямар зар явуулж байгаа", lib]])}
      <p class="hm-muted">Саяхан үүссэн, нэрээ олон сольсон, админ нь гадаадад байгаа пэйж бол болгоомжил.</p>`;
  }

  function reflectBody(rf) {
    if (!rf) return "";
    return `<dl class="hm-reflect">
        ${rf.if_believe ? `<dt>Хэрэв итгэвэл</dt><dd>${esc(rf.if_believe)}</dd>` : ""}
        ${rf.if_check ? `<dt>Шалгавал</dt><dd>${esc(rf.if_check)}</dd>` : ""}
        ${rf.ask ? `<dt>Өөрөөсөө асуу</dt><dd>${esc(rf.ask)}</dd>` : ""}
      </dl>`;
  }
  function lawBody(laws) {
    if (!laws || !laws.length) return "";
    return `<ul class="hm-list hm-plain">${laws.map((l) => `<li><b>${esc(l.title)}</b> ${esc(l.text)}
      ${l.url ? `<a class="hm-src" href="${esc(l.url)}" target="_blank" rel="noopener">legalinfo.mn</a>` : ""}</li>`).join("")}</ul>
      <p class="hm-muted">Энэ нь хуулийн зөвлөгөө биш, мэдээлэл. Нийтлэгч хууль зөрчсөн эсэхийг зөвхөн шүүх тогтооно.</p>`;
  }
  function checkBody(r) {
    const links = (r.check_links || []).map((l) => [l.title, l.url]);
    const research = (r.research || []).map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a>${l.note ? ` <span class="hm-muted">${esc(l.note)}</span>` : ""}</li>`).join("");
    if (!links.length && !research) return "";
    return `${linkRow(links)}${research ? `<p class="hm-muted">Энэ төрлийн заль мэхийн талаар уншаарай:</p><ul class="hm-list hm-plain">${research}</ul>` : ""}`;
  }

  function feedbackRow(isAd) {
    const opts = isAd
      ? [["false", "Луйвар"], ["true", "Жинхэнэ"], ["unsure", "Мэдэхгүй"], ["wrong_type", "Зар биш"]]
      : [["true", "Үнэн"], ["false", "Худал"], ["unsure", "Мэдэхгүй"], ["not_claim", "Мэдэгдэл биш"]];
    return `<div class="hm-fb"><span>Таны бодлоор энэ пост</span>${opts.map(([v, t]) => `<button type="button" data-v="${v}">${t}</button>`).join("")}</div>`;
  }

  function render(p, r) {
    p.post.querySelector(":scope .hm-badge")?.remove();
    const m = p.media;
    const ok = r.status === "ok";
    if (!ok && !(m && m.el)) return;                 // шалгах зүйлгүй
    const isAd = ok && String(r.zone).startsWith("ad_");
    const key = ok ? r.zone : (m.aiLabel ? "media_ai" : "media");
    const b = BADGE[key];

    let body = "";
    if (ok && isAd) {
      body = `<p class="hm-sum">${esc(r.summary)}</p>
        <p class="hm-muted">${esc(r.type_why || "")}</p>
        ${reasonList("Луйврын шинж", r.scam)}
        ${reasonList("Итгэл нэмэх шинж", r.legit)}
        ${r.factcheck && r.factcheck.url ? linkRow([[`${r.factcheck.by}-ийн шалгалтыг унших`, r.factcheck.url]]) : ""}
        ${fold("Итгэвэл, шалгавал", reflectBody(r.reflect))}
        ${fold("Пэйжийн түүхийг шалгах", pageHistoryBody(p))}
        ${fold("Мэдэх нь зүйтэй хууль", lawBody(r.laws))}
        ${fold("Цааш хэрхэн шалгах вэ", checkBody(r))}
        ${fold(m && m.hasVideo ? "Видеог шалгах" : "Зургийг шалгах", mediaBody(m))}`;
    } else if (ok) {
      const notes = [
        r.guardrail && "Тодорхой хуурах шинж олдоогүй тул улаан биш, шар гэж үзлээ.",
        r.source_unverified && "Ногоон тэмдгийг зөвхөн бүртгэлтэй мэдээллийн пэйж эсвэл сайтын линктэй постод өгнө.",
        r.translit && "Латин үсгээр бичсэнийг кирилл болгож шалгасан тул нарийвчлал бага байж болно.",
        r.from_image && `Үнэлгээг зураг дээрх бичвэрээс хийсэн: «${String(r.from_image).slice(0, 120)}»`,
        r.source === "trusted" && r.text_only_trust < 70 && "Нийтэлсэн пэйж нь бүртгэлтэй тул тэмдэг сайжирсан.",
      ].filter(Boolean);
      body = `<p class="hm-sum">${esc(r.summary || "")}</p>
        ${reasonList("Яагаад ийм тэмдэг гарсан бэ?", r.evidence || r.risks)}
        ${reasonList("Итгэл нэмсэн зүйл", r.trust_signals)}
        ${r.factcheck ? `<p class="hm-callout hm-tone-stop">Өмнө нь шалгагдсан мэдэгдэл: «${esc(r.factcheck.claim.slice(0, 140))}»</p>
           ${r.factcheck.url ? linkRow([[`${r.factcheck.by}-ийн шалгалтыг унших`, r.factcheck.url]]) : ""}` : ""}
        ${notes.length ? `<ul class="hm-notes">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
        ${fold("Итгэвэл, шалгавал", reflectBody(r.reflect))}
        ${fold("Мэдэх нь зүйтэй хууль", lawBody(r.laws))}
        ${fold("Цааш хэрхэн шалгах вэ", checkBody(r))}
        ${fold(m && m.hasVideo ? "Видеог шалгах" : "Зургийг шалгах", mediaBody(m))}`;
    } else {
      body = `<p class="hm-sum">Текстгүй пост тул үнэлгээ өгөхгүй. Гэхдээ зураг, видеог өөрөө шалгах боломжтой.</p>${mediaBody(m)}`;
    }

    const box = document.createElement("div");
    box.className = `hm-badge hm-tone-${b.tone}${b.compact ? " hm-compact" : ""}`;
    box.dataset.theme = isDark() ? "dark" : "light";
    box.innerHTML = `
      <button class="hm-pill" type="button" aria-expanded="false" title="${b.label}" aria-label="Итгэлцлийн оноо: ${b.label}. Дэлгэрэнгүйг нээх">
        <span class="hm-shape">${SHAPE[b.shape]}</span><span class="hm-label">${b.label}</span><span class="hm-caret" aria-hidden="true"></span>
      </button>
      <div class="hm-detail" hidden>${body}
        ${feedbackRow(isAd)}
        <p class="hm-foot">Автомат туслах. Итгэх эсэхээ та өөрөө шийднэ.</p>
      </div>`;
    box.querySelector(".hm-pill").addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const d = box.querySelector(".hm-detail");
      d.hidden = !d.hidden;
      box.querySelector(".hm-caret").textContent = d.hidden ? "▾" : "▴";
    });
    box.addEventListener("click", (e) => e.stopPropagation());   // Facebook пост руу шилжихээс сэргийлнэ
    // Санал хүсэлт: хэрэглэгчийн шошгыг сервер feedback.csv-д хадгална → дараа нь загварыг дахин сургана
    box.querySelectorAll(".hm-fb button").forEach((b) => b.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "feedback", item: {
        text: p.text, image_text: p.imageText || null, url: p.url,   // author is deliberately not sent (privacy)
        user_label: b.dataset.v, trust: ok ? r.trust : null, zone: ok ? r.zone : "media",
      } }, (resp) => {
        box.querySelector(".hm-fb").innerHTML = resp && resp.ok ? `🙏 Баярлалаа! (нийт ${resp.count} санал)` : "⚠️ Хадгалж чадсангүй";
      });
    }));
    p.msgEl.parentElement.insertBefore(box, p.msgEl);
  }

  function wire(box, p, r, ok) {
    const pill = box.querySelector(".hm-pill"), d = box.querySelector(".hm-detail");
    pill.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      d.hidden = !d.hidden;
      pill.setAttribute("aria-expanded", String(!d.hidden));
      box.classList.toggle("hm-open", !d.hidden);
    });
    box.addEventListener("click", (e) => e.stopPropagation());   // Facebook пост руу шилжихээс сэргийлнэ
    // Санал хүсэлт: feedback.csv → дахин сургах
    box.querySelectorAll(".hm-fb button").forEach((btn) => btn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "feedback", item: {
        text: p.text, image_text: p.imageText || null, url: p.url, author: p.author, author_url: p.author_url,
        user_label: btn.dataset.v, trust: ok ? (r.trust ?? null) : null, zone: ok ? r.zone : "media",
        post_type: r.post_type || null,
      } }, (resp) => {
        box.querySelector(".hm-fb").innerHTML = resp && resp.ok
          ? `<span>Хадгаллаа. Нийт ${resp.count} санал загварыг сайжруулахад ашиглагдана.</span>`
          : `<span>Хадгалж чадсангүй: сервер асаалттай эсэхийг шалгана уу.</span>`;
      });
    }));
  }

  function toast(msg) {
    if (document.getElementById("hm-toast")) return;
    const t = document.createElement("div");
    t.id = "hm-toast"; t.textContent = msg;
    t.addEventListener("click", () => t.remove());
    document.body.appendChild(t);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  // Facebook нь гүйлгэх үед шинэ пост нэмдэг тул DOM өөрчлөлтийг ажиглана
  let scanTimer = null;
  new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 700);
  }).observe(document.body, { childList: true, subtree: true });
  scan();
})();
