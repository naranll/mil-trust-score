import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";
import { layerColor } from "@/data/layers";
import { DotCapsule } from "@/components/ui/DotCapsule";

export const metadata: Metadata = { title: "Блог", description: "Алгоритм, залилан, мэдээллийн бичиг үсгийн тухай богино нийтлэлүүд." };

// Огноог монголоор
function mnDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return `${y} оны ${m} сарын ${day}`;
}

export default async function BlogIndex() {
  const posts = await getAllPosts();
  return (
    <div className="w-full px-5 pt-14 pb-10 md:px-10 md:pt-20 xl:px-16">
      <header className="grid gap-4 md:grid-cols-[1fr_minmax(0,28rem)] md:items-end">
        <h1 className="text-[clamp(2.4rem,6vw,4.25rem)] leading-[1.02] font-bold tracking-[-0.025em] text-ink">Блог</h1>
        <p className="text-lg leading-relaxed text-ink-2">
          Feed яагаад ийм харагддаг, залилан хэрхэн бүтдэг тухай богино нийтлэлүүд. Өнгө нь аль давхаргын тухай болохыг заана.
        </p>
      </header>

      <ul className="mt-12 border-t border-line md:mt-16">
        {posts.map((p) => (
          <li key={p.slug} className="border-b border-line">
            <Link
              href={`/blog/${p.slug}`}
              className="group grid grid-cols-[2.5rem_1fr] gap-x-5 gap-y-3 py-7 outline-offset-4 md:grid-cols-[4rem_1fr_14rem] md:gap-x-10 md:py-10"
            >
              <DotCapsule color={layerColor(p.layer)} className="row-span-2 h-[4.5rem] w-10 md:row-span-1 md:h-28 md:w-16" />
              <div className="min-w-0">
                <h2 className="text-[22px] leading-snug font-bold text-ink transition-colors duration-[var(--dur-base)] group-hover:text-accent md:text-[31.25px]">
                  {p.title}
                </h2>
                <p className="mt-2 max-w-[62ch] leading-relaxed text-ink-2">{p.excerpt}</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-ink-2 md:flex-col md:items-end md:gap-1.5 md:pt-2 md:text-right">
                <span className="inline-flex items-center gap-2 font-semibold text-ink">
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: layerColor(p.layer) }} />
                  {p.layer}
                </span>
                <time dateTime={p.date}>{mnDate(p.date)}</time>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
