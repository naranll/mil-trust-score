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
      <h1 className="text-[clamp(2.4rem,6vw,4.25rem)] leading-[1.02] font-bold tracking-[-0.025em] text-ink">Блог</h1>

      <ul className="mt-10 space-y-3">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/blog/${p.slug}`}
              className="group glass block px-7 py-6 transition-shadow duration-[var(--dur-base)] hover:shadow-2 md:px-10"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
                <span className="rounded-full bg-accent-tint px-3 py-0.5 text-[12.8px] font-semibold text-ink">{p.layer}</span>
                <time dateTime={p.date}>{mnDate(p.date)}</time>
              </div>
              <h2 className="mt-2 text-[20px] font-bold text-ink group-hover:text-accent md:text-[25px]">{p.title}</h2>
              <p className="mt-1.5 max-w-2xl leading-relaxed text-ink-2">{p.excerpt}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
