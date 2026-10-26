import Link from "next/link";
import { HeroCapsule } from "@/components/three/HeroCapsule";
import { PillComposition } from "@/components/ui/PillComposition";
import { PillLink, SourceLink } from "@/components/ui/Pill";
import { Parallax } from "@/components/ui/Parallax";
import { LAYERS } from "@/data/layers";
import { getStats, pick } from "@/lib/stats";
import type { Stat } from "@/data/stats";

// Шинж тэмдэг ба үндэс
const CONTRAST = [
  ["Энэ нийтлэл найдвартай юу?", "Яагаад энэ чамд хүрсэн бэ, хэнд ашигтай вэ?"],
  ["Нэг оноо", "Дохионы задаргаа. Дүгнэлтийг чи гаргана."],
  ["Нэг мэдэгдлийг шалгана", "Мэдэгдлийг тархалт, үйлдвэрлэл хүртэл мөшгинө"],
  ["Ашиглаад мартдаг хэрэгсэл", "Үлддэг дадал, өмнө ба дараа нь хэмжигдэнэ"],
];

// Капсулын хөндлөн зүсэлтийн хэсэг бүрийн өнгө (гаднаас гүн рүү)
// Okabe Ito графикийн өнгө, давхаргын 3D хэсгүүдтэй ижил
const SEG = ["bg-cat-5 text-[#1b1d21]", "bg-cat-1 text-white", "bg-cat-2 text-[#1b1d21]", "bg-cat-3 text-[#1b1d21]"];

