"use client";

// 100 капсул = 100 уншигч. Ангилал сонгоход тэдгээр капсулууд л тодорно.
import { useMemo, useState } from "react";

type Cat = { label: string; value: number };
// Okabe Ito-гийн 8 өнгө: ангилал олон тул өнгө дангаараа биш, сонголт ба бичвэр хамт тусална
const COLORS = ["#0072b2", "#e69f00", "#009e73", "#cc79a7", "#56b4e9", "#d55e00", "#f0e442", "#6a707a"];

export function ReadingWaffle({ cats }: { cats: Cat[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const cells = useMemo(() => cats.flatMap((c, i) => Array.from({ length: Math.round(c.value) }, () => i)).slice(0, 100), [cats]);
  const cur = sel !== null ? cats[sel] : cats[0];

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1fr] md:items-start">
      <div>
        <p className="text-[25px] leading-snug font-bold text-ink md:text-[31.25px]" aria-live="polite">
          100 уншигч тутмын <span className="tnum">{cur.value}</span> нь {cur.label.toLowerCase()} уншдаг.
        </p>
        <ul className="mt-6 grid gap-1.5" aria-label="Мэдээллийн төрөл">
          {cats.map((c, i) => (
            <li key={c.label}>
              <button
                type="button"
                aria-pressed={sel === i}
                onClick={() => setSel(sel === i ? null : i)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-full px-4 text-left text-[15px] transition-colors ${
                  sel === i ? "glass font-semibold text-ink" : "text-ink-2 hover:bg-subtle"
                }`}
              >
                <span aria-hidden className="h-3 w-6 shrink-0 rounded-full" style={{ background: COLORS[i] }} />
                <span className="flex-1">{c.label}</span>
                <span className="tnum">{c.value}%</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="glass grid grid-cols-10 gap-x-1.5 gap-y-2.5 rounded-2xl p-5 md:p-6" role="img" aria-label={`100 капсул: ${cats.map((c) => `${c.label} ${c.value}`).join(", ")}`}>
        {cells.map((ci, k) => (
          <button
            key={k}
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => setSel(ci)}
            className="h-3.5 rounded-full transition-[opacity,transform] duration-[var(--dur-base)] md:h-4"
            style={{
              background: COLORS[ci],
              opacity: sel === null || sel === ci ? 1 : 0.14,
              transform: sel === ci ? "scale(1.12)" : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}
