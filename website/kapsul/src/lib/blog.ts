// content/blog/*.md файлуудыг уншина. Шинэ нийтлэл нэмэхэд зөвхөн .md файл нэмэхэд хангалттай.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export type PostMeta = { slug: string; title: string; date: string; excerpt: string; layer: string };

const DIR = path.join(process.cwd(), "content", "blog");

export async function getAllPosts(): Promise<PostMeta[]> {
  "use cache";
  const files = (await readdir(DIR)).filter((f) => f.endsWith(".md"));
  const posts = await Promise.all(
    files.map(async (f) => {
      const { data } = matter(await readFile(path.join(DIR, f), "utf8"));
      return {
        slug: f.replace(/\.md$/, ""),
        title: String(data.title),
        date: String(data.date),
        excerpt: String(data.excerpt ?? ""),
        layer: String(data.layer ?? ""),
      };
    }),
  );
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPost(slug: string) {
  "use cache";
  try {
    const raw = await readFile(path.join(DIR, `${slug}.md`), "utf8");
    const { data, content } = matter(raw);
    return { slug, title: String(data.title), date: String(data.date), excerpt: String(data.excerpt ?? ""), layer: String(data.layer ?? ""), content };
  } catch {
    return null;
  }
}
