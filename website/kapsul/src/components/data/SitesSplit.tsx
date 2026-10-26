"use client";

// 10 мэдээллийн сайтын уншигчид: Улаанбаатар ба орон нутаг. Эрэмбийг сольж, мөрүүд хөдөлж байраа солино.
import { useMemo, useState } from "react";

type Site = { name: string; ub: number };
const ROW = 52; // мөрийн өндөр (px)

export function SitesSplit({ sites }: { sites: Site[] }) {
  const [sort, setSort] = useState<"local" | "ub">("local");
  const order = useMemo(() => {
    const s = [...sites].sort((a, b) => (sort === "ub" ? b.ub - a.ub : a.ub - b.ub));
    return Object.fromEntries(s.map((x, i) => [x.name, i])) as Record<string, number>;
  }, [sites, sort]);
  const localMajority = sites.filter((s) => s.ub < 50).length;

  return (
    <div>
      <p className="text-[25px] leading-snug font-bold text-ink md:text-[31.25px]">
        {sites.length} сайтын {localMajority}-д нь уншигчдын олонх орон нутгийнх.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-[15px] text-ink-2">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-full bg-cat-1" /> Улаанбаатар
          </span>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-full bg-cat-2" /> Орон нутаг
          </span>
        </div>
        <div role="radiogroup" aria-label="Эрэмбэ" className="glass inline-flex rounded-full p-1">
          {(
            [
              ["local", "Орон нутаг ихтэй нь эхэнд"],
              ["ub", "Хот ихтэй нь эхэнд"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={sort === k}
              onClick={() => setSort(k)}
              className={`min-h-10 rounded-full px-4 text-[14px] font-semibold transition-colors ${sort === k ? "bg-ink text-bg" : "text-ink-2 hover:text-ink"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <ol className="relative mt-5" style={{ height: sites.length * ROW }} aria-label="Сайт бүрийн уншигчдын байршил">
        {/* 50%-ийн шугам */}
        <span aria-hidden className="absolute top-0 bottom-0 left-[calc(6.5rem+(100%-6.5rem)/2)] w-px border-l border-dashed border-ink-3/60" />
        {sites.map((s) => (
          <li
            key={s.name}
            className="absolute inset-x-0 grid grid-cols-[6.5rem_1fr] items-center transition-transform duration-[600ms] ease-[var(--ease-in-out-std)]"
            style={{ transform: `translateY(${order[s.name] * ROW}px)`, height: ROW }}
            aria-label={`${s.name}: Улаанбаатар ${s.ub}%, орон нутаг ${100 - s.ub}%`}
          >
            <span className="truncate pr-3 text-[15px] font-semibold text-ink">{s.name}</span>
            <span className="flex h-9 overflow-hidden rounded-full" aria-hidden>
              <span className="flex items-center bg-cat-1 pl-3 text-[14px] font-semibold text-white tnum" style={{ width: `${s.ub}%` }}>
                {s.ub}%
              </span>
              <span className="flex flex-1 items-center justify-end bg-cat-2 pr-3 text-[14px] font-semibold text-[#1b1d21] tnum">
                {100 - s.ub}%
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
