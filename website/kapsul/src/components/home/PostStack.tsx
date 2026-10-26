"use client";

// Нүүрний гол дүрс: худал пост бол зөвхөн дээд давхарга. Дарахад доорх 3 давхарга (тархалт,
// үйлдвэрлэл, танин мэдэхүй) задарч харагдана. CSS 3D: three.js ачаалахгүй, хурдан.
import type { CSSProperties, ReactNode } from "react";
import { LAYERS } from "@/data/layers";

type Props = {
  open: boolean;
  selected: number | null;
  hover: number | null;
  onOpen: () => void;
  onSelect: (i: number) => void;
  onHover: (i: number | null) => void;
  still: boolean;
};

// Давхарга бүрийн жижиг зураг (зохиомол, тайлбарын зориулалттай)
function Art({ id, color }: { id: string; color: string }): ReactNode {
  const s = { stroke: color, fill: "none", strokeWidth: 2, strokeLinecap: "round" as const };
  if (id === "distribution")
    // Нэг пост → олон feed: тархалтын мод
    return (
      <svg viewBox="0 0 200 90" aria-hidden className="h-full w-full">
        <circle cx="30" cy="45" r="7" fill={color} />
        {[15, 45, 75].map((y) => (
          <g key={y}>
            <path d={`M37 45 C70 45 70 ${y} 100 ${y}`} {...s} opacity="0.7" />
            <circle cx="106" cy={y} r="5" fill={color} opacity="0.85" />
            {[-9, 0, 9].map((d) => (
              <g key={d}>
                <path d={`M111 ${y} L150 ${y + d}`} {...s} strokeWidth={1.5} opacity="0.45" />
                <circle cx="155" cy={y + d} r="3" fill={color} opacity="0.6" />
              </g>
            ))}
          </g>
        ))}
      </svg>
    );
  if (id === "production")
    // Ижил агуулга тараадаг олон пэйж
    return (
      <svg viewBox="0 0 200 90" aria-hidden className="h-full w-full">
        {Array.from({ length: 12 }, (_, k) => {
          const x = 22 + (k % 6) * 28, y = 18 + Math.floor(k / 6) * 34;
          return (
            <g key={k} opacity={k === 0 ? 1 : 0.55}>
              <rect x={x} y={y} width="20" height="24" rx="4" {...s} strokeWidth={1.5} />
              <circle cx={x + 10} cy={y + 9} r="3.5" fill={color} />
              <path d={`M${x + 5} ${y + 18} H${x + 15}`} {...s} strokeWidth={1.5} />
            </g>
          );
        })}
      </svg>
    );
  // cognition: бодол, итгэх хандлага
  return (
    <svg viewBox="0 0 200 90" aria-hidden className="h-full w-full">
      <path d="M58 70c-14 0-24-10-24-24s12-26 30-26c6-10 20-14 30-8 8-6 24-4 30 6 14 0 24 10 24 22s-10 24-26 24H82l-14 12 2-12z" {...s} />
      <path d="M78 46l10 10 22-22" {...s} strokeWidth={3} />
    </svg>
  );
}

function PostFace() {
  return (
    <div className="flex h-full flex-col gap-3 p-5 text-left">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-subtle text-[15px] font-bold text-ink-2">
          Э
        </span>
        <span className="flex flex-col leading-tight">
          <span className="font-semibold text-ink">Эрүүл амьдрал</span>
          <span className="text-[13px] text-ink-3">2 цагийн өмнө · зохиомол пост</span>
        </span>
      </div>
      <p className="text-[17px] leading-snug font-semibold text-ink">
        ЭМЧ НАР НУУЖ БАЙНА! Энэ ундааг 7 хоног уувал хорт хавдар 100% эдгэрнэ
      </p>
      <div className="mt-auto flex gap-4 border-t border-[var(--rule)] pt-3 text-[13px] font-semibold text-ink-3">
        <span>12 мянган хуваалцсан</span>
        <span>3.4 мянган сэтгэгдэл</span>
      </div>
    </div>
  );
}

