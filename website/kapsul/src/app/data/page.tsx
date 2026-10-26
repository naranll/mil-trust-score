import type { Metadata } from "next";
import { FraudCapsule, type FraudView } from "@/components/three/FraudCapsule";
import { NewsCapsules } from "@/components/three/NewsCapsules";
import { LightMap } from "@/components/map/LightMap";
import { SitesSplit } from "@/components/data/SitesSplit";
import { ReadingWaffle } from "@/components/data/ReadingWaffle";
import { Parallax } from "@/components/ui/Parallax";
import { SourceLink } from "@/components/ui/Pill";
import { getStats, pick } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Өгөгдөл",
  description: "Монгол дахь цахим залилан, Facebook-ийн хүрээ, дэлхийн мэдээний итгэлцлийн бодит тоо, эх сурвалжтай нь.",
};

export default async function DataPage() {
  const { stats, origin } = await getStats();
  const online = pick(stats, "fraud_online_2025");
  const share = pick(stats, "fraud_share_all");
  const loss = pick(stats, "fraud_loss_2025");
  const rec = pick(stats, "fraud_recovered_2025");
  const count = pick(stats, "fraud_2025");
  const fbUsers = pick(stats, "fb_users_mn");
  const fbShare = pick(stats, "fb_pop_share");
  const ages = ["fb_age_18_24", "fb_age_25_34", "fb_age_35_44", "fb_age_45_54", "fb_age_55_64", "fb_age_65"].map((k) =>
    pick(stats, k),
  );
  const maxAge = Math.max(...ages.map((a) => a.value));
  const dnr = ["dnr_concern", "dnr_social", "dnr_avoid", "dnr_trust", "dnr_ai"].map((k) => pick(stats, k));
  const ethics15 = pick(stats, "press_ethics_2015");
  const ethics17 = pick(stats, "press_ethics_2017");
  const youth = pick(stats, "press_critical_youth");
  const num = pick(stats, "num_students");

  const sites = stats.filter((s) => s.dataset === "mn_sites").map((s) => ({ name: s.label, ub: s.value }));
  const reading = stats.filter((s) => s.dataset === "mn_reading").map((s) => ({ label: s.label, value: s.value }));
  const book = stats.find((s) => s.dataset === "mn_sites")?.source;

  const recoveredPct = Math.round((rec.value / loss.value) * 1000) / 10;

  const views: FraudView[] = [
    {
      id: "online",
      tab: "Хаана үйлдэгддэг вэ",
      share: online.value,
      mainLabel: "Цахим орчинд",
      restLabel: "Бусад орчинд",
      sentence: `2025 онд бүртгэгдсэн ${count.value.toLocaleString("mn-MN")} залилангийн ${online.value}% нь цахим орчинд үйлдэгджээ.`,
      stat: online,
    },
    {
      id: "share",
      tab: "Нийт гэмт хэрэгт",
      share: share.value,
      mainLabel: "Залилан",
      restLabel: "Бусад гэмт хэрэг",
      sentence: `Залилан нь 2025 онд бүртгэгдсэн бүх гэмт хэргийн ${share.value}%-ийг эзэлсэн.`,
      stat: share,
    },
    {
      id: "loss",
      tab: "Хохирол",
      share: recoveredPct,
      mainLabel: `Нөхөн төлүүлсэн: ${rec.value} тэрбум ₮`,
      restLabel: `Буцаагдаагүй: ${Math.round((loss.value - rec.value) * 10) / 10} тэрбум ₮`,
      sentence: `Залилангаас ${loss.value} тэрбум ₮-ийн хохирол учирснаас ердөө ${recoveredPct}%-ийг нь нөхөн төлүүлжээ.`,
      stat: loss,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 pt-14 md:pt-20">
      <header className="max-w-3xl">
        <h1 className="text-[clamp(2.4rem,6vw,4.25rem)] leading-[1.02] font-bold tracking-[-0.025em] text-ink">
          Тоонуудыг эргүүлж, дарж үз
        </h1>
        <p className="mt-3 text-[15px] text-ink-3">
          {origin === "supabase" ? "Өгөгдлийг Supabase-ээс шууд уншиж байна." : "Өгөгдлийг дотоод нөөцөөс уншиж байна."}
        </p>
      </header>

      {/* Гэрлийн газрын зураг: хүн бүрийн хувь нэмэр */}
      <section id="map" aria-labelledby="map-title" className="mt-14 scroll-mt-24">
        <h2 id="map-title" className="mb-2 text-[25px] font-bold text-ink md:text-[31.25px]">
          Мэдлэг хэрхэн тархаж байна
        </h2>
        <p className="mb-6 max-w-2xl text-lg text-ink-2">Тоглоом дуусгасан, мэдээ хуваалцсан хүн бүр нэг гэрэл болно.</p>
        <LightMap />
      </section>

      {/* Хэвлэлийн хүрээлэнгийн өгөгдөл: хаана, юу уншдаг вэ */}
      <section aria-labelledby="sites-title" className="mt-28">
        <h2 id="sites-title" className="sr-only">
          Хамгийн их зочилдог 10 мэдээллийн сайтын уншигчдын байршил
        </h2>
        <SitesSplit sites={sites} />
        {book && <SourceLink source={book} className="mt-4 text-ink-3" />}
      </section>

      <section aria-labelledby="reading-title" className="mt-28">
        <h2 id="reading-title" className="sr-only">
          Мэдээллийн сайтаас юу уншдаг вэ
        </h2>
        <ReadingWaffle cats={reading} />
        {book && <SourceLink source={book} className="mt-4 text-ink-3" />}
      </section>

      {/* 3D 1: залилан */}
      <section aria-labelledby="fraud-title" className="mt-28">
        <h2 id="fraud-title" className="mb-8 text-[25px] font-bold text-ink md:text-[31.25px]">
          Залилан хаана, хэр их болж байна
        </h2>
        <FraudCapsule views={views} />
      </section>

      {/* 2D: Facebook нас (хэрэглэгчийн reference 2) */}
      <section aria-labelledby="fb-title" className="mt-32 grid gap-12 md:grid-cols-[1fr_1.35fr] md:items-center">
        <div>
          <h2 id="fb-title" className="text-[25px] font-bold text-ink md:text-[31.25px]">
            Монголчуудын {fbShare.value}% нь нэг л feed-тэй
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-2">
            {fbUsers.value.toLocaleString("mn-MN")} хүн. Нэг алгоритм бараг бүх насныхны мэдээг сонгож байна.
          </p>
          <p className="mt-4">
            <SourceLink source={fbUsers.source} period={fbUsers.period} className="text-ink-2" />
          </p>
        </div>
        <Parallax speed={0.04} rotate={0.4}>
          <figure
            className="glass rounded-2xl p-6 md:p-9"
            role="img"
            aria-label={`Монгол дахь Facebook хэрэглэгчид насны бүлгээр: ${ages.map((a) => `${a.label} нас ${a.value}%`).join(", ")}`}
          >
            <ul className="space-y-2.5" aria-hidden>
              {ages.map((a, i) => (
                <li key={a.key} className="grid grid-cols-[4.5rem_1fr] items-center gap-3">
                  <span className="text-sm font-semibold text-ink-2 tnum">{a.label}</span>
                  <span
                    className={`flex h-11 items-center justify-end rounded-full pr-4 md:h-12 ${
                      i === 1 ? "bg-cat-1 text-white" : "bg-cat-5/35 text-ink"
                    }`}
                    style={{ width: `${Math.max((a.value / maxAge) * 100, 22)}%`, minWidth: "5.5rem" }}
                  >
                    <span className="font-display text-lg font-semibold tnum md:text-xl">{a.value}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </figure>
        </Parallax>
      </section>

      {/* 3D 2: дэлхийн мэдээ */}
      <section aria-labelledby="news-title" className="mt-32">
        <h2 id="news-title" className="max-w-2xl text-[25px] font-bold text-ink md:text-[31.25px]">
          Дэлхий нийтэд мэдээ хэрхэн хүрч байна
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-ink-2">
          Сошиалаас уншдаг нь олширч, итгэл нь 2015 оноос хойших хамгийн доод түвшинд.{" "}
          <SourceLink source={dnr[0].source} period={dnr[0].period} className="text-ink-3" />
        </p>
        <div className="mt-10">
          <NewsCapsules rows={dnr.map((d) => ({ label: d.label, value: d.value }))} />
        </div>
      </section>

      {/* Монголын MIL судалгаа */}
      <section aria-labelledby="mil-title" className="glass mt-32 rounded-2xl px-7 py-12 text-ink md:px-14">
        <h2 id="mil-title" className="max-w-2xl text-[25px] font-bold md:text-[31.25px]">
          Монголын судалгаа юу хэлж байна
        </h2>
        <div className="mt-10 grid gap-10 md:grid-cols-3">
          <div>
            <div className="space-y-2" aria-hidden>
              <div className="h-5 rounded-full bg-accent-tint" style={{ width: `${ethics15.value}%` }} />
              <div className="h-5 rounded-full bg-accent" style={{ width: `${ethics17.value}%` }} />
            </div>
            <p className="mt-4 leading-relaxed">
              Хэвлэл мэдээлэл ёс зүйтэй гэж үзэх иргэд {ethics15.value}%-иас ({ethics15.period}) {ethics17.value}% (
              {ethics17.period}) болж буурсан.
            </p>
            <SourceLink source={ethics15.source} className="mt-2 text-ink-3" />
          </div>
          <div>
            <div className="h-5 rounded-full bg-subtle" aria-hidden>
              <div className="h-full rounded-full bg-accent" style={{ width: `${youth.value}%` }} />
            </div>
            <p className="mt-4 leading-relaxed">
              {youth.period} онд ахлах ангийн сурагчдын ойролцоогоор {youth.value}% нь л мэдээнд шүүмжлэлтэй хандсан.
            </p>
            <SourceLink source={youth.source} className="mt-2 text-ink-3" />
          </div>
          <div>
            <p className="text-[39px] font-bold text-accent tnum">{num.value}</p>
            <p className="mt-2 leading-relaxed">
              22 их, дээд сургуулийн {num.value} оюутанд хийсэн судалгаагаар мэдээллийн бичиг үсгийн түвшин сул гарсан.
            </p>
            <SourceLink source={num.source} className="mt-2 text-ink-3" />
          </div>
        </div>
      </section>
    </div>
  );
}
