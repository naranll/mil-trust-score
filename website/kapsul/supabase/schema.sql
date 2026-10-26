-- Cure the Core: Supabase schema
-- Supabase → SQL Editor дээр эхлээд энийг, дараа нь seed.sql-ийг ажиллуулна.

create table if not exists public.mil_stats (
  key         text primary key,
  dataset     text not null check (dataset in ('mn_fraud','mn_facebook','global_news','mn_mil','mn_sites','mn_reading')),
  label       text not null,
  value       numeric not null,
  unit        text not null check (unit in ('%','count','mnt_bn','people')),
  period      text not null,
  source_name text not null,
  source_url  text not null,
  updated_at  timestamptz not null default now()
);

-- Нэвтрэх систем байхгүй тул зөвхөн УНШИХ эрхийг нийтэд нээнэ.
alter table public.mil_stats enable row level security;

drop policy if exists "public read" on public.mil_stats;
create policy "public read" on public.mil_stats
  for select using (true);
-- Бичих эрх зөвхөн Supabase dashboard / service role-оор.

-- ===== Гэрлийн газрын зураг =====
-- Тоглоом дуусгах эсвэл мэдээ хуваалцах бүрт нэг мөр нэмэгдэнэ. Хувийн мэдээлэл хадгалахгүй.
create table if not exists public.lights (
  id         bigint generated always as identity primary key,
  aimag      text not null check (aimag in (
    'ub','arkhangai','bayan-olgii','bayankhongor','bulgan','govi-altai','govisumber','darkhan-uul',
    'dornogovi','dornod','dundgovi','zavkhan','orkhon','uvurkhangai','umnugovi','sukhbaatar',
    'selenge','tuv','uvs','khovd','khuvsgul','khentii')),
  kind       text not null check (kind in ('game','share')),
  created_at timestamptz not null default now()
);

alter table public.lights enable row level security;

drop policy if exists "public read lights" on public.lights;
create policy "public read lights" on public.lights for select using (true);

drop policy if exists "public add light" on public.lights;
create policy "public add light" on public.lights for insert with check (true);

-- Шинэ гэрэл бүх нээлттэй хуудсанд шууд (realtime) харагдана
alter publication supabase_realtime add table public.lights;
