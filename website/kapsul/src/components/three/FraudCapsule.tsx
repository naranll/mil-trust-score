"use client";

// 3D viz 1: залилангийн капсул. Хэсэг бүр = нэг хувь (нийт 500 хэсэг).
// Таб солиход капсул дахин хаагдаж, шинэ найрлагаар нээгдэнэ.
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { SourceLink } from "@/components/ui/Pill";
import type { Stat } from "@/data/stats";

const CapsuleScene = dynamic(() => import("./CapsuleScene"), { ssr: false });

const TOTAL = 500;

export type FraudView = {
  id: string;
  tab: string;
  share: number; // ember хэсгийн хувь
  mainLabel: string;
  restLabel: string;
  sentence: string;
  stat: Stat;
};

export function FraudCapsule({ views }: { views: FraudView[] }) {
  const [active, setActive] = useState(0);
  const openRef = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const inView = useRef(false);
  const v = views[active];

  // Харагдах үед болон таб солиход капсул аажим нээгдэнэ
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const run = () => {
      if (reduce) {
        openRef.current = 1;
        return;
      }
      openRef.current = 0;
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - t0) / 1800, 1);
        openRef.current = t;
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    if (inView.current) run();
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !inView.current) {
          inView.current = true;
          run();
        }
      },
      { threshold: 0.35 },
    );
    if (box.current) io.observe(box.current);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [active]);

  const ember = Math.round((v.share / 100) * TOTAL);
  const groups = [
    { color: "#0072b2", count: ember },
    { color: "#c9ced6", count: TOTAL - ember },
  ];

  return (
    <div ref={box} className="grid gap-8 md:grid-cols-[1fr_1.15fr] md:items-center">
      <div>
        <div role="tablist" aria-label="Харах өгөгдөл" className="inline-flex flex-wrap gap-1.5 rounded-2xl bg-subtle p-1.5">
          {views.map((x, i) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                i === active ? "bg-inverse text-on-inverse" : "text-ink hover:bg-subtle"
              }`}
            >
              {x.tab}
            </button>
          ))}
        </div>

        <p className="font-display mt-8 text-[clamp(3.2rem,8vw,5.5rem)] leading-none font-bold tracking-[-0.025em] text-ink tnum">
          {v.share}
          <span className="text-[0.45em]">%</span>
        </p>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-ink">{v.sentence}</p>
        <ul className="mt-5 space-y-2 text-sm text-ink">
          <li className="flex items-center gap-2.5">
            <span aria-hidden className="size-3.5 rounded-full bg-accent" /> {v.mainLabel}
          </li>
          <li className="flex items-center gap-2.5">
            <span aria-hidden className="size-3.5 rounded-full bg-[#c9ced6]" /> {v.restLabel}
          </li>
        </ul>
        <p className="mt-5 text-ink-2">
          <SourceLink source={v.stat.source} period={v.stat.period} />
        </p>
      </div>

      <div className="relative h-[24rem] rounded-2xl bg-subtle md:h-[30rem]">
        <CapsuleScene
          key={v.id}
          openRef={openRef}
          groups={groups}
          seed={active + 3}
          scale={0.95}
          offsetY={0.7}
          label={`${v.sentence} Капсулын ${TOTAL} хэсгийн ${ember} нь цэнхэр.`}
        />
      </div>
    </div>
  );
}
