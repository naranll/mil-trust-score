"use client";

// Нүүрний гүйлгээтэй түүх (GSAP ScrollTrigger, pin + scrub). Капсул бүх хугацаанд голдоо:
// 0 танилцуулга → 2 хуваагдаж эмүүд гарна → 3 эмүүд байрандаа очиж, сайтын 5 хэсгийн холбоос болно.
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { SECTIONS, type SectionId } from "@/data/sections";
import { Capsule } from "./Capsule";
import { Pill } from "./Pill";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// Компьютер дээр Пост шалгагч голд (3-р байр), утсан дээр DOM-ын дарааллаар эхэнд
const DESKTOP_ORDER: Record<SectionId, string> = {
  data: "md:order-1",
  game: "md:order-2",
  extension: "md:order-3",
  blog: "md:order-4",
  about: "md:order-5",
};

// end: pin-ийн урт, fan: эмүүдийн хэвтээ тархалт (px), dots: тоосонцрын тоо, dist: цацралтын зай, jitter: чичиргээний хүч
type Mode = { end: string; fan: number; dots: number; dist: number; jitter: number };

// Тоосонцор: сайтын 5 хэсгийн өнгө + цагаан, ээлжлэн
const DOT_COLORS = [...SECTIONS.map((s) => s.color), "var(--text-primary)"];