export function PostStack({ open, selected, hover, onOpen, onSelect, onHover, still }: Props) {
  const n = LAYERS.length;
  const ease = still ? "none" : "transform 700ms cubic-bezier(.2,.8,.2,1), box-shadow 250ms ease, opacity 250ms ease";

  return (
    <div className="flex h-full w-full items-center justify-center [perspective:1600px]">
      <div
        className="relative w-[min(22rem,78vw)] [--gap:clamp(44px,13vw,72px)] [--open-scale:0.78] [transform-style:preserve-3d] md:[--open-scale:1]"
        style={{
          aspectRatio: "4 / 3",
          // Утсан дээр задарсан овоолгыг жижигрүүлж, цэс рүү давахаас сэргийлнэ
          transform: open ? "rotateX(56deg) rotateZ(-32deg) scale(var(--open-scale))" : "none",
          transition: still ? "none" : "transform 800ms cubic-bezier(.2,.8,.2,1)",
        }}
      >
        {/* Доороос дээш зурна: дээд давхарга (пост) хамгийн сүүлд */}
        {[...LAYERS].reverse().map((l) => {
          const i = l.depth - 1;
          const isSel = open && selected === i;
          const isHover = open && hover === i && !isSel;
          const dim = open && selected !== null && !isSel && !isHover;
          const lift = isHover ? 14 : 0;
          const style: CSSProperties = {
            // --gap: утсан дээр давхаргын зай багасна, задарсан овоолго дэлгэцээс халихгүй
            transform: open
              ? `translateZ(calc(var(--gap) * ${n - 1 - i - (n - 1) / 2} + ${lift}px))`
              : `translateY(${i * 9}px) scale(${1 - i * 0.04})`,
            transition: ease,
            zIndex: n - i,
            opacity: dim ? 0.55 : 1,
            borderColor: isSel ? l.particle : `color-mix(in srgb, ${l.particle} 40%, transparent)`,
            background: i === 0 ? "var(--surface)" : `color-mix(in srgb, ${l.particle} 12%, var(--surface))`,
            boxShadow: isSel
              ? `0 0 0 2px ${l.particle}, 0 24px 60px rgba(0,0,0,.45)`
              : "0 18px 50px rgba(0,0,0,.35)",
          };
          const label = !open
            ? "Постыг давхаргаар нь задлах"
            : `${l.depth}. ${l.name}: ${l.question}`;
          return (
            <button
              key={l.id}
              type="button"
              aria-label={label}
              aria-pressed={open ? isSel : undefined}
              tabIndex={!open && i > 0 ? -1 : 0}
              onClick={() => (open ? onSelect(i) : onOpen())}
              onMouseEnter={() => open && onHover(i)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => open && onHover(i)}
              onBlur={() => onHover(null)}
              className="absolute inset-0 cursor-pointer overflow-hidden rounded-2xl border text-left outline-offset-4"
              style={style}
            >
              {i === 0 ? (
                <PostFace />
              ) : (
                // Нэрийг доод ирмэгт: задарсан үед дээд хавтан нь энэ хавтангийн дээд хэсгийг халхална
                <div className="flex h-full flex-col p-5">
                  <div className="min-h-0 flex-1">
                    <Art id={l.id} color={l.particle} />
                  </div>
                  <span className="mt-2 flex items-center gap-2 font-semibold text-ink">
                    <span aria-hidden className="size-3 rounded-full" style={{ background: l.particle }} />
                    {l.name}
                  </span>
                </div>
              )}
              {/* Нээгдсэн үед дээд давхарга ч нэрээ харуулна */}
              {i === 0 && open && (
                <span
                  className="absolute top-3 right-3 flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold text-on-accent"
                  style={{ background: l.particle }}
                >
                  {l.name}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
