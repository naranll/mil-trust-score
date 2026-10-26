"use client";

// Нийтлэлийн уншилтын явц: header-ийн доор нимгэн зураас. Чимэглэл тул aria-hidden.
import { useEffect, useRef } from "react";

export function ReadingProgress({ color }: { color: string }) {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 1})`;
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-16 z-40 h-[3px]">
      <div ref={bar} className="h-full origin-left" style={{ background: color, transform: "scaleX(0)" }} />
    </div>
  );
}
