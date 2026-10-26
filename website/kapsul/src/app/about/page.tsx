import type { Metadata } from "next";
import { Ban } from "lucide-react";
import { PillLink } from "@/components/ui/Pill";
import { LightMap } from "@/components/map/LightMap";
import { RootsTree } from "@/components/about/RootsTree";
import { LAYERS } from "@/data/layers";
import { SITE, TEAM } from "@/data/site";
import { H1, PAGE } from "@/components/ui/PageTitle";

export const metadata: Metadata = { title: "Бидний тухай", description: "Todruulii баг, HACKMIL 2026." };

const WONT = ["Худал мэдээг «шийднэ» гэж амлахгүй", "Хүнд оноо, шошго наахгүй", "Хувийн мэдээлэл цуглуулахгүй", "Улс төрийн тал баримтлахгүй"];

const H2 = "text-h2 font-bold text-ink";

export default function About() {
  return (
    <div className={PAGE}>
      {/* Hero: зүүн талд санаа, баруун талд гүйлгэхэд үндэс нь ургадаг цэгэн мод */}
      <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,40rem)] lg:gap-12">
        <div>
          <h1 className={`max-w-[14ch] ${H1}`}>
            Бид навч биш, үндсийг хардаг
          </h1>
          <p className="mt-6 max-w-[56ch] text-intro leading-relaxed text-ink-2">
            Навч бүр таны харж буй нэг пост. Харин үндэс нь тэр постыг танд харуулж буй систем. Бид энэ системийн дөрвөн үндсийг ил гаргана.
          </p>
          <ul className="mt-8 grid max-w-2xl gap-x-8 gap-y-4 sm:grid-cols-2">
            {LAYERS.map((l) => (
              <li key={l.id} className="flex gap-3">
                <span aria-hidden className="mt-2 size-2.5 shrink-0 rounded-full" style={{ background: l.particle }} />
                <span>
                  <span className="block font-semibold text-ink">{l.name}</span>
                  <span className="text-small text-ink-2">{l.question}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-small text-ink-3">{SITE.hackathon}-д оролцож буй 4 оюутан</p>
        </div>
        <RootsTree className="mx-auto w-full max-w-[30rem] lg:-mt-6 lg:max-w-none" />
      </section>

      <section aria-labelledby="team-title" className="mt-14 md:mt-20">
        <h2 id="team-title" className={H2}>
          Баг
        </h2>
        <ul className="mt-6 grid border-t border-line sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((m) => (
            <li key={m.role} className="border-b border-line py-6 sm:pr-8 lg:border-b-0">
              <p className={`text-lead font-semibold ${m.placeholder ? "text-ink-2" : "text-ink"}`}>{m.name}</p>
              <p className="text-ink-2">{m.role}</p>
              <p className="mt-3 max-w-[34ch] text-small leading-relaxed text-ink-3">{m.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="map" aria-labelledby="map-title" className="mt-14 scroll-mt-24 md:mt-20">
        <h2 id="map-title" className={`mb-6 ${H2}`}>
          Мэдлэг хэрхэн тархаж байна
        </h2>
        <LightMap />
      </section>

      <section aria-labelledby="wont-title" className="mt-14 grid gap-6 md:mt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
        <h2 id="wont-title" className={H2}>
          Бидний хийхгүй зүйл
        </h2>
        <ul className="grid border-t border-line sm:grid-cols-2">
          {WONT.map((w) => (
            <li key={w} className="flex items-center gap-3 border-b border-line py-5 text-lead text-ink sm:pr-6">
              <Ban aria-hidden className="size-5 shrink-0 text-ink-3" />
              {w}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 flex flex-col items-start gap-6 border-t border-line pt-10 md:mt-20 md:flex-row md:items-center md:justify-between">
        <p className="text-h3 font-semibold text-ink md:text-h2">Тоо бүрийн эх сурвалж нээлттэй</p>
        <PillLink href="/data" tone="secondary">
          Өгөгдөл үзэх
        </PillLink>
      </section>
    </div>
  );
}
