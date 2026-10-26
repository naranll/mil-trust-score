// Блогийн нийтлэлийн цэгэн дүрс: давхарга бүр өөрийн утгатай хэлбэртэй (нэг ижил капсул биш).
// Мэдэгдэл = нэг нягт бөөгнөрөл; Тархалт = нэг эх цэгээс цагираг болж тархана; Үйлдвэрлэл = ижил цэгүүд эгнээгээр
// (олноор хувилсан); Танин мэдэхүй = нүдний солонго шиг эргэлдэх цэгүүд. Цэгүүд зөөлөн анивчина, эцэг `group`
// дээр хулгана очиход дүрс бага зэрэг томорно. Чимэглэл тул aria-hidden. Байрлал детерминист (hydration зөрөхгүй).
import { LAYERS, type Layer } from "@/data/layers";

type Dot = { x: number; y: number; r: number; o: number; d: number };

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const SHAPES: Record<Layer["id"], Dot[]> = {
  claim: (() => {
    const r = rng(3), out: Dot[] = [];
    while (out.length < 70) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 30;
      out.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.8, r: 1.1 + (1 - d / 30) * 1.6, o: 0.45 + (1 - d / 30) * 0.55, d: r() * 3 });
    }
    return out;
  })(),
  distribution: (() => {
    const r = rng(5), out: Dot[] = [{ x: 0, y: 0, r: 4, o: 1, d: 0 }];
    [9, 17, 25, 33].forEach((rad, ring) => {
      const n = 6 + ring * 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.3 + (r() - 0.5) * 0.2;
        out.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad, r: 2.4 - ring * 0.4, o: 1 - ring * 0.18, d: ring * 0.45 });
      }
    });
    return out;
  })(),
  production: (() => {
    const out: Dot[] = [];
    for (let row = 0; row < 7; row++)
      for (let col = 0; col < 7; col++) out.push({ x: (col - 3) * 9.5, y: (row - 3) * 9.5, r: 2.2, o: 0.55 + ((row + col) % 3) * 0.2, d: (row + col) * 0.12 });
    return out;
  })(),
  cognition: (() => {
    const out: Dot[] = [];
    for (let i = 0; i < 84; i++) {
      const t = i / 84, a = t * Math.PI * 2 * 5.2, d = 6 + t * 28;
      out.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.72, r: 1.1 + t * 1.5, o: 0.4 + t * 0.6, d: t * 3 });
    }
    out.push({ x: 0, y: 0, r: 4.2, o: 1, d: 0 });
    return out;
  })(),
};

export function DotGlyph({ layer, className = "" }: { layer: string; className?: string }) {
  const l = LAYERS.find((x) => x.name === layer) ?? LAYERS[0];
  return (
    <svg
      viewBox="-40 -40 80 80"
      aria-hidden
      className={`overflow-visible transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-110 motion-reduce:transition-none ${className}`}
    >
      {SHAPES[l.id].map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.r}
          fill={l.particle}
          opacity={d.o}
          className="motion-safe:animate-[dotTwinkle_3.2s_ease-in-out_infinite]"
          style={{ animationDelay: `${-d.d}s` }}
        />
      ))}
    </svg>
  );
}
