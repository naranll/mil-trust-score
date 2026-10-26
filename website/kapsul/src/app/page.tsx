import { LandingScroll } from "@/components/landing/LandingScroll";
import { PillLink } from "@/components/ui/Pill";

// Нүүр: гүйлгээтэй капсулын түүх, дараа нь тоглоом руу урилга.
// «Бараг бүгдээрээ нэг feed-ээс уншдаг» тоонууд /data хуудас руу шилжсэн (components/data/FeedStars).
export default function Home() {
  return (
    <>
      <LandingScroll />

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
