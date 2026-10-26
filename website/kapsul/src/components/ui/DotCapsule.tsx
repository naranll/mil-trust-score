// Цэгэн жижиг капсул (нүүрний цэгэн капсулын жижиг хувилбар, SVG). Хулгана/фокус аваачихад
// (эцэг элемент нь `group`) цэгүүд бага зэрэг тарна. Чимэглэл тул aria-hidden.
const DOTS = (() => {
  // Детерминист байрлал: server ба client ижил (hydration зөрөхгүй)
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const out: { x: number; y: number; dx: number; dy: number; r: number }[] = [];
  while (out.length < 90) {
    const x = rnd() * 28 - 14, y = rnd() * 60 - 30;
    // Капсулын дүрс: дунд хэсэг |y|<16, хоёр үзүүр нь хагас тойрог (радиус 14)
    const inside = Math.abs(y) <= 16 ? Math.abs(x) <= 14 : x * x + (Math.abs(y) - 16) ** 2 <= 196;
    if (!inside) continue;
    out.push({ x, y, dx: x * 0.35 + (rnd() - 0.5) * 6, dy: y * 0.2 + (rnd() - 0.5) * 6, r: 0.9 + rnd() * 0.7 });
  }
  return out;
})();

export function DotCapsule({ color, className = "" }: { color: string; className?: string }) {
  return (
    <svg viewBox="-20 -36 40 72" aria-hidden className={className} overflow="visible">
      {DOTS.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.r}
          fill={color}
          opacity={0.45 + (i % 5) * 0.11}
          className="transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:[transform:translate(var(--dx),var(--dy))] group-focus-visible:[transform:translate(var(--dx),var(--dy))] motion-reduce:transition-none"
          style={{ "--dx": `${d.dx}px`, "--dy": `${d.dy}px` } as React.CSSProperties}
        />
      ))}
    </svg>
  );
}
