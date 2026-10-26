import type { Metadata } from "next";
import { StarViz } from "@/components/data/StarViz";
import { getStats } from "@/lib/stats";
import { PAGE, PageTitle } from "@/components/ui/PageTitle";

export const metadata: Metadata = {
  title: "Өгөгдөл",
  description: "Мэдээллийн сайтын уншигчид, уншдаг мэдээллийн төрөл, хиймэл оюуны хэрэглээ.",
};

export default async function DataPage() {
  const { origin } = await getStats();

  return (
    <div className={PAGE}>
      <PageTitle title="Өгөгдөл" lead="Мэдээллийн сайтын уншигчид, уншдаг мэдээллийн төрөл, хиймэл оюуны хэрэглээ.">
        <p className="mt-3 text-caption text-ink-3">{origin === "supabase" ? "Supabase-ээс шууд" : "Дотоод нөөцөөс"}</p>
      </PageTitle>

      {/* Хэвлэлийн хүрээлэнгийн өгөгдөл: хаана, юу уншдаг вэ, хиймэл оюун */}
      <section aria-label="Хэвлэл мэдээллийн хэрэглээ" className="mt-6 md:mt-8">
        <StarViz />
      </section>
    </div>
  );
}
