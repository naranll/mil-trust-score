import Link from "next/link";
import { HeroExplorer } from "@/components/home/HeroExplorer";
import { PillComposition } from "@/components/ui/PillComposition";
import { PillLink, SourceLink } from "@/components/ui/Pill";
import { Parallax } from "@/components/ui/Parallax";
import { getStats, pick } from "@/lib/stats";
import type { Stat } from "@/data/stats";

export default async function Home() {
  const { stats } = await getStats();
  const fb = pick(stats, "fb_pop_share");
  const online = pick(stats, "fraud_online_2025");
  const concern = pick(stats, "dnr_concern");
  const loss = pick(stats, "fraud_loss_2025");

  return (
    <>
      <HeroExplorer loss={loss.value} lossUrl={loss.source.url} />

      {/* Яагаад одоо: гурван тоо, нэг зураг */}
      <section aria-labelledby="why-title" className="mx-auto mt-20 max-w-6xl px-5">
        <div className="grid items-center gap-10 md:grid-cols-[1.25fr_1fr]">
          <Parallax speed={0.04} rotate={0.5}>
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
            <h2 id="why-title" className="text-[31.25px] leading-tight font-bold text-ink">
              Бараг бүгдээрээ нэг feed-ээс уншдаг
            </h2>
            <dl className="mt-6 space-y-4">
              <Fact swatch="bg-cat-5" s={fb} text="нь Facebook хэрэглэдэг" />
              <Fact swatch="bg-cat-2" s={online} text="залилан онлайнаар болсон (2025)" />
              <Fact swatch="bg-surface ring-1 ring-line" s={concern} text="нь үнэн, худлыг ялгахад эргэлздэг (дэлхий)" />
            </dl>
            <Link href="/data" className="link-accent mt-6 inline-block font-semibold">
              Бусад тоог хөдөлгөөнтэй үзэх
            </Link>
          </div>
        </div>
      </section>

      {/* Төгсгөл: хоёр үйлдэл */}
      <section className="mx-auto mt-24 max-w-6xl px-5">
        <div className="glass flex flex-col gap-6 rounded-2xl p-7 md:flex-row md:items-center md:justify-between md:p-10">
          <p className="max-w-lg text-[25px] leading-snug font-bold text-ink">
            Feed чинь яагаад ийм харагддагийг 2 минутад олоод, газрын зураг дээр гэрлээ асаа.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <PillLink href="/game" size="lg">
              Тоглоом тоглох
            </PillLink>
            <Link href="/data#map" className="link-accent font-semibold">
              Газрын зураг харах
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Fact({ swatch, s, text }: { swatch: string; s: Stat; text: string }) {
  return (
    <div className="flex items-start gap-4">
      <span aria-hidden className={`mt-3 h-3.5 w-7 shrink-0 rounded-full ${swatch}`} />
      <div>
        <dt className="inline text-[25px] font-bold text-ink tnum">{s.value}%</dt>{" "}
        <dd className="inline text-lg text-ink-2">{text}</dd>
        <div>
          <SourceLink source={s.source} period={s.period} className="text-ink-3" />
        </div>
      </div>
    </div>
  );
}
