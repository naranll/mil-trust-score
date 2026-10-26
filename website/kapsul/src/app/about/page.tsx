import type { Metadata } from "next";
import { Ban } from "lucide-react";
import { PillLink } from "@/components/ui/Pill";
import { LightMap } from "@/components/map/LightMap";
import { SITE, TEAM } from "@/data/site";

export const metadata: Metadata = { title: "Бидний тухай", description: "Cure from the Core баг, HACKMIL 2026." };

const WONT = ["Худал мэдээг «шийднэ» гэж амлахгүй", "Хүнд оноо, шошго наахгүй", "Хувийн мэдээлэл цуглуулахгүй", "Улс төрийн тал баримтлахгүй"];

export default function About() {
  return (
    <div className="w-full px-5 pt-14 md:px-10 md:pt-20 xl:px-16">
      <h1 className="max-w-3xl text-[clamp(2.4rem,6vw,4.25rem)] leading-[1.02] font-bold tracking-[-0.025em] text-ink">
        Бид навч биш, үндсийг хардаг
      </h1>
      <p className="mt-4 text-xl text-ink-2">{SITE.hackathon}-д оролцож буй 4 оюутан</p>

      <section aria-labelledby="team-title" className="mt-16">
        <h2 id="team-title" className="text-[25px] font-bold text-ink md:text-[31.25px]">
          Баг
        </h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((m) => (
            <li key={m.role} className="glass p-5">
              <span aria-hidden className="inline-flex size-12 items-center justify-center rounded-full bg-accent-tint text-xl font-bold text-accent">
                {m.placeholder ? "?" : m.name.split(".").pop()?.charAt(0)}
              </span>
              <p className={`mt-4 text-lg font-semibold ${m.placeholder ? "text-ink-2" : "text-ink"}`}>{m.name}</p>
              <p className="text-ink-2">{m.role}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="map" aria-labelledby="map-title" className="mt-16 scroll-mt-24">
        <h2 id="map-title" className="mb-6 text-[25px] font-bold text-ink md:text-[31.25px]">
          Мэдлэг хэрхэн тархаж байна
        </h2>
        <LightMap />
      </section>

      <section aria-labelledby="wont-title" className="mt-16">
        <h2 id="wont-title" className="text-[25px] font-bold text-ink md:text-[31.25px]">
          Бидний хийхгүй зүйл
        </h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {WONT.map((w) => (
            <li key={w} className="glass flex items-center gap-3 p-5 text-lg text-ink">
              <Ban aria-hidden className="size-5 shrink-0 text-ink-3" />
              {w}
            </li>
          ))}
        </ul>
      </section>

      <section className="glass mt-16 flex flex-col items-start gap-6 p-7 md:flex-row md:items-center md:justify-between md:p-10">
        <p className="text-[20px] font-semibold text-ink md:text-[25px]">Тоо бүрийн эх сурвалж нээлттэй</p>
        <PillLink href="/data" tone="secondary">
          Өгөгдөл үзэх
        </PillLink>
      </section>
    </div>
  );
}
