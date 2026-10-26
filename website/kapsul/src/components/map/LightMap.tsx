"use client";

// Гэрлийн газрын зураг: 3D хэсэг + мэдээллийн самбарууд (tsaaguur.mn/network-ийн бүтцээр).
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AIMAG_BY_ID } from "@/data/aimags";
import { KIND_COLOR, fetchLights, isLive, subscribeLights, timeAgo, type Light } from "@/lib/lights";
import { ShareButton } from "./ShareButton";

const MapScene = dynamic(() => import("./MapScene"), { ssr: false });

export function LightMap() {
  const [lights, setLights] = useState<Light[]>([]);
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    setLive(isLive());
    let alive = true;
    fetchLights().then((l) => {
      if (alive) {
        setLights(l);
        setReady(true);
      }
    });
    const off = subscribeLights((l) => setLights((prev) => (prev.some((p) => p.id === l.id) ? prev : [l, ...prev])));
    const t = setInterval(() => tick((n) => n + 1), 30000); // "N мин өмнө"-г шинэчилнэ
    return () => {
      alive = false;
      off();
      clearInterval(t);
    };
  }, []);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    let game = 0;
    let share = 0;
    for (const l of lights) {
      counts[l.aimag] = (counts[l.aimag] ?? 0) + 1;
      if (l.kind === "game") game++;
      else share++;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return { counts, game, share, top, aimags: Object.keys(counts).length };
  }, [lights]);

  const last = lights[0];

  return (
    <div className="theme-dark relative overflow-hidden rounded-2xl bg-bg text-ink shadow-2">
      <div className="h-[21rem] md:h-[40rem]" role="img" aria-label={`Монгол Улсын газрын зураг. ${stats.aimags} аймагт нийт ${lights.length} гэрэл асчээ.`}>
        <MapScene lights={lights} counts={stats.counts} />
      </div>

      {/* Зүүн дээд: гол тоо */}
      <div className="p-4 pb-0 md:pointer-events-none md:absolute md:top-4 md:left-4 md:w-80 md:p-0">
        <div className="pointer-events-auto rounded-2xl bg-surface p-5 shadow-1">
          <p className="text-[15px] text-ink-2">Асаасан гэрэл</p>
          <p className="text-[39px] leading-[1.15] font-bold tnum" aria-live="polite">
            {ready ? lights.length.toLocaleString("mn-MN") : "…"}
          </p>
          {stats.top ? (
            <p className="mt-2 text-[15px] text-ink-2">
              Хамгийн гэрэлтэй нь <span className="font-semibold text-ink">{AIMAG_BY_ID[stats.top[0]]?.name}</span> (
              <span className="tnum">{stats.top[1]}</span>)
            </p>
          ) : (
            ready && <p className="mt-2 text-[15px] text-ink-2">Эхний гэрлийг та асаагаарай.</p>
          )}
          {last && AIMAG_BY_ID[last.aimag] && (
            <p className="mt-1 text-[12.8px] text-ink-3">
              Сүүлийнх: {AIMAG_BY_ID[last.aimag].name}, {last.kind === "game" ? "тоглоом" : "хуваалцсан"}, {timeAgo(last.created_at)}
            </p>
          )}
        </div>
      </div>

      {/* Доод хэсэг: тайлбар ба үйлдэл */}
      <div className="flex flex-col gap-3 p-4 md:pointer-events-none md:absolute md:inset-x-4 md:bottom-4 md:flex-row md:items-end md:justify-between md:p-0">
        <ul className="pointer-events-auto flex flex-col gap-2 rounded-2xl bg-surface p-4 text-[15px] shadow-1 md:min-w-64">
          <li className="flex items-center gap-2.5">
            <span aria-hidden className="size-3 rounded-full" style={{ background: KIND_COLOR.game }} />
            Тоглоом тоглосон
            <span className="ml-auto pl-4 text-ink-2 tnum">{stats.game}</span>
          </li>
          <li className="flex items-center gap-2.5">
            <span aria-hidden className="size-3 rounded-full" style={{ background: KIND_COLOR.share }} />
            Мэдлэг хуваалцсан
            <span className="ml-auto pl-4 text-ink-2 tnum">{stats.share}</span>
          </li>
          <li className="mt-1 flex items-center gap-2 text-[12.8px] text-ink-3">
            <span aria-hidden className={`size-2 rounded-full ${live ? "bg-cat-3" : "bg-ink-3"}`} />
            {live ? "Шууд" : "Зөвхөн энэ төхөөрөмж"}
          </li>
        </ul>

        <div className="pointer-events-auto rounded-2xl bg-surface p-5 shadow-1 md:max-w-sm">
          <p className="text-[20px] leading-snug font-semibold">Тоглох, хуваалцах бүрт +1 гэрэл</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link href="/game" className="btn btn-primary">
              Тоглоом тоглох
            </Link>
            <ShareButton title="Cure from the Core: feed-ээ задлаад үзээрэй" path="/" quiet />
          </div>
        </div>
      </div>
    </div>
  );
}
