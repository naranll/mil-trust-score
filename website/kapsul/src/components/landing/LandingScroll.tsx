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

export function LandingScroll() {
  const root = useRef<HTMLElement>(null);
  const trigger = useRef<ScrollTrigger | null>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(root);
        const area = q("[data-area]")[0] as HTMLElement;
        const svg = root.current!.querySelector("[data-capsule] svg") as SVGSVGElement;
        const pills = q("[data-pill]") as HTMLElement[];

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
            end: "+=300%",
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });
        trigger.current = tl.scrollTrigger ?? null;

        // 2. Хуваагдах: хагасууд салж, эмүүд голоос гарна
        tl.to(q('[data-caption="0"]'), { autoAlpha: 0, y: -24, duration: 0.4 }, 0)
          .fromTo(q('[data-caption="2"]'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.4 }, 0.3)
          .to(q('[data-cap-half="top"]'), { y: () => -split(), rotation: -10, svgOrigin: "70 150", duration: 1 }, 0)
          .to(q('[data-cap-half="bottom"]'), { y: () => split(), rotation: 10, svgOrigin: "70 150", duration: 1 }, 0)
          .fromTo(
            pills,
            { x: (_i, el) => toCenter(el).x, y: (_i, el) => toCenter(el).y, scale: 0.2, autoAlpha: 0 },
            {
              x: (i, el) => toCenter(el).x + (i - 2) * 64,
              y: (i, el) => toCenter(el).y + Math.abs(i - 2) * 14 - 10,
              scale: 0.55,
              autoAlpha: 1,
              duration: 0.8,
            },
            0.2,
          )
          .set(q("[data-pill-text]"), { autoAlpha: 0 }, 0);

        // 3. Байрлах: капсул алга болж, эмүүд байрандаа, нэр, тайлбар нь гарна
        tl.to(q("[data-cap-half]"), { autoAlpha: 0, duration: 0.4 }, 1.2)
          .to(q('[data-caption="2"]'), { autoAlpha: 0, y: -24, duration: 0.4 }, 1.2)
          .to(q('[data-caption="0"]'), { autoAlpha: 1, y: 0, duration: 0.4 }, 1.5)
          .to(pills, { x: 0, y: 0, scale: 1, duration: 1, stagger: 0.04 }, 1.2)
          .to(q("[data-pill-text]"), { autoAlpha: 1, duration: 0.4, stagger: 0.05 }, 1.9)
          .to({}, { duration: 0.3 }); // эцэст бага зэрэг зогсоно

        return () => {
          trigger.current = null;
        };
      });
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
      <div className="mx-auto flex min-h-svh max-w-6xl flex-col px-5 pt-24 pb-6">
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

        <div data-area className="relative flex flex-1 items-center justify-center py-6">
          <div data-capsule className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div data-cap-scale>
              <div className="cap-idle">
                <Capsule className="w-[clamp(72px,11vw,120px)]" />
              </div>
            </div>
          </div>

          <ul id="sections" className="relative flex w-full flex-col gap-2 md:grid md:grid-cols-5 md:items-end md:gap-4">
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
