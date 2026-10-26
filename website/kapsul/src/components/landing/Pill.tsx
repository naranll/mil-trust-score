// Нэг өнгөт эм = сайтын нэг хэсэг рүү орох холбоос. Өнгө: src/data/sections.ts.
// Бүтэц: <li data-slot> (байрлалыг хэмжинэ, хөдөлдөггүй) > <a data-pill> (GSAP хөдөлгөнө).
import Link from "next/link";
import type { CSSProperties } from "react";
import type { Section } from "@/data/sections";

export function PillArt({ color, className = "" }: { color: string; className?: string }) {
  return (
    <svg viewBox="-3 -3 102 46" aria-hidden className={className} overflow="visible">
      <path d="M20 2h28v36H20a18 18 0 0 1 0-36z" fill={color} />
      <path d="M48 2h28a18 18 0 0 1 0 36H48z" fill={`color-mix(in srgb, ${color} 35%, white)`} />
      <path d="M20 2h56a18 18 0 0 1 0 36H20a18 18 0 0 1 0-36z" fill="none" stroke={color} strokeWidth="3" />
      <path d="M14 14a10 10 0 0 1 8-6" fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Pill({ s, big = false }: { s: Section; big?: boolean }) {
  return (
    <Link
      href={s.href}
      {...(s.external ? { target: "_blank", rel: "noreferrer" } : {})}
      data-pill={s.id}
      style={{ "--c": s.color } as CSSProperties}
      className="group flex items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors duration-[var(--dur-fast)] hover:bg-[color-mix(in_srgb,var(--c)_14%,transparent)] focus-visible:outline-[var(--c)] md:flex-col md:gap-3 md:p-4 md:text-center"
    >
      <span data-pill-art className="shrink-0">
        <PillArt
          color={s.color}
          className={`block transition-transform duration-[var(--dur-base)] ease-out group-hover:-translate-y-1 group-hover:-rotate-6 group-focus-visible:-rotate-6 ${
            big ? "w-20 md:w-36" : "w-16 md:w-24"
          }`}
        />
      </span>
      <span data-pill-text className="flex flex-col gap-0.5">
        <span className={`font-semibold text-ink ${big ? "text-[19px] md:text-[25px]" : "text-[17px] md:text-[20px]"}`}>{s.label}</span>
        <span className="text-[14px] leading-snug text-ink-2 md:max-w-[14rem] md:text-[15px]">{s.line}</span>
      </span>
    </Link>
  );
}
