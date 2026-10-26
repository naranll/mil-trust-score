"use client";

// Жижиг parallax: элемент гүйлгэлтээс арай удаан/хурдан хөдөлнө.
// speed = 0.1 бол хуудас 100px гүйлгэхэд элемент 10px хөдөлнө. reduced-motion үед хөдлөхгүй.
import { useEffect, useRef } from "react";

export function Parallax({
  speed = 0.1,
  rotate = 0,
  className = "",
  children,
}: {
  speed?: number;
  rotate?: number; // 100px тутамд эргэх градус
  className?: string;
  children: React.ReactNode;
}) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const update = () => {
      const node = el.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      // Элементийн төв дэлгэцийн төвөөс хэр хол байгаагаар тооцно
      const d = r.top + r.height / 2 - window.innerHeight / 2;
      node.style.transform = `translate3d(0, ${(-d * speed).toFixed(1)}px, 0) rotate(${Math.max(-1.5, Math.min(1.5, (-d / 100) * rotate)).toFixed(2)}deg)`;
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [speed, rotate]);

  return (
    <div ref={el} className={`will-change-transform ${className}`}>
      {children}
    </div>
  );
}