export function LandingScroll() {
  const root = useRef<HTMLElement>(null);
  const trigger = useRef<ScrollTrigger | null>(null);

  useGSAP(
    () => {
      // Нэг timeline, хоёр тохиргоо (компьютер, утас). Хөдөлгөөн багасгасан үед юу ч үүсгэхгүй:
      // CSS эцсийн төлөвийг шууд харуулна (globals.css «Нүүрний гүйлгээтэй түүх»).
      const build = (m: Mode) => {
        const q = gsap.utils.selector(root);
        const area = q("[data-area]")[0] as HTMLElement;
        const svg = root.current!.querySelector("[data-capsule] svg") as SVGSVGElement;
        const pills = q("[data-pill]") as HTMLElement[];
        const dots = (q("[data-dot]") as HTMLElement[]).slice(0, m.dots);

        // Эм бүрийн эцсийн байрнаас капсулын төв хүртэлх зай (li нь хөдөлдөггүй тул хэмжилт зөв)
        const toCenter = (el: HTMLElement) => {
          const a = area.getBoundingClientRect();
          const r = (el.parentElement as HTMLElement).getBoundingClientRect();
          return { x: a.left + a.width / 2 - (r.left + r.width / 2), y: a.top + a.height / 2 - (r.top + r.height / 2) };
        };
        const split = () => svg.getBoundingClientRect().height * 0.42;

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: m.end,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });
        trigger.current = tl.scrollTrigger ?? null;
        tl.set(q("[data-pill-text]"), { autoAlpha: 0 }, 0);

        // 1. Асуудал: капсул томорч, «өвчтэй» мэт чичирнэ
        tl.to(q('[data-caption="0"]'), { autoAlpha: 0, y: -24, duration: 0.4 }, 0)
          .fromTo(q('[data-caption="1"]'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.4 }, 0.3)
          .to(q("[data-cap-scale]"), { scale: 1.15, duration: 0.8 }, 0)
          .fromTo(q(".cap-jitter"), { "--j": 0 }, { "--j": m.jitter, duration: 0.8 }, 0.1);

        // 2. Хуваагдах: хагасууд салж, эмүүд голоос гарч, тоосонцор цацарна
        const s2 = 1.1;
        tl.to(q('[data-caption="1"]'), { autoAlpha: 0, y: -24, duration: 0.4 }, s2)
          .fromTo(q('[data-caption="2"]'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.4 }, s2 + 0.3)
          .to(q(".cap-jitter"), { "--j": 0, duration: 0.2 }, s2)
          .to(q('[data-cap-half="top"]'), { y: () => -split(), rotation: -10, svgOrigin: "70 150", duration: 1 }, s2)
          .to(q('[data-cap-half="bottom"]'), { y: () => split(), rotation: 10, svgOrigin: "70 150", duration: 1 }, s2)
          .fromTo(
            pills,
            { x: (_i, el) => toCenter(el).x, y: (_i, el) => toCenter(el).y, scale: 0.2, autoAlpha: 0 },
            {
              x: (i, el) => toCenter(el).x + (i - 2) * m.fan,
              y: (i, el) => toCenter(el).y + Math.abs(i - 2) * 12 - 8,
              scale: 0.55,
              autoAlpha: 1,
              duration: 0.8,
            },
            s2 + 0.2,
          );
        dots.forEach((d, i) => {
          const angle = (i / dots.length) * Math.PI * 2 + (i % 3) * 0.35;
          const dist = m.dist * (0.55 + ((i * 37) % 45) / 100);
          // Эхэндээ нуугдмал (буцааж гүйлгэхэд ч), нээгдэх агшинд гарч ирээд тарна
          tl.fromTo(d, { x: 0, y: 0, scale: 1, autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, s2 + 0.15).to(
            d,
            { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, scale: 0.3, autoAlpha: 0, duration: 0.7, ease: "power2.out" },
            s2 + 0.16,
          );
        });

        // 3. Байрлах: капсул алга болж, эмүүд байрандаа, нэр, тайлбар нь гарна
        const s3 = 2.3;
        tl.to(q("[data-cap-half]"), { autoAlpha: 0, duration: 0.4 }, s3)
          .to(q("[data-scroll-hint]"), { autoAlpha: 0, duration: 0.3 }, s3)
          .to(q('[data-caption="2"]'), { autoAlpha: 0, y: -24, duration: 0.4 }, s3)
          .to(q('[data-caption="0"]'), { autoAlpha: 1, y: 0, duration: 0.4 }, s3 + 0.3)
          .to(pills, { x: 0, y: 0, scale: 1, duration: 1, stagger: 0.04 }, s3)
          .to(q("[data-pill-text]"), { autoAlpha: 1, duration: 0.4, stagger: 0.05 }, s3 + 0.7)
          .to({}, { duration: 0.3 }); // эцэст бага зэрэг зогсоно

        return () => {
          trigger.current = null;
        };
      };

      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () =>
        build({ end: "+=300%", fan: 64, dots: 25, dist: 170, jitter: 1 }),
      );
      // Утас: богино гүйлгээ (нийт ~250vh), цөөн тоосонцор, сул чичиргээ, нарийн тархалт
      mm.add("(max-width: 767px) and (prefers-reduced-motion: no-preference)", () =>
        build({ end: "+=150%", fan: 30, dots: 10, dist: 110, jitter: 0.6 }),
      );
    },
    { scope: root },
  );

  // «Алгасах»: pin-ийн төгсгөл рүү (хөдөлгөөнгүй үед #sections холбоос шууд ажиллана)
  const skip = (e: React.MouseEvent) => {
    const st = trigger.current;
    if (!st) return;
    e.preventDefault();
    window.scrollTo({ top: st.end, behavior: "smooth" });
  };

  return (
    // -mt-14: sticky цэсний доогуур орж, эхний дэлгэцийг бүтэн эзэлнэ
    <section ref={root} data-landing aria-labelledby="landing-title" className="relative -mt-14">
      <div className="mx-auto flex min-h-svh max-w-6xl flex-col px-5 pt-20 pb-4 md:pt-24 md:pb-6">
        {/* Үе шат бүрийн бичвэр нэг нүдэнд давхцаж байрлана */}
        <div className="mx-auto grid max-w-2xl text-center [&>*]:[grid-area:1/1]">
          <div data-caption="0">
            <h1 id="landing-title" className="text-[clamp(2.75rem,7vw,4.75rem)] leading-[1.02] font-bold tracking-tight text-ink">
              Cure the Core
            </h1>
            <p className="mt-3 text-lg text-ink-2 md:text-xl">Таны Facebook feed-ийг хэн сонгодог вэ?</p>
          </div>
          <div data-caption="1" className="self-center text-xl leading-snug text-ink md:text-[25px]">
            <p>Таны харж буй пост бүрийг алгоритм сонгодог.</p>
            <p className="mt-2 text-ink-2">Хамгийн их сэтгэл хөдлөл төрүүлдэг нь хамгийн хурдан тархдаг.</p>
          </div>
          <div data-caption="2" className="self-center text-xl leading-snug md:text-[25px]">
            <p className="font-bold text-ink">Нэг эм хангалтгүй.</p>
            <p className="mt-2 text-ink-2">Манипуляцаас хамгаалах ганц шийдэл гэж байхгүй.</p>
          </div>
        </div>

        <div data-area className="relative flex flex-1 items-center justify-center py-3 md:py-6">
          <div data-capsule className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div data-cap-scale>
              <div className="cap-jitter">
                <div className="cap-idle">
                  <Capsule className="w-[clamp(72px,11vw,120px)]" />
                </div>
              </div>
            </div>
            {/* Нээгдэх үеийн тоосонцор (25; утсан дээр эхний 10 нь л хөдөлнө) */}
            <div aria-hidden className="absolute top-1/2 left-1/2">
              {Array.from({ length: 25 }, (_, i) => (
                <span
                  key={i}
                  data-dot
                  className="invisible absolute -mt-1 -ml-1 size-2 rounded-full"
                  style={{ background: DOT_COLORS[i % DOT_COLORS.length] }}
                />
              ))}
            </div>
          </div>

          <ul id="sections" className="relative flex w-full flex-col gap-1 md:grid md:grid-cols-5 md:items-end md:gap-4">
            {SECTIONS.map((s) => (
              <li key={s.id} data-slot className={DESKTOP_ORDER[s.id]}>
                <Pill s={s} big={s.id === "extension"} />
              </li>
            ))}
          </ul>
        </div>

        <div data-scroll-hint className="flex items-center justify-between text-[15px] font-semibold text-ink-3">
          <span>Гүйлгэх ↓</span>
          <a href="#sections" onClick={skip} className="btn-quiet inline-flex min-h-11 items-center">
            Алгасах →
          </a>
        </div>
      </div>
    </section>
  );
}
