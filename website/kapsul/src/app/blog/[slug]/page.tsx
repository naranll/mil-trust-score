import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getAllPosts, getPost } from "@/lib/blog";
import { layerColor } from "@/data/layers";
import { ShareButton } from "@/components/map/ShareButton";
import { DotGlyph } from "@/components/blog/DotGlyph";
import { ReadingProgress } from "@/components/ui/ReadingProgress";
import { PAGE } from "@/components/ui/PageTitle";

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  return post ? { title: post.title, description: post.excerpt } : {};
}

function mnDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return `${y} оны ${m} сарын ${day}`;
}

// URL-ийн slug-ийг <Suspense> дотор уншина: Next (cacheComponents) хуудас солих үед бүрхүүлийг шууд харуулж,
// нийтлэлийг дараа нь урсгана. Мэдэгдэж буй бүх нийтлэл generateStaticParams-аар урьдчилан бэлтгэгдсэн хэвээр.
export default function BlogPost({ params }: PageProps<"/blog/[slug]">) {
  return (
    <Suspense fallback={<div className={`${PAGE} min-h-[70svh]`} aria-busy />}>
      <Article params={params} />
    </Suspense>
  );
}

async function Article({ params }: { params: PageProps<"/blog/[slug]">["params"] }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  const color = layerColor(post.layer);

  return (
    <article className={PAGE}>
      <ReadingProgress color={color} />

      <div className="grid gap-x-16 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)]">
        {/* Зүүн: нийтлэлийн мэдээлэл (том дэлгэцэнд наалттай) */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <Link href="/blog" className="btn-quiet inline-flex items-center text-small">
            Бүх нийтлэл
          </Link>
          <div className="mt-6 flex items-center gap-4 lg:mt-10 lg:flex-col lg:items-start">
            <DotGlyph layer={post.layer} className="size-12 lg:size-20" />
            <div className="text-small text-ink-2">
              <p className="font-semibold text-ink">{post.layer}</p>
              <time dateTime={post.date}>{mnDate(post.date)}</time>
            </div>
          </div>
        </aside>

        <div className="mt-8 min-w-0 lg:mt-0">
          <h1 className="max-w-[22ch] text-h1 leading-[1.06] font-bold tracking-[-0.02em] text-ink">{post.title}</h1>
          <p className="mt-5 max-w-[60ch] text-lead leading-relaxed text-ink-2">{post.excerpt}</p>
          <div className="prose-capsule mt-10 border-t border-line pt-10 text-ink">
            <ReactMarkdown>{post.content}</ReactMarkdown>
          </div>
          <aside className="mt-14 flex max-w-[68ch] flex-col items-start gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-h3 font-semibold text-ink">Хуваалцвал таны аймагт гэрэл асна</p>
            <ShareButton title={post.title} path={`/blog/${post.slug}`} />
          </aside>
        </div>
      </div>
    </article>
  );
}