export default async function Home() {
  const { stats } = await getStats();
  const fb = pick(stats, "fb_pop_share");
  const online = pick(stats, "fraud_online_2025");
  const concern = pick(stats, "dnr_concern");
  const loss = pick(stats, "fraud_loss_2025");

  return (
    <>
      <HeroCapsule />

      {/* 4 давхарга: нэг эмийн хөндлөн зүсэлт */}
      <section aria-labelledby="layers-title" className="relative z-10 mx-auto mt-16 max-w-6xl px-5 md:mt-8">
        <div className="max-w-2xl">
          <h2
            id="layers-title"
            className="font-display text-[clamp(1.9rem,4.4vw,3.2rem)] leading-[1.05] font-bold tracking-[-0.02em] text-ink"
          >
            Нэг эм биш. Дөрвөн давхарга.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-2">
            Ихэнх хэрэгсэл гаднах бүрхүүл буюу нэг мэдэгдэлд л зогсдог. Капсулыг огтолж үзвэл үндэс нь илүү гүнд
            байдаг.
          </p>
        </div>

        <Parallax speed={0.05} className="mt-12">
          <ol aria-label="Гаднаас гүн рүү" className="flex flex-col overflow-hidden rounded-2xl md:flex-row md:rounded-full">
            {LAYERS.map((l, i) => (
              <li
                key={l.id}
                className={`font-display flex-1 px-7 py-5 text-lg font-semibold md:py-7 md:text-xl ${SEG[i]} ${
                  i === 0 ? "md:pl-10" : ""
                }`}
              >
                {l.name}
              </li>
            ))}
          </ol>
        </Parallax>
        <p className="mt-3 px-2 text-sm text-ink-2">Зүүнээс баруун тийш: гадна бүрхүүлээс үндэс рүү.</p>

        <div className="mt-10 grid gap-10 sm:grid-cols-2 md:grid-cols-4 md:gap-8">
          {LAYERS.map((l) => (
            <div key={l.id}>
              <h3 className="text-lg font-semibold text-ink">{l.question}</h3>
              <p className="mt-2 leading-relaxed text-ink-2">{l.ours}</p>
              <Link href={l.href} className="mt-3 inline-block font-semibold text-ink link-accent">
                {l.asset}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Шинж тэмдэг ба үндэс */}
      <section aria-labelledby="contrast-title" className="mx-auto mt-32 max-w-6xl px-5">
        <h2
          id="contrast-title"
          className="font-display max-w-2xl text-[clamp(1.9rem,4.4vw,3.2rem)] leading-[1.05] font-bold tracking-[-0.02em] text-ink"
        >
          Навчийг биш, үндсийг эмчил.
        </h2>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-2">
          Өвчтөн нь чи биш, мэдээллийн орчин. Чи бол эмч. Бид чамд багаж өгнө, онош тавьж өгөхгүй.
        </p>

        <div className="mt-10 rounded-2xl bg-accent-tint p-3 md:p-4">
          <div className="hidden grid-cols-2 gap-4 px-5 pt-1 pb-3 text-sm font-semibold text-ink-2 md:grid">
            <span>Шинж тэмдгийг эмчлэх нь</span>
            <span>Үндсийг эмчлэх нь</span>
          </div>
          <ul className="space-y-2">
            {CONTRAST.map(([a, b]) => (
              <li key={a} className="grid gap-1 rounded-2xl bg-surface px-5 py-4 md:grid-cols-2 md:gap-4">
                <span className="text-ink-2">{a}</span>
                <span className="font-semibold text-ink">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Яагаад одоо: бодит тоо */}
      <section aria-labelledby="why-title" className="mx-auto mt-32 max-w-6xl px-5">
        <div className="grid items-center gap-12 md:grid-cols-[1.2fr_1fr]">
          <Parallax speed={0.04} rotate={0.6}>
            <PillComposition
              title="Монгол дахь мэдээллийн орчин"
              items={[
                { value: fb.value, label: fb.label, tone: "cat1" },
                { value: online.value, label: online.label, tone: "cat2" },
                { value: concern.value, label: concern.label, tone: "cat5" },
              ]}
            />
          </Parallax>
          <div>
            <h2
              id="why-title"
              className="font-display text-[clamp(1.7rem,3.4vw,2.6rem)] leading-[1.08] font-bold tracking-[-0.02em] text-ink"
            >
              Шинж тэмдэг хурдан тарж байна
            </h2>
            <dl className="mt-7 space-y-5">
              <Fact swatch="bg-cat-5" value={`${fb.value}%`} text="Монголын хүн амын Facebook хэрэглэдэг хувь" s={fb} />
              <Fact swatch="bg-cat-2" value={`${online.value}%`} text="2025 онд цахим орчинд үйлдэгдсэн залилан" s={online} />
              <Fact swatch="bg-surface ring-1 ring-line" value={`${concern.value}%`} text="Онлайн мэдээний үнэн, худлыг ялгахад санаа зовдог хүмүүс (дэлхий)" s={concern} />
            </dl>
            <p className="mt-7 leading-relaxed text-ink-2">
              2025 онд залилангаас иргэдэд <strong className="text-ink tnum">{loss.value} тэрбум ₮</strong>-ийн хохирол
              учирсан. <SourceLink source={loss.source} period={loss.period} />
            </p>
            <Link href="/data" className="mt-6 inline-block font-semibold text-ink link-accent">
              Бүх өгөгдлийг үзэх
            </Link>
          </div>
        </div>
      </section>

      {/* Төгсгөл */}
      <section className="mx-auto mt-32 max-w-6xl px-5">
        <div className="flex flex-col items-start gap-7 rounded-2xl bg-inverse px-8 py-12 md:flex-row md:items-center md:justify-between md:px-16">
          <p className="font-display max-w-xl text-[clamp(1.4rem,3vw,2.2rem)] leading-[1.15] font-semibold tracking-[-0.02em] text-on-inverse">
            Таны feed яагаад ийм харагддагийг 2 минутад олж мэд.
          </p>
          <PillLink href="/game" size="lg">
            Тоглоом тоглох
          </PillLink>
        </div>
      </section>
    </>
  );
}

function Fact({ swatch, value, text, s }: { swatch: string; value: string; text: string; s: Stat }) {
  return (
    <div className="flex gap-4">
      <span aria-hidden className={`mt-2 h-3.5 w-7 shrink-0 rounded-full ${swatch}`} />
      <div>
        <dt className="font-display text-2xl font-semibold tnum text-ink">{value}</dt>
        <dd className="leading-relaxed text-ink-2">
          {text}. <SourceLink source={s.source} period={s.period} />
        </dd>
      </div>
    </div>
  );
}
