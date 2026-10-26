"use client";

// Гэрлийн газрын зураг: тоглоом тоглох эсвэл мэдээ хуваалцах бүрт +1 гэрэл.
// Supabase холбогдсон бол бүх хүний гэрэл realtime-аар харагдана.
// Холбогдоогүй бол зөвхөн энэ браузерын гэрэл (localStorage) харагдана.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type LightKind = "game" | "share";
// Гэрлийн өнгө: тоглоом = цэнхэр, хуваалцсан = улбар шар (Okabe Ito)
export const KIND_COLOR = { game: "#56b4e9", share: "#e69f00" } as const;

export type Light = { id: string; aimag: string; kind: LightKind; created_at: string };

const LOCAL_KEY = "ctc-lights";
const AIMAG_KEY = "ctc-aimag";
const EVENT = "ctc-light";

let client: SupabaseClient | null | undefined;
function supa(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}

export const isLive = () => supa() !== null;

function readLocal(): Light[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as Light[];
  } catch {
    return [];
  }
}

export async function fetchLights(): Promise<Light[]> {
  const s = supa();
  if (!s) return readLocal();
  const { data, error } = await s.from("lights").select("id, aimag, kind, created_at").order("created_at", { ascending: false }).limit(600);
  if (error || !data) return readLocal();
  return data.map((d) => ({ ...d, id: String(d.id) })) as Light[];
}

export async function addLight(kind: LightKind, aimag: string): Promise<Light> {
  const s = supa();
  let light: Light = { id: `local-${Date.now()}`, aimag, kind, created_at: new Date().toISOString() };
  if (s) {
    const { data, error } = await s.from("lights").insert({ aimag, kind }).select("id, aimag, kind, created_at").single();
    if (error) throw new Error("Гэрэл хадгалагдсангүй. Интернэт холболтоо шалгаад дахин оролдоно уу.");
    light = { ...data, id: String(data.id) } as Light;
  } else {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify([light, ...readLocal()].slice(0, 300)));
    } catch {
      /* хадгалах боломжгүй браузер: зөвхөн энэ хуудсанд харагдана */
    }
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: light }));
  return light;
}

// Шинэ гэрэл ирэхэд дуудагдана (энэ хуудсанд ба realtime-аар бусдаас)
export function subscribeLights(cb: (l: Light) => void) {
  const local = (e: Event) => cb((e as CustomEvent<Light>).detail);
  window.addEventListener(EVENT, local);
  const s = supa();
  const channel = s
    ?.channel("lights-feed")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "lights" }, (p) => {
      const l = p.new as Light;
      cb({ ...l, id: String(l.id) });
    })
    .subscribe();
  return () => {
    window.removeEventListener(EVENT, local);
    if (s && channel) s.removeChannel(channel);
  };
}

export function getSavedAimag(): string | null {
  try {
    return localStorage.getItem(AIMAG_KEY);
  } catch {
    return null;
  }
}
export function saveAimag(id: string) {
  try {
    localStorage.setItem(AIMAG_KEY, id);
  } catch {
    /* хадгалахгүй байсан ч болно */
  }
}

// "3 мин өмнө" гэх мэт
export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "саяхан";
  if (s < 3600) return `${Math.floor(s / 60)} мин өмнө`;
  if (s < 86400) return `${Math.floor(s / 3600)} цагийн өмнө`;
  return `${Math.floor(s / 86400)} өдрийн өмнө`;
}
