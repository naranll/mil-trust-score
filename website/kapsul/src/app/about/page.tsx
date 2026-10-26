import type { Metadata } from "next";
import { PillLink } from "@/components/ui/Pill";
import { SITE, TEAM } from "@/data/site";

export const metadata: Metadata = { title: "Бидний тухай", description: "Cure the Core багийн тухай: HACKMIL 2026." };

const WONT = [
  "“Худал мэдээг шийднэ” гэж амлахгүй",
  "Хүнд оноо, шошго наахгүй",
  "Хэрэглэгчийн хувийн мэдээлэл цуглуулахгүй",
  "Улс төрийн аль нэг талыг баримтлахгүй",
];

export default function About() {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-14 md:pt-20">
      <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:items-end">
        <h1 className="font-display text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.98] font-bold tracking-[-0.025em] text-ink">
          Бид навч биш, үндэс рүү хардаг
        </h1>
        <p className="text-lg leading-relaxed text-ink">
          Бид {SITE.hackathon}-д оролцож буй 4 оюутан. Facebook дээрх манипуляцийг нэг пост бүрээр нь биш, харин түүнийг
          бүтээж, түгээдэг системээр нь ойлгуулахыг зорьдог.
        </p>
      </div>

      <section aria-labelledby="team-title" className="mt-24">
        <h2 id="team-title" className="font-display text-2xl font-bold text-ink md:text-3xl">
          Баг
        </h2>
        <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((m, i) => (
            <li key={m.role}>
              <span
                aria-hidden
                className={`font-display flex h-24 w-full items-center rounded-full px-7 text-3xl font-bold ${
                  ["bg-accent text-on-accent", "bg-inverse text-on-inverse", "bg-accent-tint text-ink", "bg-inverse text-on-inverse"][i]
                }`}
              >
                {m.placeholder ? "?" : m.name.split(".").pop()?.charAt(0)}
              </span>
              <p className={`mt-4 text-lg font-semibold ${m.placeholder ? "text-ink-2" : "text-ink"}`}>{m.name}</p>
              <p className="text-ink">{m.role}</p>
              <p className="mt-2 leading-relaxed text-ink-2">{m.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="wont-title" className="mt-28 grid gap-10 md:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 id="wont-title" className="font-display text-2xl font-bold text-ink md:text-3xl">
            Бидний хийхгүй зүйлс
          </h2>
          <p className="mt-3 max-w-sm leading-relaxed text-ink-2">
            Өвчтөн нь хэрэглэгч биш, мэдээллийн орчин. Бид онош тавьдаггүй, харин багаж өгдөг.
          </p>
        </div>
        <ul className="space-y-2">
          {WONT.map((w) => (
            <li key={w} className="rounded-full bg-subtle px-6 py-4 text-lg text-ink">
              {w}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-28 flex flex-col items-start gap-6 glass rounded-2xl px-8 py-10 md:flex-row md:items-center md:justify-between md:px-14">
        <p className="font-display max-w-xl text-xl leading-snug font-semibold text-ink md:text-2xl">
          Өгөгдлийн бүх эх сурвалж нээлттэй. Тоо бүрийн хажууд линк нь бий.
        </p>
        <PillLink href="/data" tone="secondary">
          Өгөгдөл үзэх
        </PillLink>
      </section>
    </div>
  );
}
