# extension/ — Chrome extension (Manifest V3)

**Owner: extension member.** Plain JavaScript, no build step: load the folder in Chrome as an unpacked extension.

```
Facebook feed ──(post text, page name)──▶ content.js ──▶ background.js ──▶ backend  POST /score/posts
                                                                                  ◀── score + 3 reasons
                badge on every post ◀────────────────────────────────────────────
```

```
extension/
├── manifest.json     permissions, host_permissions (API address), content-script matches
├── content.js        finds Facebook posts, extracts text/author/image text, draws the badge + detail card
├── background.js     service worker: forwards requests to the backend (avoids CORS / mixed-content blocks)
├── popup.html/js     "server is running" check + API address setting
├── styles.css        badge styles
└── demo/demo.html    fake Facebook feed for demos without logging in (served by the backend at /demo)
```

The model, reference lists and feedback handling are **not** here: see [`model/`](../model/README.md) and
[`data/`](../data/README.md). API contract: [`docs/API.md`](../docs/API.md).

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
4. Click the extension icon: it should say "✅ Сервер ажиллаж байна"

## 3. Try it
- **Demo (works without internet):** http://127.0.0.1:8000/demo — the most reliable option for presentations
- **Facebook:** open facebook.com and scroll. Each Mongolian post gets a 🟢/🟡/🔴 badge; click it for reasons + MIL card.

> To use a deployed backend, set its URL in the popup and add the same origin to `host_permissions` in `manifest.json`.

## Тэмдгийн утга (хэрэглэгчид юу харагдах вэ)
| Тэмдэг | Утга | Хэзээ |
|---|---|---|
| 🟢 Анхааруулах шинж илрээгүй | Бичвэрт сэжигтэй шинж алга **ба** эх сурвалж батлагдсан | Зөвхөн бүртгэлтэй пэйж эсвэл бүртгэлтэй сайтын линктэй пост |
| 🟡 Эх сурвалжийг шалгаарай | Шийдэх хангалттай нотолгоо алга | Эх сурвалж тодорхойгүй ч цэвэр бичсэн пост энд орно |
| 🔴 Анхааруулах дохиотой | Луйвар, манипуляц эсвэл өмнө нь няцаагдсан мэдэгдэл | |
| (тэмдэггүй) | **Шалгагдаагүй** — хэт богино, гадаад хэл | Popup дээр тоо нь харагдана |
Тоо (0–100) хэрэглэгчид харагдахгүй: дүрмүүдийн дараах оноо магадлал биш, харин «40% үнэн» гэж буруу уншигддаг.
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
