"use client";

// Нүүрний гүйлгээтэй түүх (GSAP ScrollTrigger, pin + scrub). Цэгэн капсул бүтэн дэлгэцэн дээр.
// 0 «Cure the Core» капсулын урд → гүйлгэхэд үсгүүд хайлж алга болно, капсул баруун тийш шилжинэ →
// 1 өвчин (гадаргуу тогтворгүй, ~12% цэг улбар шар) → 2 хуваагдаж цацрана →
// 3 цэгүүд 5 өнгөт жижиг капсул = 5 дадал. Сайтын хэсгүүд рүү цэс (header) хөтөлнө.
// Утсан дээр 3-р үе шатанд canvas бүдгэрч, энгийн HTML жагсаалт гарна.
// Хөдөлгөөн багасгасан эсвэл WebGL байхгүй үед canvas-гүй, эцсийн төлөв шууд (data-mode="static").
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRenderMode } from "@/lib/render-mode";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { HABIT_BIG, HABITS } from "@/data/habits";
import type { Drive } from "./PointCapsule";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const PointCapsule = dynamic(() => import("./PointCapsule"), { ssr: false });

const TITLE = "Cure the Core";
const COLORS = HABITS.map((h) => h.color);


export function LandingScroll() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  // GSAP, хулгана, шошго бүгд энэ объектыг өөрчилнө; canvas frame бүрт уншина. Render үеэр уншихгүй.
  const driveRef = useRef<Drive>({
    assemble: 0,
    problem: 0,
    manip: 0,
    split: 0,
    burst: 0,
    regroup: 0,
    shift: 0,
    tilt: { x: 0, y: 0 },
    hover: -1,
    layout: { x0: 0, y0: 0, cx: 0, cy: 0, capH: 300, clusterH: 80, ex: 600, ey: 400, slots: Array(10).fill(0) },
  });

  const mode = useRenderMode();
  const count = useSyncExternalStore(
    () => () => {},
    () => (innerWidth < 768 ? 900 : 3000),
    () => 0,
  );
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);

  // Байрлал (px, canvas = бүтэн дэлгэцийн төвөөс, y дээшээ). Бөөгнөрөл бүр = шошгоныхоо яг дээр.
  const measure = () => {
    if (!area.current || !stage.current || !root.current) return;
    const c = stage.current.getBoundingClientRect();
    const a = area.current.getBoundingClientRect();
    const ccx = c.left + c.width / 2, ccy = c.top + c.height / 2;
    const ax = a.left + a.width / 2 - ccx, ay = ccy - (a.top + a.height / 2);
    const mobile = matchMedia("(max-width: 767px)").matches;
    const L = driveRef.current.layout;
    L.capH = mobile ? Math.min(a.height * 0.5, a.width * 0.95) : Math.min(a.height * 0.85, a.width * 0.36);
    L.x0 = ax;
    L.y0 = ay;
    L.cx = ax + (mobile ? 0 : a.width * 0.24);
    L.cy = ay + (mobile ? -a.height * 0.17 : 0);
    L.ex = c.width / 2;
    L.ey = c.height / 2;
    L.clusterH = mobile ? 50 : Math.min(a.height * 0.28, (a.width / 5) * 0.6);
    root.current.querySelectorAll<HTMLElement>("[data-label]").forEach((el) => {
      const i = Number(el.dataset.label);
      const half = (L.clusterH * (i === HABIT_BIG ? 1.3 : 1)) / 2;
      if (mobile) {
        // Утас: жагсаалтын мөр бүрийн зүүн талын тэмдгийн байранд
        const s = el.querySelector("[data-swatch]")!.getBoundingClientRect();
        L.slots[i * 2] = s.left + s.width / 2 - ccx;
        L.slots[i * 2 + 1] = ccy - (s.top + s.height / 2);
      } else {
        // Компьютер: шошгоны яг дээр
        const r = el.getBoundingClientRect();
        L.slots[i * 2] = r.left + r.width / 2 - ccx;
        L.slots[i * 2 + 1] = ccy - (r.top - 20 - half);
      }
    });
  };

  useEffect(() => {
    if (mode !== "anim" || !root.current) return;
    // Хуудаснаас гарсан үед рендер зогсоно
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting));
    io.observe(root.current);
    const ro = new ResizeObserver(measure);
    if (area.current) ro.observe(area.current);
    // Хулганаар бага зэрэг хазайна (≤ 6°), зөвхөн хулганатай төхөөрөмжид
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const onMove = (e: PointerEvent) => {
      const drive = driveRef.current;
      drive.tilt.x = (e.clientX / innerWidth - 0.5) * 0.21;
      drive.tilt.y = (e.clientY / innerHeight - 0.5) * 0.21;
    };
    if (fine) addEventListener("pointermove", onMove);
    return () => {
      io.disconnect();
      ro.disconnect();
      removeEventListener("pointermove", onMove);
    };
  }, [mode]);

  useGSAP(
    () => {
      if (mode !== "anim") return;
      const drive = driveRef.current;
      const build = (mobile: boolean) => {
        measure();
        const q = gsap.utils.selector(root);
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: mobile ? "+=150%" : "+=300%",
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
            onRefresh: measure,
          },
        });
        trigger.current = tl.scrollTrigger ?? null;

        // 0→1. Гарчгийн үсгүүд санамсаргүй дарааллаар бүдэгрэн хайлж, капсул баруун тийш шилжинэ
        tl.to(
          q("[data-char]"),
          { autoAlpha: 0, filter: "blur(14px)", yPercent: -35, scale: 1.2, duration: 0.35, stagger: { each: 0.025, from: "random" } },
          0,
        )
          .to(q('[data-caption="0"]'), { autoAlpha: 0, y: 16, duration: 0.3 }, 0)
          .to(drive, { shift: 1, duration: 0.8 }, 0.15)
          .fromTo(q('[data-caption="1"]'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.4 }, 0.55)
          .to(drive, { problem: 1, manip: 1, duration: 0.9 }, 0.2);

        // 2. Хуваагдаж, цацрах
        const s2 = 1.3;
        tl.to(q('[data-caption="1"]'), { autoAlpha: 0, y: -24, duration: 0.4 }, s2)
          .fromTo(q('[data-caption="2"]'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.4 }, s2 + 0.3)
          .to(drive, { split: 1, duration: 0.5 }, s2)
          .to(drive, { burst: 1, problem: 0, duration: 0.7 }, s2 + 0.45);

        // 3. Цэгүүд 5 өнгөт жижиг капсул = 5 дадал болно (компьютер: эгнээ, утас: мөр бүрийн зүүн талд)
        const s3 = 2.5;
        tl.to(q('[data-caption="2"]'), { autoAlpha: 0, y: -24, duration: 0.4 }, s3)
          .to(q("[data-scroll-hint]"), { autoAlpha: 0, duration: 0.3 }, s3)
          .fromTo(q("[data-final]"), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.4 }, s3 + 0.4)
          .to(drive, { regroup: 1, manip: 0, duration: 1 }, s3)
          .fromTo(
            q("[data-pill]"),
            { autoAlpha: 0, y: 12 },
            { autoAlpha: 1, y: 0, duration: 0.4, stagger: mobile ? 0.06 : 0.05 },
            s3 + 0.7,
          );
        tl.to({}, { duration: 0.3 }); // эцэст бага зэрэг зогсоно

        return () => {
          trigger.current = null;
        };
      };

      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => build(false));
      mm.add("(max-width: 767px) and (prefers-reduced-motion: no-preference)", () => build(true));
    },
    { scope: root, dependencies: [mode] },
  );

  // Ачаалахад цэгүүд тархсан байрлалаас капсул болж нэг удаа цугларна (~1.2с)
  const onReady = () => {
    setReady(true);
    gsap.to(driveRef.current, { assemble: 1, duration: 1.2, ease: "power2.out", delay: 0.1 });
  };

  // «Алгасах»: pin-ийн төгсгөл рүү (хөдөлгөөнгүй үед #habits холбоос шууд ажиллана)
  const skip = (e: React.MouseEvent) => {
    const st = trigger.current;
    if (!st) return;
    e.preventDefault();
    window.scrollTo({ top: st.end, behavior: "smooth" });
  };

  // static: хөдөлгөөн багасгасан (CSS-ээр шууд) эсвэл WebGL байхгүй (JS тогтоосны дараа)
  const flow = "group-data-[mode=static]:static motion-reduce:static";

  return (
    // -mt-16: sticky цэсний (64px) доогуур орж, эхний дэлгэцийг бүтэн эзэлнэ.
    // Гаднах div: GSAP pin нь section-ийг pin-spacer-ээр ороодог тул React-ийн эзэмшдэг эцэг хэрэгтэй,
    // эс бөгөөс өөр хуудас руу шилжихэд React DOM-оо олохгүй унана (insertBefore NotFoundError).
    <div className="-mt-16">
      <section ref={root} data-landing data-mode={mode} aria-labelledby="landing-title" className="group relative">
        <div ref={stage} className="relative flex min-h-svh w-full flex-col px-5 pt-20 pb-4 md:px-10 md:pt-24 md:pb-6 xl:px-16">
          {/* Бүтэн дэлгэцийн canvas (цэсний доогуур ч), ирмэг рүүгээ цэгүүд бүдгэрнэ */}
          {mode === "anim" && count > 0 && (
            <div data-canvas aria-hidden className="absolute inset-0">
              <div className={`h-full w-full transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
                <PointCapsule driveRef={driveRef} count={count} colors={COLORS} big={HABIT_BIG} active={active} onReady={onReady} />
              </div>
            </div>
          )}

          <div
            ref={area}
            data-area
            className="relative flex-1 group-data-[mode=static]:flex group-data-[mode=static]:flex-col group-data-[mode=static]:gap-10 motion-reduce:flex motion-reduce:flex-col motion-reduce:gap-10"
          >
            {/* 0: гарчиг капсулын урд, голд */}
            <div
              className={`pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 text-center group-data-[mode=static]:items-start group-data-[mode=static]:text-left motion-reduce:items-start motion-reduce:text-left ${flow}`}
            >
              <h1
                id="landing-title"
                aria-label={TITLE}
                className="text-[clamp(3rem,11vw,10rem)] leading-[0.95] font-bold tracking-tight text-ink [text-shadow:0_0_40px_var(--bg),0_0_12px_var(--bg)]"
              >
                <span aria-hidden>
                  {[...TITLE].map((ch, i) => (
                    <span key={i} data-char className="inline-block whitespace-pre">
                      {ch}
                    </span>
                  ))}
                </span>
              </h1>
              {/* Цэгүүдийн дээр уншигдахаар: үндсэн өнгө + фоны өнгөтэй хүрээ */}
              <p
                data-caption="0"
                className="max-w-md text-lead font-medium text-ink [text-shadow:0_0_2px_var(--bg),0_0_10px_var(--bg),0_0_24px_var(--bg)]"
              >
                Таны Facebook дээр харагддаг постуудыг хэн сонгодог вэ?
              </p>
            </div>

            {/* 1–2: бичвэрийн багана (зүүн; утсан дээр дээд хэсэгт). Нэг нүдэнд давхцана. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 grid md:inset-y-0 md:right-auto md:w-[46%] md:content-center [text-shadow:0_0_2px_var(--bg),0_0_10px_var(--bg),0_0_24px_var(--bg)] [&>*]:[grid-area:1/1] group-data-[mode=static]:hidden motion-reduce:hidden">
              <div data-caption="1" className="flex max-w-md flex-col gap-3 text-h3 leading-snug md:text-h2">
                <p className="font-semibold text-ink">Таны харж буй пост бүрийг алгоритм сонгодог.</p>
                <p className="text-ink-2">Сэтгэл хөдлөл их төрүүлсэн пост илүү хурдан тархдаг.</p>
              </div>
              <div data-caption="2" className="flex max-w-md flex-col gap-3 text-h3 leading-snug md:text-h2">
                <p className="text-h2 leading-tight font-bold text-ink md:text-h1">Нэг эм хангалтгүй.</p>
                <p className="text-ink-2">Манипуляцаас хамгаалахын тулд олон дадал хэрэгтэй.</p>
              </div>
            </div>

            <h2
              data-final
              className={`absolute top-0 left-0 z-10 text-h2 leading-tight font-bold text-ink md:top-[4%] ${flow}`}
            >
              Мэдээллийн дархлааны таван дадал.
            </h2>

            {/* 3: 5 дадал. Компьютер дээр бөөгнөрөл бүрийн доор, утсан дээр (ба static үед) жагсаалт.
                Холбоос биш (сайтын хэсгүүд рүү цэс хөтөлнө). Хулгана аваачихад бөөгнөрөл нь тодорно. */}
            <ul
              id="habits"
              className={`absolute inset-x-0 top-14 z-10 flex flex-col gap-1 md:top-auto md:bottom-[6%] md:grid md:grid-cols-5 md:gap-4 ${flow}`}
            >
              {HABITS.map((h, i) => (
                <li
                  key={h.id}
                  data-label={i}
                  onMouseEnter={() => (driveRef.current.hover = i)}
                  onMouseLeave={() => (driveRef.current.hover = -1)}
                >
                  <div data-pill={h.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 md:flex-col md:gap-1 md:text-center">
                    {/* Өнгөт тэмдэг: static үед харагдана; хөдөлгөөнтэй үед утсан дээр цэгэн капсулын байр (хоосон) */}
                    <span
                      aria-hidden
                      data-swatch
                      className="invisible h-12 w-9 shrink-0 rounded-full group-data-[mode=static]:visible group-data-[mode=static]:h-4 motion-reduce:visible motion-reduce:h-4 md:hidden md:group-data-[mode=static]:block md:motion-reduce:block"
                      style={{ background: h.color }}
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className={`font-semibold text-ink ${i === HABIT_BIG ? "text-lead md:text-h3" : "text-lead"}`}>
                        {h.name}
                      </span>
                      <span className="text-small leading-snug text-ink-2 md:mx-auto md:max-w-[15rem]">{h.line}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div
            data-scroll-hint
            className="relative z-10 flex items-center justify-between text-small font-semibold text-ink-3 group-data-[mode=static]:hidden motion-reduce:hidden"
          >
            <span>Гүйлгэх ↓</span>
            <a href="#habits" onClick={skip} className="btn-quiet inline-flex min-h-11 items-center">
              Алгасах →
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
