// Data viz-ийн тоог Supabase-ээс уншина. Env байхгүй эсвэл алдаа гарвал fallback руу шилжинэ.
import { cacheLife } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { FALLBACK_STATS, type Stat } from "@/data/stats";

export type StatsResult = { stats: Stat[]; origin: "supabase" | "fallback" };

type Row = {
  key: string;
  dataset: Stat["dataset"];
  label: string;
  value: number;
  unit: Stat["unit"];
  period: string;
  source_name: string;
  source_url: string;
};

export async function getStats(): Promise<StatsResult> {
  "use cache";
  cacheLife("minutes");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { stats: FALLBACK_STATS, origin: "fallback" };

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.from("mil_stats").select("*");
    if (error || !data || data.length === 0) return { stats: FALLBACK_STATS, origin: "fallback" };
    const stats: Stat[] = (data as Row[]).map((r) => ({
      key: r.key,
      dataset: r.dataset,
      label: r.label,
      value: Number(r.value),
      unit: r.unit,
      period: r.period,
      source: { name: r.source_name, url: r.source_url },
    }));
    return { stats, origin: "supabase" };
  } catch {
    return { stats: FALLBACK_STATS, origin: "fallback" };
  }
}

// Түлхүүрээр нэг тоо авах туслах
export function pick(stats: Stat[], key: string): Stat {
  return stats.find((s) => s.key === key) ?? FALLBACK_STATS.find((s) => s.key === key)!;
}
