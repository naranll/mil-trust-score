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

  // --- Зөвхөн монгол пост -------------------------------------------------
  // backend/model/hm_core.py-ийн is_mongolian()-тэй ижил дүрэм: кирилл давамгайлсан бол Ө/Ү эсвэл түгээмэл
  // монгол үг шаардана (орос пост ч кирилл), латинаар бичсэн монголыг (bna, ene …) зөвшөөрнө, бусдыг алгасна.
  const MN_LETTERS = /[ӨөҮү]/;
  const OTHER_CYR = /[ӘәҒғҚқҢңҰұҺһІіЇїЄєЎў]/;
  const MN_WORDS = /(?<![А-Яа-яЁёӨөҮү])(байна|байгаа|байсан|байх|энэ|эдгээр|тэр|юм|нь|бол|болно|болсон|гэж|гэсэн|гэнэ|бөгөөд|болон|бид|манай|хүн|ч|уу|үү|юу)(?![А-Яа-яЁёӨөҮү])/iu;
  const MN_LATIN = /\b(bna|baina|baigaa|baisan|bol|bolno|bolson|ene|edgeer|yum|gej|gesen|gene|bid|manai|hun|huniig|shuu|uu|vv|bn|yu|mongol)\b/i;
  const EN_WORDS = /\b(the|and|is|are|was|to|of|in|for|on|with|this|that|you|your|we|our|will|have|has|be|it|at|from|by|not|now|all|new)\b/gi;
  const letters = (t) => (t.match(/[A-Za-zА-Яа-яЁёӨөҮү]/g) || []).length;
  function isMongolian(raw) {
    const t = raw.replace(/\[[^\]]+\]|https?:\/\/\S+/g, " ");
    const n = letters(t);
    if (n < 3 || OTHER_CYR.test(t)) return false;
    const cyr = (t.match(/[А-Яа-яЁёӨөҮү]/g) || []).length / n;
    if (cyr >= 0.6) return MN_LETTERS.test(t) || MN_WORDS.test(t);
    if (cyr > 0.3) return MN_LETTERS.test(t);
    const words = t.match(/[A-Za-z]+/g) || [];
    const english = words.length >= 4 && (t.match(EN_WORDS) || []).length / words.length >= 0.12;
    return !english && MN_LATIN.test(t);
  }
  // Бичвэргүй (зөвхөн зураг/видео) пост: хэлийг нь пэйжийн нэрээр таана
  const mnName = (name) => !!name && ((/[А-Яа-яЁёӨөҮү]/.test(name) && !OTHER_CYR.test(name)) || /\.mn\b|mongol/i.test(name));

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
      // Гадаад хэлний пост (зар ч мөн) дээр тэмдэг тавихгүй, серверт ч илгээхгүй
      const words = `${text} ${imageText}`;
      if (letters(words) >= 3 ? !isMongolian(words) : !mnName(findAuthor(post).author)) {
        post.querySelector(":scope .hm-badge")?.remove();
        return;
      }
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
        toast("Итгэлцлийн оноо: сервертэй холбогдсонгүй, постууд шалгагдахгүй байна. Backend-ээ асаагаад хуудсаа дахин ачаална уу.");
        return;
      }
      document.getElementById("hm-toast")?.remove();
      resp.results.forEach((r) => {
        const p = batch.find(([id]) => id === r.id)?.[1];
        if (!p) return;
        render(p, r);
      });
    });
    if (pending.size) flushSoon();
  }

  // --- Тэмдэг (badge) зурах -------------------------------------------------
  // Пост дээр зөвхөн тэмдэг + нэг мөр шалтгаан. Дарахад хажуугийн самбарт оноо, шалтгаан,
  // шалгах хэрэгслүүд гарна (sidepanel.js). Дизайны зарчим: замын тэмдгийн
  // ХЭЛБЭР (● ▲ ⬣ ▭) нь өнгөнөөс гадна утгыг дамжуулна — өнгөт харалган хүн ч ялгана (inline SVG).
  const SHAPE = {
    ok:   `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M5 8.2l2 2 4-4.2" fill="none" stroke="var(--hm-on)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    warn: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6l6.6 11.6H1.4z"/><path d="M8 6v3.4M8 11.2v.1" stroke="var(--hm-on)" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    stop: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.2 1.2h5.6l4 4v5.6l-4 4H5.2l-4-4V5.2z"/><path d="M5.6 8h4.8" stroke="var(--hm-on)" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    ad:   `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 4.2A1.7 1.7 0 0 1 3.2 2.5h6.1l5.2 5.5-5.2 5.5H3.2a1.7 1.7 0 0 1-1.7-1.7z"/><circle cx="5" cy="8" r="1.3" fill="var(--hm-on)"/></svg>`,
    look: `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><circle cx="7.3" cy="7.2" r="2.2" fill="none" stroke="var(--hm-on)" stroke-width="1.6"/><path d="M8.9 8.9l1.9 1.9" stroke="var(--hm-on)" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  };
  const CHEVRON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5"/></svg>`;
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

  let selectedId = null;           // самбарт нээлттэй пост

  // Facebook-ийн өөрийн харанхуй горим (OS-оос хамааралгүй) — <html class="__fb-dark-mode">
  const isDark = () => document.documentElement.classList.contains("__fb-dark-mode") ||
    (!location.hostname.includes("facebook.com") && matchMedia("(prefers-color-scheme: dark)").matches);
  new MutationObserver(() => {
    const t = isDark() ? "dark" : "light";
    document.querySelectorAll(".hm-badge").forEach((b) => { b.dataset.theme = t; });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  // Пост дээрх нэг мөр шалтгаан: хамгийн эхний (хамгийн хүчтэй) анхааруулах шинж
  function oneReason(r, isAd) {
    const items = isAd ? r.scam : (r.evidence && r.evidence.length ? r.evidence : r.risks);
    const x = items && items[0];
    if (!x) return "";
    if (typeof x === "string") return x.replace(/^[−+]\s*/, "").replace(/^🖼\s*/, "").replace(/\s*\(загварын дүгнэлт\)/, "");
    const text = (x.text || "").replace(/\s*\(загварын дүгнэлт\)/, "");
    return x.found && x.id !== "factcheck" ? `${text}: «${x.found.slice(0, 60)}»` : (text || x.found || "");
  }

  function render(p, r) {
    p.post.querySelector(":scope .hm-badge")?.remove();
    const m = p.media;
    const ok = r.status === "ok";
    if (!ok && !(m && m.el)) return;                 // шалгах зүйлгүй
    const isAd = ok && String(r.zone).startsWith("ad_");
    const key = ok ? r.zone : (m.aiLabel ? "media_ai" : "media");
    const b = BADGE[key] || BADGE.media;
    const reason = key === "green" ? "" : (ok ? oneReason(r, isAd) : "Бичвэргүй тул оноо өгөөгүй. Зураг, видеог өөрөө шалгаж болно.");

    const box = document.createElement("div");
    box.className = `hm-badge hm-tone-${b.tone}${b.compact ? " hm-compact" : ""}${selectedId === p.post.dataset.hmId ? " hm-selected" : ""}`;
    box.dataset.theme = isDark() ? "dark" : "light";
    box.innerHTML = `
      <button class="hm-pill" type="button" title="${esc(b.label)}" aria-label="Итгэлцлийн оноо: ${esc(b.label)}. Хажуугийн самбарт шалгах">
        <span class="hm-shape">${SHAPE[b.shape]}</span><span class="hm-label">${esc(b.label)}</span><span class="hm-go">Шалгах${CHEVRON}</span>
      </button>
      ${reason ? `<p class="hm-reason">${esc(reason)}</p>` : ""}`;
    box.addEventListener("click", (e) => e.stopPropagation());   // Facebook пост руу шилжихээс сэргийлнэ
    box.querySelector(".hm-pill").addEventListener("click", (e) => {
      e.preventDefault();
      openPanel(p, r, box);
    });
    p.msgEl.parentElement.insertBefore(box, p.msgEl);
  }

  // Самбарт илгээх өгөгдөл: DOM элемент биш, зөвхөн JSON болох утгууд
  function openPanel(p, r, box) {
    const id = p.post.dataset.hmId;
    selectedId = id;
    document.querySelectorAll(".hm-badge.hm-selected").forEach((x) => x.classList.remove("hm-selected"));
    box.classList.add("hm-selected");
    const m = p.media || {};
    const post = {
      id, page: location.href, author: p.author, author_url: p.author_url, verified: p.verified,
      text: p.text, imageText: p.imageText || "", url: p.url,
      media: { hasImage: !!m.hasImage, hasVideo: !!m.hasVideo, aiLabel: !!m.aiLabel, src: m.src || "", has: !!m.el },
      r,
    };
    chrome.runtime.sendMessage({ type: "open-panel", post }, (resp) => {
      if (resp && resp.ok === false) toast("Самбарыг нээж чадсангүй. Хаягийн мөрний баруун талын extension-ий тэмдэг дээр дарна уу.");
    });
  }

  // Самбараас «Постод очих» дарахад
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type !== "focus") return;
    const post = document.querySelector(`[data-hm-id="${CSS.escape(msg.id)}"]`);
    if (!post) return;
    post.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    post.classList.remove("hm-flash"); void post.offsetWidth; post.classList.add("hm-flash");
  });

  const TOAST_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6l6.6 11.6H1.4z" fill="#e69f00"/><path d="M8 6v3.4M8 11.2v.1" stroke="#0a1024" stroke-width="1.7" stroke-linecap="round"/></svg>`;
  function toast(msg) {
    document.getElementById("hm-toast")?.remove();
    const t = document.createElement("div");
    t.id = "hm-toast"; t.setAttribute("role", "status");
    t.innerHTML = `${TOAST_ICON}<span>${esc(msg)}</span>`;
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
