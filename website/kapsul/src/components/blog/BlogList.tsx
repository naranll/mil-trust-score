"use client";

// Блогийн жагсаалт: давхаргаар шүүх товчнууд (өнгө нь давхаргыг заана), хамгийн сүүлийн нийтлэл том,
// бусад нь доор хоёр баганаар.
import Link from "next/link";
import { useState } from "react";
import { DotCapsule } from "@/components/ui/DotCapsule";
import { LAYERS, layerColor } from "@/data/layers";
import type { PostMeta } from "@/lib/blog";

function mnDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return `${y} оны ${m} сарын ${day}`;
}

function Meta({ p }: { p: PostMeta }) {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-ink-2">
      <span className="inline-flex items-center gap-2 font-semibold text-ink">
        <span aria-hidden className="size-2.5 rounded-full" style={{ background: layerColor(p.layer) }} />
        {p.layer}
      </span>
      <time dateTime={p.date}>{mnDate(p.date)}</time>
    </p>
  );
}

export function BlogList({ posts }: { posts: PostMeta[] }) {
  const [layer, setLayer] = useState<string | null>(null);
  const layers = LAYERS.filter((l) => posts.some((p) => p.layer === l.name));
  const shown = layer ? posts.filter((p) => p.layer === layer) : posts;
  const [lead, ...rest] = shown;

  const chip = (name: string | null, label: string, color?: string) => {
    const on = layer === name;
    return (
      <button
        key={label}
        type="button"
        aria-pressed={on}
        onClick={() => setLayer(name)}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[15px] transition-colors duration-[var(--dur-base)] ${
          on ? "border-transparent bg-ink text-bg" : "border-line text-ink-2 hover:border-ink-3 hover:text-ink"
        }`}
      >
        {color && <span aria-hidden className="size-2.5 rounded-full" style={{ background: color }} />}
        {label}
      </button>
    );
  };

  return (
    <>
      <div role="group" aria-label="Давхаргаар шүүх" className="mt-8 flex flex-wrap gap-2">
        {chip(null, "Бүгд")}
        {layers.map((l) => chip(l.name, l.name, l.particle))}
      </div>

      {lead && (
        <Link
          href={`/blog/${lead.slug}`}
          className="group mt-10 grid overflow-hidden rounded-2xl border border-line outline-offset-4 md:mt-14 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
        >
          <div
            className="flex h-48 items-center justify-center md:h-auto md:min-h-80"
            style={{ background: `color-mix(in oklab, ${layerColor(lead.layer)} 10%, transparent)` }}
          >
            <DotCapsule color={layerColor(lead.layer)} className="h-36 w-20 md:h-56 md:w-32" />
          </div>
          <div className="flex flex-col justify-center gap-4 p-6 md:p-12">
            <Meta p={lead} />
            <h2 className="max-w-[20ch] text-[clamp(1.75rem,3.4vw,2.75rem)] leading-[1.1] font-bold text-ink transition-colors duration-[var(--dur-base)] group-hover:text-accent">
              {lead.title}
            </h2>
            <p className="max-w-[56ch] text-lg leading-relaxed text-ink-2">{lead.excerpt}</p>
            <span className="mt-2 font-semibold text-accent">Унших</span>
          </div>
        </Link>
      )}

      {rest.length > 0 && (
        <ul className="mt-6 grid gap-6 md:mt-10 md:grid-cols-2 md:gap-10">
          {rest.map((p) => (
            <li key={p.slug} className="border-t border-line">
              <Link href={`/blog/${p.slug}`} className="group grid grid-cols-[2.5rem_1fr] gap-5 pt-6 outline-offset-4 md:grid-cols-[3.5rem_1fr] md:pt-8">
                <DotCapsule color={layerColor(p.layer)} className="h-[4.5rem] w-10 md:h-24 md:w-14" />
                <div className="min-w-0">
                  <Meta p={p} />
                  <h2 className="mt-2 text-[22px] leading-snug font-bold text-ink transition-colors duration-[var(--dur-base)] group-hover:text-accent md:text-[25px]">
                    {p.title}
                  </h2>
                  <p className="mt-2 max-w-[56ch] leading-relaxed text-ink-2">{p.excerpt}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
