"use client";

// Хуудасны ард хөвөх бүдэг өнгөт хэсгүүд: капсулаас асгарсан "хүчин зүйлс".
// Шилэн гадаргуу тунгалаг харагдахын тулд ард нь ямар нэг юм байх хэрэгтэй.
import { useEffect, useRef } from "react";

const DOTS = [
  { c: "var(--chart-cat-5)", s: 340, x: 78, y: 8, k: 0.12 },
  { c: "var(--chart-cat-2)", s: 260, x: 8, y: 30, k: 0.2 },
  { c: "var(--chart-cat-3)", s: 300, x: 70, y: 55, k: 0.08 },
  { c: "var(--chart-cat-4)", s: 220, x: 18, y: 78, k: 0.16 },
  { c: "var(--chart-cat-1)", s: 280, x: 88, y: 92, k: 0.1 },
];

export function Ambient() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        ref.current?.querySelectorAll<HTMLElement>("[data-k]").forEach((el) => {
          el.style.transform = `translate3d(0, ${(-y * Number(el.dataset.k)).toFixed(1)}px, 0)`;
        });
      });
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      window.removeEventListener("scroll", on);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {DOTS.map((d, i) => (
        <span
          key={i}
          data-k={d.k}
          className="absolute rounded-full opacity-[0.22] blur-[70px] will-change-transform dark:opacity-[0.14]"
          style={{ background: d.c, width: d.s, height: d.s, left: `${d.x}%`, top: `${d.y}%`, marginLeft: -d.s / 2 }}
        />
      ))}
    </div>
  );
}
