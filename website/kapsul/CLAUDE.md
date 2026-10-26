@AGENTS.md

# CLAUDE.md — Cure the Core (HACKMIL 2026 demo вэб)

Энэ файлыг AI агент (Claude Code гэх мэт) ажил эхлэхээс өмнө заавал уншина. Бүтээгдэхүүний үнэн `PRODUCT.md`-д, тооны эх сурвалж `docs/SOURCES.md`-д байна.

## 1. Юу хийж байна вэ (нэг догол мөр)

Facebook дээрх манипуляцийг тайлбарладаг browser extension-ий **хамтрагч вэб**. Уриа: **Cure from the Core**. Мэдэгдэл (claim) бол шинж тэмдэг, харин өвчин нь түүнийг үйлдвэрлэж, түгээдэг систем юм. Вэб нь капсулыг огтлоод 4 давхаргыг харуулна:

| # | Давхарга | Хаана |
|---|---|---|
| 1 | Мэдэгдэл (шинж тэмдэг) | extension (сайтад хуудасгүй, нүүрний «Пост шалгагч» эм суулгах заавар руу хөтөлнө) |
| 2 | Тархалт: яагаад чамд хүрсэн бэ | `/game` ← хамгийн гүнзгий хэсэг |
| 3 | Үйлдвэрлэл: хэн, юуны төлөө хийсэн бэ | `/data` + stub |
| 4 | Танин мэдэхүй: өөрийн дадал | `/game` төгсгөл + extension сургалтын горим |

## 2. Stack ба дүрэм

- **Next.js 16.4** (App Router, `cacheComponents: true`). Энэ хувилбар чиний сурсан Next.js-ээс өөр байж болно. Код бичихээс өмнө `node_modules/next/dist/docs/`-оос холбогдох хэсгийг унш.
  - Params нь `Promise`: `PageProps<'/blog/[slug]'>`, `await params`.
  - Server талд өгөгдөл татах функц → `'use cache'` + `cacheLife('minutes')`.
  - Dynamic route → `generateStaticParams`.
- **TypeScript strict**, **Tailwind v4** (`@theme` нь `src/app/globals.css` дотор).
- **3D**: `three` + `@react-three/fiber` + `@react-three/drei`. Canvas бүр `'use client'` бөгөөд `next/dynamic`-ээр `ssr:false` ачаална. `dpr={[1, 1.5]}`. `prefers-reduced-motion` үед хөдөлгөөнийг зогсооно.
- **Supabase**: `src/lib/stats.ts` дахь `getStats()` л өгөгдөл уншина. Env байхгүй бол `src/data/stats.ts` fallback руу шилжинэ. **Demo хэзээ ч эвдрэх ёсгүй.**
- **Нэвтрэх систем байхгүй.** Хувийн мэдээлэл цуглуулахгүй.
- Font: Golos Text (`@fontsource-variable/golos-text`), Ө ө Ү ү-г дэмждэг. Google Fonts-ийг сүлжээгээр бүү ачаал.
- Кодын тайлбарыг **монголоор** бич.

## 3. Хавтасны бүтэц

```
src/
  app/
    layout.tsx            # нав, footer, font
    page.tsx              # нүүр: гүйлгээтэй капсулын түүх (components/landing) → 5 хэсгийн эм
    game/page.tsx         # Feed тоглоом (2-р давхарга)
    data/page.tsx         # 3D data viz
    blog/page.tsx, blog/[slug]/page.tsx
    about/page.tsx
  components/
    three/                # R3F canvas-ууд (client)
    game/                 # тоглоомын логик + UI
    ui/                   # Pill, PillButton, SourceLink ...
  data/
    stats.ts              # fallback тоо (SOURCES.md-тэй таарна)
    posts.ts              # тоглоомын ЗОХИОМОЛ постууд
  lib/
    stats.ts              # Supabase → fallback
    blog.ts               # content/blog/*.md уншина
content/blog/*.md         # нийтлэлүүд (frontmatter: title, date, excerpt)
supabase/schema.sql, supabase/seed.sql
docs/SOURCES.md
```

## 4. Харааны систем: HACKMIL 2026 Design system v3

Token-ууд бүгд `src/app/globals.css`-д байна. Hex-ийг шууд бүү бич, Tailwind token ашигла.

