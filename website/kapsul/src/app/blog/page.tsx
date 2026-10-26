import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog";
import { BlogList } from "@/components/blog/BlogList";
import { PAGE, PageTitle } from "@/components/ui/PageTitle";

export const metadata: Metadata = { title: "Блог", description: "Алгоритм, залилан, мэдээллийн бичиг үсгийн тухай богино нийтлэлүүд." };

export default async function BlogIndex() {
  const posts = await getAllPosts();
  return (
    <div className={PAGE}>
      <PageTitle title="Блог" />
      <BlogList posts={posts} />
    </div>
  );
}
