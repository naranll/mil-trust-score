# extension/ — Chrome extension (Manifest V3)

**Owner: extension member.** Plain JavaScript, no build step: load the folder in Chrome as an unpacked extension.

```
Facebook feed ──(post text, page name)──▶ content.js ──▶ background.js ──▶ backend  POST /score/posts
                                                                                  ◀── score + 3 reasons
                badge on every post ◀────────────────────────────────────────────
                click a badge ──▶ background.js ──(storage.session "sel:<tabId>")──▶ side panel
```

```
extension/
├── manifest.json     permissions, host_permissions (API address), content-script matches, side_panel
├── content.js        finds Facebook posts, extracts text/author/image text, draws the badge + one-line reason
├── background.js     service worker: forwards requests to the backend (avoids CORS / mixed-content blocks), opens the side panel
├── sidepanel.*       side panel, tab «Шалгах»: score 0–100, top reasons, one-click checking tools, questions to ask; server address (gear)
├── tools.js/.css     side panel, tab «Хэрэгсэл»: the tools box (see below), self-contained, classes prefixed tb-
├── i18n.js           MN/EN strings of the tools box
├── registry/         build-time copy of ../registry (tools.json, mongolia.json, lessons.json, buildLink.js): `node registry/sync.mjs`
├── demo-cache.json   cached archive/domain answers for the tools box when the server does not answer (labelled «Кэшлэсэн демо үр дүн»)
├── styles.css        badge styles
└── demo/demo.html    fake Facebook feed for demos without logging in (served by the backend at /demo)
```

The model, reference lists and feedback handling are **not** here: see [`model/`](../model/README.md) and
[`data/`](../data/README.md). API contract: [`docs/API.md`](../docs/API.md).

## Side panel tabs

Tabs are folder tabs at the very top (no header above them; the server-settings gear sits at the end of the strip). The active tab shares its colour with the page below it; the tools tab carries a thin yellow cap.
Every scored post badge shows the trust number (`22/100`) next to its label; the panel shows the same number with reasons.

- **🔍 Шалгах** (tab 1): the teammate's post panel: score 0–100, reasons, checking links, questions. Opens when you click a badge on a post.
- **🧰 Хэрэгсэл** (tab 2): icons first, almost no text, same neutral look as tab 1.
  One input (link, image link or claim) with a «Хайх» button and an MN/EN switch → role row → ⚡ row of tools already
  prefilled with your input (one tap opens them) → 12 tiles (Зураг, Видео, Мэдэгдэл, Сурвалж, Архив, Шошго, Газар, Файл,
  Дадал, Монгол, Сүүлд, Бүгд). Press a tile to see its tools, press a tool to see what it can't tell you and one big
  «Нээх» button. Wayback/RDAP tools show their answer as a one-line card. Habits = SIFT letters, IFCN 1–5, a 3-card
  practice deck. Opening the tab sends nothing; «Хайх» or opening Wayback/RDAP sends only that
  link through our server (`/api/wayback`, `/api/rdap`).

Edit tools (icon, one-word `short`, limits…) in `../registry/tools.json`, then run `node registry/sync.mjs` from the repo root
and reload the extension.

