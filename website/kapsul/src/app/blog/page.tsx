import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = { title: "Блог", description: "Алгоритм, залилан, мэдээллийн бичиг үсгийн тухай богино нийтлэлүүд." };

// Огноог монголоор
function mnDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return `${y} оны ${m} сарын ${day}`;
}

export default async function BlogIndex() {
  const posts = await getAllPosts();
  return (
    <div className="mx-auto max-w-4xl px-5 pt-14 md:pt-20">
      <h1 className="font-display text-[clamp(2.4rem,6vw,4.2rem)] leading-[1] font-bold tracking-[-0.025em] text-ink">Блог</h1>
      <p className="mt-4 max-w-xl text-lg text-ink-2">Капсулын давхарга бүрийн тухай богино, ойлгомжтой нийтлэлүүд.</p>

      <ul className="mt-12 space-y-3">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/blog/${p.slug}`}
              className="group block glass rounded-2xl px-7 py-6 transition-transform duration-[var(--dur-base)] hover:-translate-y-0.5 md:px-10"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
                <span className="rounded-full bg-accent-tint px-3 py-0.5 text-xs font-semibold text-ink">{p.layer}</span>
                <time dateTime={p.date}>{mnDate(p.date)}</time>
              </div>
              <h2 className="font-display mt-2 text-xl font-bold text-ink group-hover:text-ink md:text-2xl">{p.title}</h2>
              <p className="mt-1.5 max-w-2xl leading-relaxed text-ink-2">{p.excerpt}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
