# Cure the Core: HACKMIL 2026 demo вэб

Facebook дээрх манипуляцийг нэг постоор биш, түүнийг үйлдвэрлэж, түгээдэг системээр нь ойлгуулах вэб. Энэ нь extension-ий хамтрагч сайт.

## Ажиллуулах

```bash
npm install
cp .env.example .env.local   # Supabase-гүй ч ажиллана
npm run dev                  # http://localhost:3000
```

## Supabase холбох (5 минут)

1. supabase.com дээр шинэ төсөл үүсгэнэ.
2. **SQL Editor** дээр `supabase/schema.sql`-ийг ажиллуулаад, дараа нь `supabase/seed.sql`-ийг ажиллуулна.
3. **Project Settings → API**-аас URL болон `anon` key-г `.env.local`-д хуулна.
4. `/data` хуудсанд «Өгөгдлийг Supabase-ээс…» гэсэн бичиг гарч, газрын зураг дээр «Шууд» гэсэн тэмдэг асна.

## Vercel рүү deploy хийх

GitHub руу push хийгээд Vercel дээр import хийнэ. Env-д `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`-г нэмнэ.

## AI агентад зориулсан заавар

`CLAUDE.md`-г уншина уу. Бүтээгдэхүүний тодорхойлолт `PRODUCT.md`-д, тооны эх сурвалж `docs/SOURCES.md`-д байна.
