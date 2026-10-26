"use client";

// «Бид навч биш, үндсийг хардаг»: цэгэн мод. Газрын дээрх титэм бүдэг (навч = нэг пост),
// газрын доорх үндэс (систем) мод харагдах үед цэг цэгээр ургана. Хөдөлгөөн багасгасан үед бүтэн харагдана.
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { LAYERS } from "@/data/layers";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type Dot = { x: number; y: number; r: number; c: string; depth: number };

const GROUND = 210;
const { canopy, roots } = (() => {
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const canopy: Dot[] = [];
  // Титэм: бөөрөнхий, сийрэг
  while (canopy.length < 90) {
    const x = rnd() * 180 - 90, y = rnd() * 130 - 65;
    if ((x / 90) ** 2 + (y / 65) ** 2 > 1) continue;
    canopy.push({ x: 200 + x, y: 95 + y, r: 1.4 + rnd() * 1.4, c: "var(--text-tertiary)", depth: 0 });
  }
  // Их бие
  for (let y = 150; y < GROUND; y += 7) canopy.push({ x: 200 + (rnd() - 0.5) * 6, y, r: 2, c: "var(--text-tertiary)", depth: 0 });

  // Үндэс: 4 гол үндэс (4 давхаргын өнгө), салаалж доош ургана
  const roots: Dot[] = [];
  const grow = (x: number, y: number, angle: number, len: number, depth: number, c: string) => {
    const steps = Math.round(len / 8);
    for (let i = 0; i < steps; i++) {
      angle += (rnd() - 0.5) * 0.35;
      x += Math.cos(angle) * 8;
      y += Math.sin(angle) * 8;
      roots.push({ x: x + (rnd() - 0.5) * 3, y, r: Math.max(1.1, 3.2 - depth * 0.55), c, depth: depth + i / steps });
      if (depth < 3 && rnd() < 0.12) grow(x, y, angle + (rnd() < 0.5 ? -0.7 : 0.7), len * 0.6, depth + 1, c);
    }
  };
  LAYERS.forEach((l, i) => grow(200, GROUND + 4, Math.PI / 2 + (i - 1.5) * 0.55, 150, 0, l.particle));
  roots.sort((a, b) => a.depth - b.depth);
  return { canopy, roots };
})();

export function RootsTree({ className = "" }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Гол үндэсний эхлэл анхнаасаа харагдана; үлдсэн нь мод харагдах үед цэг цэгээр ургана
        gsap.fromTo(
          ref.current!.querySelectorAll("[data-root]"),
          { opacity: 0, scale: 0, transformOrigin: "50% 50%" },
          {
            opacity: 1,
            scale: 1,
            duration: 0.5,
            ease: "power2.out",
            stagger: { amount: 2.6 },
            delay: 0.3,
            scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
          },
        );
      });
    },
    { scope: ref },
  );

  return (
    <svg ref={ref} viewBox="0 0 400 470" aria-hidden className={className}>
      {canopy.map((d, i) => (
        <circle key={`c${i}`} cx={d.x} cy={d.y} r={d.r} fill={d.c} opacity={0.55} />
      ))}
      <line x1="10" x2="390" y1={GROUND} y2={GROUND} stroke="var(--border-control)" strokeWidth="1" strokeDasharray="2 5" />
      {roots.map((d, i) => (
        <circle key={`r${i}`} data-root={d.depth >= 0.35 ? "" : undefined} cx={d.x} cy={d.y} r={d.r} fill={d.c} />
      ))}
    </svg>
  );
}
