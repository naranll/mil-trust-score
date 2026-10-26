import type { Metadata } from "next";
import { StarViz } from "@/components/data/StarViz";
import { getStats } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Өгөгдөл",
  description: "Мэдээллийн сайтын уншигчид, уншдаг мэдээллийн төрөл, хиймэл оюуны хэрэглээ.",
};

export default async function DataPage() {
  const { origin } = await getStats();

  return (
    <div className="w-full px-5 pt-14 md:px-10 md:pt-20 xl:px-16">
      <h1 className="text-[clamp(2.4rem,6vw,3.9rem)] leading-[1.05] font-bold tracking-[-0.02em] text-ink">Өгөгдөл</h1>
      <p className="mt-2 text-[12.8px] text-ink-3">{origin === "supabase" ? "Supabase-ээс шууд" : "Дотоод нөөцөөс"}</p>

      {/* Хэвлэлийн хүрээлэнгийн өгөгдөл: хаана, юу уншдаг вэ, хиймэл оюун */}
      <section aria-label="Хэвлэл мэдээллийн хэрэглээ" className="mt-10">
        <StarViz />
      </section>
    </div>
  );
}
