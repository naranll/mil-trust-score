"use client";

// Нүүрний гүйлгээтэй түүх: капсул → өвчин → хуваагдах → 5 эм (сайтын 5 хэсэг).
import Link from "next/link";
import { SECTIONS, type SectionId } from "@/data/sections";
import { Capsule } from "./Capsule";
import { Pill } from "./Pill";

// Компьютер дээр Пост шалгагч голд (3-р байр), утсан дээр DOM-ын дарааллаар эхэнд
const DESKTOP_ORDER: Record<SectionId, string> = {
  data: "md:order-1",
  game: "md:order-2",
  extension: "md:order-3",
  blog: "md:order-4",
  about: "md:order-5",
};

export function LandingScroll() {
  return (
    // -mt-14: sticky цэсний доогуур орж, эхний дэлгэцийг бүтэн эзэлнэ
    <section aria-labelledby="landing-title" className="relative -mt-14">
      <div className="mx-auto flex min-h-[100svh] max-w-6xl flex-col px-5 pt-24 pb-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 id="landing-title" className="text-[clamp(2.75rem,7vw,4.75rem)] leading-[1.02] font-bold tracking-tight text-ink">
            Cure the Core
          </h1>
          <p className="mt-3 text-lg text-ink-2 md:text-xl">Таны Facebook feed-ийг хэн сонгодог вэ?</p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-10 py-8">
          <Capsule className="w-[clamp(72px,12vw,120px)] -rotate-12" />
          <ul id="sections" className="flex w-full flex-col gap-2 md:grid md:grid-cols-5 md:items-end md:gap-4">
            {SECTIONS.map((s) => (
              <li key={s.id} data-slot className={DESKTOP_ORDER[s.id]}>
                <Pill s={s} big={s.id === "extension"} />
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between text-[15px] font-semibold text-ink-3">
          <span>Гүйлгэх ↓</span>
          <Link href="#sections" className="btn-quiet inline-flex min-h-11 items-center">
            Алгасах →
          </Link>
        </div>
      </div>
    </section>
  );
}
