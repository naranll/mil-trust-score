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
  const ZONE_TEXT = {
    green:  { label: "Найдвартай төстэй", icon: "🟢" },
    yellow: { label: "Шалгаж үзээрэй",    icon: "🟡" },
    red:    { label: "Анхааруулах дохиотой", icon: "🔴" },
  };

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
  const AI_LABEL = /AI info|Made with AI|AI-generated|AI мэдээлэл|AI-ийн мэдээлэл|AI-аар (бүтээсэн|хийсэн|засварласан)|хиймэл оюунаар (бүтээсэн|хийсэн)/i;
  function findMedia(post) {
    const imgs = [...post.querySelectorAll("img")].filter((i) => (i.width || i.naturalWidth) >= 120);
    const video = post.querySelector("video");
    let aiLabel = false;
    post.querySelectorAll("span, a, div[role='button']").forEach((el) => {
      const t = el.innerText;
      if (!aiLabel && t && t.length < 40 && AI_LABEL.test(t)) aiLabel = true;
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

  // --- Шинэ постуудыг хайх --------------------------------------------------
  function scan() {
    document.querySelectorAll(POST_SELECTORS.join(",")).forEach((post) => {
      // Сэтгэгдэл (өөр article дотор байгаа article)-ийг алгасна
      if (post.matches('[role="article"]') && post.parentElement?.closest('[role="article"], div[aria-posinset]')) return;
      const msgEl = findMessage(post);
      const { imageText, imgEl } = findImageText(post);
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
      pending.set(id, { post, msgEl: anchor, text, imageText, media, url: findLink(post), ...au });
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
    }));
    chrome.runtime.sendMessage({ type: "score", items }, (resp) => {
      if (!resp || resp.error) {
        console.warn("[Итгэлцлийн оноо] сервертэй холбогдсонгүй:", resp && resp.error);
        return;
      }
      resp.results.forEach((r) => {
        const p = batch.find(([id]) => id === r.id)?.[1];
        if (p) render(p, r);
      });
    });
    if (pending.size) flushSoon();
  }

  // --- Тэмдэг (badge) зурах -------------------------------------------------
  function mediaSection(m) {
    if (!m || !m.el) return "";
    const kind = m.hasVideo ? "видео" : "зураг";
    const lens = /^https?:/.test(m.src)
      ? `<a class="hm-btn" href="https://lens.google.com/uploadbyurl?url=${encodeURIComponent(m.src)}" target="_blank" rel="noopener">🔍 Энэ ${kind} өмнө нь хаана гарсныг хайх</a>`
      : `<p class="hm-tip">🔍 ${m.hasVideo ? "Видеоны нэг кадрыг screenshot хийгээд" : "Зургийг хадгалаад"} <b>lens.google.com</b>-д оруулж, өмнө нь хаана гарсныг хайгаарай.</p>`;
    const tips = m.hasVideo
      ? ["Хуучин видеог шинэ үйл явдал мэт тараах нь хамгийн түгээмэл заль",
         "Дуу хоолой уруулын хөдөлгөөнтэй таарахгүй, нүүр «хальтирч» байвал AI-аар хийсэн (deepfake) байж болно",
         "Хаана, хэзээ авсан нь тодорхой юу? Цаг агаар, хэл, машины дугаар таарч байна уу?"]
      : ["Хуучин зургийг шинэ үйл явдал мэт тараах нь хамгийн түгээмэл заль — дээрх товчоор шалга",
         "AI зурагт гар, хуруу, бичиг үсэг, сүүдэр, арын хүмүүс ихэвчлэн хачин харагддаг",
         "Зураг дээрх бичвэр постын тайлбартай таарч байна уу?"];
    return `<div class="hm-sec"><div class="hm-h">${m.hasVideo ? "🎬 Видеог" : "🖼 Зургийг"} шалгах</div>
        ${m.aiLabel ? `<p class="hm-ai">🤖 Facebook энэ ${kind}г «AI-аар хийсэн эсвэл засварласан» гэж тэмдэглэсэн байна.</p>` : ""}
        ${lens}<ul>${tips.map((t) => `<li>${t}</li>`).join("")}</ul></div>`;
  }

  function render(p, r) {
    p.post.querySelector(":scope .hm-badge")?.remove();
    const m = p.media;
    const ok = r.status === "ok";
    if (!ok && !(m && m.el)) return;                 // текст ч, медиа ч шалгах зүйлгүй
    const box = document.createElement("div");
    let pill;
    if (ok) {
      const z = ZONE_TEXT[r.zone];
      box.className = `hm-badge hm-${r.zone}`;
      pill = `<span>${z.icon}</span><b>${r.trust}</b><span class="hm-of">/100</span><span class="hm-label">${z.label}</span>`;
    } else {
      // Текст байхгүй, зөвхөн зураг/видео → оноо өгөхгүй, зөвхөн шалгах хэрэгсэл
      box.className = `hm-badge ${m.aiLabel ? "hm-yellow" : "hm-gray"}`;
      pill = m.aiLabel ? `<span>🤖</span><span class="hm-label">AI-аар хийсэн байж магадгүй</span>`
                       : `<span>🔍</span><span class="hm-label">${m.hasVideo ? "Видеог" : "Зургийг"} шалгах</span>`;
    }
    box.innerHTML = `
      <button class="hm-pill" type="button" title="Дэлгэрэнгүйг харах">${pill}<span class="hm-caret">▾</span></button>
      <div class="hm-detail" hidden>
        ${ok ? `<p class="hm-sum">${esc(r.summary || "")}</p>` : ""}
        ${ok ? list("Яагаад ийм оноо вэ?", r.risks) : ""}
        ${ok ? list("Итгэл нэмсэн зүйл", r.trust_signals) : ""}
        ${ok && r.guardrail ? `<p class="hm-note">Тодорхой хуурах шинж олдоогүй тул улаан биш, шар гэж үзлээ.</p>` : ""}
        ${ok && r.from_image ? `<p class="hm-note">🖼 Оноог зураг дээрх бичвэрээс тооцсон: <i>«${esc(r.from_image.slice(0, 120))}»</i></p>` : ""}
        ${ok && r.source === "trusted" && r.text_only_trust < 70 ? `<p class="hm-note">Зөвхөн бичвэрээр нь бол ${r.text_only_trust}/100 гарах байсан — нийтэлсэн пэйж нь бүртгэлтэй тул оноо өссөн.</p>` : ""}
        ${ok && r.factcheck ? `<div class="hm-fc">📰 Өмнө нь шалгагдсан мэдэгдэл: <i>«${esc(r.factcheck.claim.slice(0, 140))}»</i><br>
            ${r.factcheck.url ? `<a class="hm-btn" href="${esc(r.factcheck.url)}" target="_blank" rel="noopener">${esc(r.factcheck.by)}-ийн шалгалтыг унших</a>` : ""}</div>` : ""}
        ${mediaSection(m)}
        <div class="hm-fb">Таны бодлоор энэ пост:
          <button data-v="true" type="button">✅ Үнэн</button><button data-v="false" type="button">❌ Худал</button><button data-v="not_claim" type="button">💬 Мэдэгдэл биш</button>
        </div>
        ${ok ? `<p class="hm-card">📘 Сурах карт: <i>${esc(r.card)}</i></p>` : ""}
        <p class="hm-foot">Энэ бол автомат туслах — эцсийн дүгнэлт биш. Итгэх эсэхээ өөрөө шийднэ.</p>
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
        text: p.text, image_text: p.imageText || null, url: p.url, author: p.author, author_url: p.author_url,
        user_label: b.dataset.v, trust: ok ? r.trust : null, zone: ok ? r.zone : "media",
      } }, (resp) => {
        box.querySelector(".hm-fb").innerHTML = resp && resp.ok ? `🙏 Баярлалаа! (нийт ${resp.count} санал)` : "⚠️ Хадгалж чадсангүй";
      });
    }));
    p.msgEl.parentElement.insertBefore(box, p.msgEl);
  }

  function list(title, arr) {
    if (!arr || !arr.length) return "";
    return `<div class="hm-sec"><div class="hm-h">${title}</div><ul>${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
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
