"use client";

// Нүүрний эхний дэлгэц. Ачаалахад капсул бага зэрэг онгойно (ганц хөдөлгөөн),
// гүйлгэхэд бүрэн нээгдэж, дотроос 4 давхаргын хэсгүүд асгарна. Капсул бичвэрээс удаан хөдөлнө (parallax).
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PillLink } from "@/components/ui/Pill";
import { LAYERS } from "@/data/layers";

const CapsuleScene = dynamic(() => import("./CapsuleScene"), { ssr: false });

const GROUPS = LAYERS.map((l) => ({ color: l.particle, count: 140 }));

export function HeroCapsule() {
  const openRef = useRef(0);
  const stage = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.matchMedia("(max-width: 767px)").matches);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      openRef.current = 0.8;
      return;
    }

    let base = 0; // ачаалах үеийн нээлт
    let scroll = 0; // гүйлгэлтийн нээлт
    const t0 = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min((now - t0 - 350) / 1300, 1);
      base = t <= 0 ? 0 : 0.22 * (1 - Math.pow(1 - t, 3));
      openRef.current = base + scroll * (1 - base);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onScroll = () => {
      const y = window.scrollY;
      scroll = Math.min(y / (window.innerHeight * 0.75), 1);
      openRef.current = base + scroll * (1 - base);
      // Parallax: капсул хуудаснаас удаан дээшилнэ
      if (stage.current) {
        stage.current.style.transform = `translate3d(0, ${(y * 0.22).toFixed(1)}px, 0)`;
        stage.current.style.opacity = String(Math.max(1 - y / (window.innerHeight * 0.95), 0));
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <section aria-labelledby="hero-title" className="relative">
      <div className="mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-6xl items-center gap-4 px-5 md:grid-cols-[1fr_1.05fr]">
        <div className="relative z-10 pt-14 md:pt-0">
          <h1
            id="hero-title"
            className="font-display text-[clamp(2.75rem,6.5vw,5.25rem)] leading-[1.02] font-bold tracking-[-0.025em] text-ink"
          >
            Cure the Core
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink md:text-xl">
            Худал мэдэгдэл бол шинж тэмдэг. Бид түүнийг үйлдвэрлэж, чам руу хүргэдэг системийг нээж харуулна.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <PillLink href="/game" size="lg">
              Тоглоом тоглох
            </PillLink>
            <Link href="/extension" className="font-semibold text-ink link-accent">
              Extension үзэх
            </Link>
          </div>
        </div>

        <div ref={stage} className="pointer-events-none relative -mx-5 -mt-4 h-[50svh] will-change-transform md:mx-0 md:mt-0 md:-mr-[6vw] md:h-[78svh]">
          <CapsuleScene
            openRef={openRef}
            groups={GROUPS}
            scale={isMobile ? 0.72 : 0.8}
            offsetY={isMobile ? 0.55 : 0.25}
            label="Хоёр хагас болж нээгдэж буй капсул. Дотроос нь мэдээллийн системийн 4 давхаргыг илэрхийлэх өнгөт хэсгүүд асгарна."
          />
        </div>
      </div>
    </section>
  );
}
