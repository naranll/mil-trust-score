import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getAllPosts, getPost } from "@/lib/blog";
import { ShareButton } from "@/components/map/ShareButton";

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

export default async function BlogPost({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl px-5 pt-14 md:pt-20">
      <Link href="/blog" className="btn-quiet inline-flex items-center text-[15px]">
        Бүх нийтлэл
      </Link>
      <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
        <span className="rounded-full bg-accent-tint px-3 py-0.5 text-[12.8px] font-semibold text-ink">{post.layer}</span>
        <time dateTime={post.date}>{mnDate(post.date)}</time>
      </div>
      <h1 className="mt-4 text-[clamp(2rem,5vw,3.4rem)] leading-[1.04] font-bold tracking-[-0.02em] text-ink">
        {post.title}
      </h1>
      <p className="mt-5 text-xl leading-relaxed text-ink-2">{post.excerpt}</p>
      <div className="prose-capsule mt-10 text-ink">
        <ReactMarkdown>{post.content}</ReactMarkdown>
      </div>
      <aside className="glass mt-14 p-6">
        <p className="mb-4 text-[20px] font-semibold text-ink">Хуваалцвал таны аймагт гэрэл асна</p>
        <ShareButton title={post.title} path={`/blog/${post.slug}`} />
      </aside>
    </article>
  );
}
