import type { Metadata } from "next";
import { FeedStars } from "@/components/data/FeedStars";
import { StarViz } from "@/components/data/StarViz";
import { getStats, pick } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Өгөгдөл",
  description: "Facebook-ийн хэрэглээ, мэдээллийн сайтын уншигчид, уншдаг мэдээллийн төрөл, хиймэл оюуны хэрэглээ.",
};

export default async function DataPage() {
  const { stats, origin } = await getStats();

  // Нэг хэмжүүр (хувь) тул гурвуулаа нэг өнгөтэй, шууд шошготой
  const facts = [
    { s: pick(stats, "fb_pop_share"), text: "Монгол хүн амын Facebook хэрэглэдэг хэсэг" },
    { s: pick(stats, "fraud_online_2025"), text: "Цахим орчинд үйлдэгдсэн залилан, 2025" },
    { s: pick(stats, "dnr_concern"), text: "Онлайн мэдээний үнэн, худлыг ялгахад санаа зовдог хүмүүс, дэлхий" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 pt-14 md:pt-20">
      <h1 className="text-[clamp(2.4rem,6vw,3.9rem)] leading-[1.05] font-bold tracking-[-0.02em] text-ink">Өгөгдөл</h1>
      <p className="mt-2 text-[12.8px] text-ink-3">{origin === "supabase" ? "Supabase-ээс шууд" : "Дотоод нөөцөөс"}</p>

      {/* Facebook-ийн хэрэглээ, дараа нь Хэвлэлийн хүрээлэнгийн өгөгдөл: хаана, юу уншдаг вэ, хиймэл оюун */}
      <section aria-label="Хэвлэл мэдээллийн хэрэглээ" className="mt-10">
        <StarViz>
          <FeedStars facts={facts} />
        </StarViz>
      </section>
    </div>
  );
}
