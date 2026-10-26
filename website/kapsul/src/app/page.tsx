import { HeroExplorer } from "@/components/home/HeroExplorer";
import { PillLink, SourceLink } from "@/components/ui/Pill";
import { getStats, pick } from "@/lib/stats";

export default async function Home() {
  const { stats } = await getStats();
  const fb = pick(stats, "fb_pop_share");
  const online = pick(stats, "fraud_online_2025");
  const concern = pick(stats, "dnr_concern");
  const loss = pick(stats, "fraud_loss_2025");

  // Гурван тоо: нэг хэмжүүр тул нэг өнгө (cat-1), шууд шошготой
  const facts = [
    { s: fb, text: "Монгол хүн амын Facebook хэрэглэдэг хэсэг" },
    { s: online, text: "Цахим орчинд үйлдэгдсэн залилан, 2025" },
    { s: concern, text: "Онлайн мэдээний үнэн, худлыг ялгахад санаа зовдог хүмүүс, дэлхий" },
  ];

  return (
    <>
      <HeroExplorer loss={loss.value} lossUrl={loss.source.url} />

      <section aria-labelledby="why-title" className="mx-auto mt-20 max-w-6xl px-5">
        <figure className="glass p-6 md:p-10">
          <h2 id="why-title" className="text-[25px] leading-tight font-bold text-ink md:text-[31.25px]">
            Бараг бүгдээрээ нэг feed-ээс уншдаг
          </h2>
          <ul className="mt-8 space-y-6">
            {facts.map(({ s, text }) => (
              <li key={s.key}>
                <div className="grid grid-cols-[4.5rem_1fr] items-center gap-4 md:grid-cols-[5.5rem_1fr]">
                  <span className="text-[25px] font-bold text-ink tnum md:text-[31.25px]">{s.value}%</span>
                  <span className="h-5 overflow-hidden rounded-full bg-subtle">
                    <span className="grow block h-full rounded-full bg-cat-1" style={{ width: `${s.value}%` }} />
                  </span>
                </div>
                <p className="mt-1 pl-[5.5rem] text-ink-2 md:pl-[6.5rem]">
                  {text} · <SourceLink source={s.source} period={s.period} className="text-ink-3" />
                </p>
              </li>
            ))}
          </ul>
        </figure>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-5">
        <div className="glass flex flex-col gap-6 p-7 md:flex-row md:items-center md:justify-between md:p-10">
          <p className="max-w-lg text-[25px] leading-snug font-bold text-ink">Feed-ээ 2 минутад задлаарай</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <PillLink href="/game">Тоглоом тоглох</PillLink>
            <PillLink href="/about#map" tone="quiet">
              Газрын зураг
            </PillLink>
          </div>
        </div>
      </section>
    </>
  );
}