- **Суурь:** `bg-bg`, `bg-surface`, `bg-subtle`, `text-ink` / `text-ink-2` / `text-ink-3`, `ring-line`, `bg-accent` / `hover:bg-accent-strong` / `bg-accent-tint`, `text-on-accent`, `bg-inverse` / `text-on-inverse`.
- **Дүгнэлтийн өнгө (Okabe Ito):** `true`, `false`, `mislead`, `info`, `unchecked` (+ `-tint`). **Өнгийг дангаар нь хэзээ ч бүү ашигла**, заавал icon болон үгтэй хамт хэрэглэ.
- **Графикийн ангилал:** `cat-1`…`cat-5` (`#0072B2, #E69F00, #009E73, #CC79A7, #56B4E9`, энэ дарааллаар).
- **Theme:** «Гэрэлтэх өгөгдөл» (одтой data viz-ийн шөнийн хөх тэнгэр, `#0A1024`). Сайт үргэлж харанхуй горимтой; дүгнэлтийн өнгө нь Sheet 1-ийн dark баганаас. Карт = `glass` (цул surface + 1px хүрээ), header = `frost`.
- **Товч:** `btn btn-primary` / `btn btn-secondary` / `btn-quiet` (globals.css), сегмент: `seg`. Статус: `components/ui/Status.tsx`.
- **Сонсох:** цэсний `ListenButton` (`components/ui/Listen.tsx`) `#main`-ийг уншиж, уншиж буй хэсгийг `--highlight`-аар тодруулна.
- **Хэллэг:** хэрэглэгчид «та» гэж хандана. Бичвэр цөөн, тайлбарын оронд дүрслэл, interaction.
- **Font:** Golos Text (`@fontsource-variable/golos-text`). Scale 1.25: 39 / 31.25 / 25 / 20 / 16 / 12.8 px. Жин: 400/600/700.
- **Radius:** 8px (sm), 16px (`rounded-2xl`, карт), pill (зөвхөн товч, tag, bar). **Shadow:** `shadow-1`, `shadow-2`.
- **Товч:** 44px өндөр, капсул хэлбэртэй, нэг дэлгэцэнд нэг л primary товч (`PillLink tone="primary"`), бусад нь `secondary`.
- **Motion:** 150 / 250 / 400ms, ease-out `cubic-bezier(0.2,0,0,1)`. Reduced motion үед 0ms.
- **Капсул metaphor** нь лого, icon, loader зэрэг цөөн газарт л ашиглагдана.
- **Хориглох зүйлс:** gradient, гарчгийн дээрх eyebrow шошго, ижил хэмжээтэй icon+гарчиг картууд, emoji-г icon болгох.

## 4b. Гэрлийн газрын зураг (`/about#map`)

- Тоглоом дуусгах (`LightPrompt`) эсвэл хуваалцах (`ShareButton`) бүрт хэрэглэгчийн сонгосон аймаг дээр +1 гэрэл асна.
- Өгөгдөл: Supabase-ийн `lights` хүснэгт (`supabase/schema.sql`), realtime-аар шууд шинэчлэгдэнэ. Env байхгүй бол зөвхөн тухайн браузерын localStorage-д хадгалагдана.
- Код: `src/lib/lights.ts`, `src/components/map/*`, аймгийн төвүүд `src/data/aimags.ts`, хилийн шугам `src/data/mongolia-outline.ts` (`node scripts/extract-mongolia.mjs`).
- Хувийн мэдээлэл хадгалахгүй: зөвхөн аймаг, төрөл (game/share), цаг.

## 5. Үг хэллэгийн дүрэм (маш чухал)

- Өвчтөн нь **хэрэглэгч биш, мэдээллийн экосистем**. Хэрэглэгч бол "эмч".
- Хэрэглэхгүй үгс: "итгэлцлийн оноо", "trust score", "бид худал мэдээг илрүүлнэ", "бид таныг эмчилнэ", "худал мэдээг шийднэ".
- Хэрэглэх үгс: "дохио", "шинж тэмдэг", "үндэс", "тархалт", "дүгнэлтийг та өөрөө гаргана".
- Тоо бүр `SourceLink`-тэй байна. Эх сурвалжгүй тоо оруулахгүй.
- Тоглоомын пост, багийн гишүүдийн нэрийн placeholder зэргийг **зохиомол** гэж тодорхой тэмдэглэнэ.

## 6. Үе шаттай prompt-ууд (дарааллаар нь өг)

1. **Setup**: "CLAUDE.md, PRODUCT.md-г уншаад `npm run build` ажиллаж байгааг шалга. Алдаа байвал зас."
2. **Supabase**: "supabase/schema.sql, дараа нь seed.sql-ийг Supabase SQL editor дээр ажиллуул. `.env.local`-д URL, anon key нэм. `/data` хуудас Supabase-ээс уншиж, гэрлийн газрын зураг дээр «Шууд» гэж гарч байгааг шалга."
3. **Тоглоом**: "`src/components/game`-ийн алгоритмын жинг өөрчлөх / шинэ пост нэмэх" гэх мэт. Постыг зөвхөн `src/data/posts.ts`-д нэм.
4. **Data viz**: "`docs/SOURCES.md`-д шинэ тоо нэмээд `src/data/stats.ts`-д нэм. Дараа нь `node scripts/gen-seed.mjs`-ээр seed.sql-ийг дахин үүсгэ."
5. **Blog**: "`content/blog/`-д шинэ .md нийтлэл нэм" (frontmatter-тэй).
6. **Deploy**: "Vercel руу deploy хий. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`."

## 7. Шалгах

- `npm run build` алдаагүй байх.
- 390px (утас) болон 1440px өргөнтэй дэлгэц дээр хэвтээ гүйлгээ гарахгүй байх.
- Монгол үсэг (Ө, Ү) бүх font дээр зөв гарч байх.
