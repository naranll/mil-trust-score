// «Бараг бүгдээрээ нэг feed-ээс уншдаг»: хувь бүрийг 100 одоор харуулна, хувьд тохирох тооны од гэрэлтэнэ.
// StarViz-ийн дотор (#mv-viz) нэг plate болж орно, тиймээс одны хэлбэр, өнгө нь бусад графиктай ижил.
// #mv-viz дотор h2, p-ийн margin 0 тул зайг gap-аар тохируулна.
import { SourceLink } from "@/components/ui/Pill";
import type { Stat } from "@/data/stats";
import { starPath } from "./star-viz-engine";

const STAR = starPath(4, 6.5);
const CELL = 18;

function StarGrid({ value }: { value: number }) {
  const lit = Math.round(value);
  return (
    <svg viewBox={`0 0 ${CELL * 10} ${CELL * 10}`} aria-hidden className="w-full max-w-[220px]">
      {Array.from({ length: 100 }, (_, i) => {
        const on = i < lit;
        return (
          <path
            key={i}
            d={STAR}
            transform={`translate(${(i % 10) * CELL + CELL / 2},${Math.floor(i / 10) * CELL + CELL / 2})`}
            fill={on ? "var(--blue)" : "var(--faint)"}
            opacity={on ? 1 : 0.22}
            style={on ? { filter: "drop-shadow(0 0 3px var(--blue))" } : undefined}
          />
        );
      })}
    </svg>
  );
}

export function FeedStars({ facts }: { facts: { s: Stat; text: string }[] }) {
  return (
    <section className="plate" aria-labelledby="mv-t0">
      <div className="flex flex-col gap-2">
        <h2 id="mv-t0">Бараг бүгдээрээ нэг feed-ээс уншдаг</h2>
        <p className="text-[15px] text-[var(--muted)]">Од бүр = 1%</p>
      </div>
      <ul className="grid gap-10 sm:grid-cols-3 sm:gap-8">
        {facts.map(({ s, text }) => (
          <li key={s.key} className="flex flex-col gap-3">
            <StarGrid value={s.value} />
            <span className="text-[31.25px] leading-none font-bold text-[var(--text)] tabular-nums">{s.value}%</span>
            <span className="text-[var(--muted)]">{text}</span>
            <SourceLink source={s.source} period={s.period} className="text-[var(--faint)]" />
          </li>
        ))}
      </ul>
    </section>
  );
}
