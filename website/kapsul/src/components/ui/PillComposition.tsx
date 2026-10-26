// Хэрэглэгчийн reference 2: харанхуй капсулын дотор хазгай байрласан эм хэлбэрийн баганууд.
// Эм бүрийн урт = хувь. Том тоо нь эмийн үзүүрт байна.
type Item = { value: number; label: string; tone: "cat1" | "cat2" | "cat5" };

const toneClass = {
  cat1: "bg-cat-5 text-[#1b1d21]",
  cat2: "bg-cat-2 text-[#1b1d21]",
  cat5: "bg-surface text-ink",
};

export function PillComposition({ items, title, showLabels = false }: { items: Item[]; title: string; showLabels?: boolean }) {
  const n = items.length;
  const maxVal = Math.max(...items.map((i) => i.value));
  return (
    <figure className="w-full">
      <div
        role="img"
        aria-label={`${title}: ${items.map((i) => `${i.label} ${i.value}%`).join(", ")}`}
        className="relative w-full overflow-hidden rounded-full bg-inverse"
        style={{ aspectRatio: n > 3 ? "2.1 / 1" : "2.6 / 1" }}
      >
        {items.map((it, i) => {
          const top = 14 + (i * 68) / Math.max(n - 1, 1);
          return (
            <div
              key={it.label}
              aria-hidden
              className={`absolute flex items-center justify-between gap-2 rounded-full pr-[4%] pl-[3%] shadow-2 ${toneClass[it.tone]}`}
              style={{
                left: "5%",
                top: `${top - 9}%`,
                width: `${Math.max((it.value / maxVal) * 86, 24)}%`,
                height: `${Math.min(28, 80 / n + 4)}%`,
                transform: `rotate(${i % 2 === 0 ? 7 : -5}deg)`,
                transformOrigin: "left center",
                zIndex: n - i,
              }}
            >
              <span className="truncate text-[clamp(0.65rem,1.4vw,0.95rem)] font-semibold opacity-80">{showLabels ? it.label : ""}</span>
              <span className="font-display shrink-0 text-[clamp(1rem,3.6vw,2.6rem)] leading-none font-medium tnum">
                {it.value}
                <span className="text-[0.5em]">%</span>
              </span>
            </div>
          );
        })}
      </div>
      <figcaption className="sr-only">{title}</figcaption>
    </figure>
  );
}
