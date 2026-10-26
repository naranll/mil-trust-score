"use client";

// Нүүрний гол хэсэг: шилэн капсулыг дарж нээгээд, давхарга бүрийг сонгож тоглоно.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { LAYERS } from "@/data/layers";
import { ClaimDemo, CognitionDemo, ProductionDemo, SpreadDemo } from "./LayerDemos";

const GlassCapsule = dynamic(() => import("@/components/three/GlassCapsule"), { ssr: false });

export function HeroExplorer({ loss, lossUrl }: { loss: number; lossUrl: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const openIt = () => {
    setOpen(true);
    // Нээгдэж дуусахад эхний давхарга өөрөө сонгогдоно
    setTimeout(() => setSelected((s) => (s === null ? 0 : s)), still ? 0 : 650);
  };
  const close = () => {
    setOpen(false);
    setSelected(null);
  };

  const active = selected !== null ? LAYERS[selected] : null;

  return (
    <section aria-labelledby="hero-title" className="relative mx-auto max-w-6xl px-5">
      <div className="grid min-h-[calc(100svh-5rem)] items-center gap-6 py-8 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.1fr)] md:gap-10">
        {/* Зүүн тал: хаалттай үед танилцуулга, нээгдэхэд сонгосон давхаргын тоглоом */}
        <div className="order-2 md:order-1">
          {!active ? (
            <div>
              <h1 id="hero-title" className="text-[clamp(2.6rem,6vw,4.75rem)] leading-[1.02] font-bold tracking-[-0.025em] text-ink">
                Cure from the Core
              </h1>
              <p className="mt-5 max-w-md text-xl leading-relaxed text-ink-2">Худал пост бол зөвхөн бүрхүүл. Дотор нь юу байгааг хараарай.</p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <button type="button" onClick={openIt} className="btn btn-primary text-base">
                  Капсулыг нээх
                </button>
                <Link href="/game" className="btn-quiet inline-flex items-center">
                  Шууд тоглох
                </Link>
              </div>
            </div>
          ) : (
            <div className="glass p-5 md:p-7" key={active.id}>
              <div className="flex items-center justify-between gap-3">
                <h2 id="hero-title" className="flex items-center gap-3 text-[25px] leading-tight font-bold text-ink">
                  <span aria-hidden className="size-4 rounded-full" style={{ background: active.particle }} />
                  {active.name}
                </h2>
                <button type="button" onClick={close} aria-label="Капсулыг хаах" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-subtle hover:text-ink">
                  <X aria-hidden className="size-5" />
                </button>
              </div>
              <p className="mt-1 text-lg text-ink-2">{active.question}</p>
              <div className="mt-5">
                {active.id === "claim" && <ClaimDemo />}
                {active.id === "distribution" && <SpreadDemo />}
                {active.id === "production" && <ProductionDemo loss={loss} sourceUrl={lossUrl} />}
                {active.id === "cognition" && <CognitionDemo />}
              </div>
            </div>
          )}
        </div>

        {/* Баруун тал: шилэн капсул */}
        <div className="relative order-1 md:order-2">
          <div className="h-[46svh] min-h-[18rem] md:h-[64svh]">
            <GlassCapsule
              open={open}
              selected={selected}
              onOpen={openIt}
              onSelect={setSelected}
              onHover={setHover}
              still={still}
              label="Тунгалаг шилэн капсул. Дотор нь мэдэгдэл, тархалт, үйлдвэрлэл, танин мэдэхүй гэсэн 4 давхарга үүрлэсэн."
            />
          </div>

          {/* Гараар зурсан тэмдэглэл: зөвхөн хаалттай үед */}
          {!open && (
            <button
              type="button"
              onClick={openIt}
              className="absolute right-2 bottom-2 flex items-end gap-1 text-left text-[15px] font-semibold text-ink-2 md:right-6 md:bottom-10"
            >
              <svg aria-hidden viewBox="0 0 60 50" className="h-10 w-12 -scale-x-100 text-ink-3">
                <path d="M4 44c10-2 22-8 30-18S46 8 52 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M44 4h9v9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="mb-[-4px] -rotate-3">дараад нээ</span>
            </button>
          )}

          {/* Давхарга сонгох товчлуурууд (капсул нээгдсэн үед) */}
          <div
            role="tablist"
            aria-label="Капсулын давхарга"
            className={`seg grid w-full grid-cols-4 transition-opacity duration-[var(--dur-slow)] ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            {LAYERS.map((l, i) => (
              <button
                key={l.id}
                role="tab"
                aria-selected={selected === i}
                tabIndex={open ? 0 : -1}
                onClick={() => setSelected(i)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className={`!px-1 text-center !text-[13px] leading-tight md:!text-[15px] ${hover === i && selected !== i ? "text-ink" : ""}`}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