Style: Hackmil 2026 design system v3 (`style/*.png`): Golos Text, Okabe-Ito verdict colours with shapes, pill buttons 44px,
light/dark follow the browser (the in-feed badge follows Facebook's own dark mode).

## 1. Start the backend (5 min)

From the repo root (see [`backend/README.md`](../backend/README.md) for details):

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate      Mac/Linux: source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend && uvicorn app.main:app --port 8000
```

Check: http://127.0.0.1:8000/health → `{"ok":true,"model":"scorecard v4",...}`

## 2. Install the extension (2 min)
1. Chrome → `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → choose the `extension/` folder
4. Click the extension icon: the side panel opens. If the server is not running it says «Сервертэй холбогдсонгүй».

Requires Chrome 116+ (side panel API).

## 3. Try it
- **Demo (works without internet):** http://127.0.0.1:8000/demo — the most reliable option for presentations
- **Facebook:** open facebook.com and scroll. Each Mongolian post gets a badge; click «Шалгах» and the side panel shows the score, reasons and checking tools.

> To use a deployed backend, set its URL in the side panel (gear icon) and add the same origin to `host_permissions` in `manifest.json`.

## Тэмдгийн утга (хэрэглэгчид юу харагдах вэ)
| Тэмдэг | Утга | Хэзээ |
|---|---|---|
| 🟢 Анхааруулах шинж илрээгүй | Бичвэрт сэжигтэй шинж алга **ба** эх сурвалж батлагдсан | Зөвхөн бүртгэлтэй пэйж эсвэл бүртгэлтэй сайтын линктэй пост |
| 🟡 Эх сурвалжийг шалгаарай | Шийдэх хангалттай нотолгоо алга | Эх сурвалж тодорхойгүй ч цэвэр бичсэн пост энд орно |
| 🔴 Анхааруулах дохиотой | Луйвар, манипуляц эсвэл өмнө нь няцаагдсан мэдэгдэл | |
| (тэмдэггүй) | **Шалгагдаагүй** — хэт богино, гадаад хэл | |
Тоо (0–100) зөвхөн самбарт, 0–40–70–100 шкалын хамт харагдана. «40% үнэн» гэж буруу уншигдахгүйн тулд
«Автомат үнэлгээ, магадлал биш» гэж доор нь бичсэн.
Латин үсгээр бичсэн монгол постыг кирилл болгож шалгана (🔤 тэмдэглэгээтэй, нарийвчлал бага).
Сервер холбогдохгүй бол баруун доод буланд ⚠️ мэдэгдэл гарна.

## Зураг дээрх бичвэр
Facebook зураг бүрт автоматаар alt текст үүсгэдэг; зурагт бичвэр байвал түүнийг хашилтад оруулдаг
(«May be an image of text that says '…'»). Extension хашилт доторх хэсгийг авч, постын текстээс **тусад нь** оноож,
илүү эрсдэлтэйг нь харуулна (🖼 тэмдэгтэй шалтгаан). OCR суулгах шаардлагагүй.
Шалгах: Console (Verbose) дээр `зурган бичвэр: …` гэж гарч байвал ажиллаж байна.
Хязгаарлалт: Facebook alt текстэд бичвэрийг заавал оруулдаггүй, монгол кирилл бичвэрийг алдаатай уншиж болно.

## Зураг, видео — AI-аар хийсэн эсэх
"87% AI" гэх мэт тоо гаргадаг илрүүлэгч **ашиглаагүй**: Facebook зургийг шахдаг тул ийм илрүүлэгчид бодит зургийг ч AI гэж андуурдаг —
жинхэнэ гэрэл зургийг "AI" гэж буруутгах нь өөрөө худал мэдээлэл болно. Оронд нь:
1. **Facebook-ийн "AI info" шошго** (Meta өөрөө тавьдаг) пост дээр байвал 🤖 гэж анхааруулна
2. **🔍 урвуу хайлт** — Google Lens-ээр зураг өмнө нь хаана гарсныг нэг товчоор хайна (хуучин зургийг шинэ мэт тараах нь хамгийн түгээмэл заль)
3. **Юуг ажиглах вэ** — зураг/видео тус бүрт 3 зөвлөгөө (гар хуруу, бичиг, уруулын хөдөлгөөн, огноо/газар)
Текстгүй, зөвхөн зураг/видеотой пост дээр оноо өгөхгүй — 🔍 "Зургийг шалгах" саарал тэмдэг гарна.

## Facebook дээр тэмдэг гарахгүй бол
Facebook HTML-ээ байнга өөрчилдөг. F12 → Console дээр:
```js
document.querySelectorAll('div[aria-posinset], div[role="article"]').length   // пост олдож байна уу
document.querySelectorAll('[data-ad-rendering-role="story_message"], [data-ad-preview="message"]').length  // текст олдож байна уу
```
0 гарвал `content.js`-ийн `POST_SELECTORS`, `MESSAGE_SELECTORS`-ийг Elements таб дээр харж шинэчилнэ.
Сервер холбогдохгүй бол Console дээр `[Итгэлцлийн оноо] сервертэй холбогдсонгүй` гэж гарна.

## Мэдэгдэж буй сул тал
- Хувийн пост ("Өнөөдөр уулаар алхлаа 🙂") ч 🟡 авна — мэдэгдэл мөн эсэхийг ялгагч хараахан байхгүй
- Албан хэв маягаар бичсэн ухаалаг худлыг ихэвчлэн 🟡/🟢 гэж үзнэ (агуулгыг шалгадаггүй)
- Зураг доторх текстийг уншихгүй
