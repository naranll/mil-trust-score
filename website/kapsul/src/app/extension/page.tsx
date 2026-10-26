import type { Metadata } from "next";
import Link from "next/link";
import { SyntheticTag } from "@/components/ui/Pill";
import { SITE } from "@/data/site";

export const metadata: Metadata = {
  title: "Extension",
  description: "Facebook дээр текст сонгоод манипуляцийн дохиог задалж харах Chrome extension.",
};

// Зураглалд харуулах дохионууд (зохиомол жишээ пост дээр)
const SIGNALS = [
  { name: "Сэтгэл хөдлөл өдөөсөн үг", why: "«ЭНЭ Ч ДЭЭ!!!», «чимээгүй байж болохгүй» гэх мэт үгс бодохоос өмнө хариу үйлдэл хийлгэдэг." },
  { name: "Эх сурвалж байхгүй", why: "Хэн, хэзээ, хаана гэдэг нь тодорхойгүй. Шалгах боломжгүй мэдэгдэл байна." },
  { name: "Хуваалцахыг шахсан", why: "«Бүгдэд мэдэгдээрэй» гэдэг нь тархалтыг хурдасгах зориулалттай." },
];

const STEPS = [
  { t: "Татах", d: "Extension-ий .zip файлыг татаж задална." },
  { t: "Developer mode асаах", d: "Chrome дээр chrome://extensions руу ороод баруун дээд буланд Developer mode-ийг асаана." },
  { t: "Load unpacked", d: "«Load unpacked» товч дээр дарж задалсан хавтсаа сонгоно." },
  { t: "Facebook дээр турших", d: "Аль нэг постын текстийг тэмдэглээд гарч ирэх «Шалгах» товчийг дарна." },
];

export default function ExtensionPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-14 md:pt-20">
      <div className="grid gap-12 md:grid-cols-[1fr_1.05fr] md:items-center [&>*]:min-w-0">
        <div>
          <h1 className="font-display text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.98] font-bold tracking-[-0.025em] text-ink">
            Текстээ сонго, дохиог нь хар
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink">
            Facebook дээр сэжигтэй пост харвал текстийг нь тэмдэглээд «Шалгах» товчийг дар. Extension манипуляцийн
            дохионуудыг задалж, яагаад тэгж үзсэнийг тайлбарлана. <strong className="text-ink">Дүгнэлтийг чи өөрөө гаргана.</strong>
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            {SITE.extensionUrl ? (
              <a href={SITE.extensionUrl} className="rounded-full bg-accent px-7 py-4 text-lg font-semibold text-ink hover:bg-accent-deep hover:text-on-inverse">
                Extension татах
              </a>
            ) : (
              <span className="rounded-full bg-subtle px-7 py-4 text-lg font-semibold text-ink-2" aria-disabled>
                Татах линк удахгүй гарна
              </span>
            )}
            <Link href="/game" className="font-semibold text-ink link-accent">
              Эхлээд тоглоом тоглох
            </Link>
          </div>
        </div>

        {/* Popup-ийн зураглал */}
        <figure>
          <div className="rounded-2xl bg-inverse p-3 shadow-2">
            <div className="rounded-2xl bg-surface p-5 md:p-6">
              <p className="rounded-2xl bg-accent-tint px-4 py-3 text-sm leading-relaxed text-ink">
                <mark className="rounded bg-highlight px-0.5 text-ink">ЭНЭ Ч ДЭЭ!!! Тэд дахиад л биднийг тоосонгүй. Хуваалцаж бүгдэд мэдэгдээрэй</mark>, чимээгүй
                байж болохгүй!
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="font-display font-semibold text-ink">Манипуляцийн дохио</p>
                <div className="flex items-center gap-1.5" aria-label="Түвшин: өндөр">
                  <span className="h-3 w-7 rounded-full bg-accent" />
                  <span className="h-3 w-7 rounded-full bg-accent" />
                  <span className="h-3 w-7 rounded-full bg-accent" />
                  <span className="ml-1.5 text-sm font-semibold text-ink">Өндөр</span>
                </div>
              </div>

              <ul className="mt-4 space-y-2.5">
                {SIGNALS.map((s) => (
                  <li key={s.name} className="rounded-2xl bg-surface px-4 py-3 ring-1 ring-line/20">
                    <p className="font-semibold text-ink">{s.name}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-2">{s.why}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-4 rounded-full bg-inverse px-4 py-2.5 text-center text-sm font-semibold text-on-inverse">
                Хуваалцахаасаа өмнө: үүнийг хэн, юуны төлөө бичсэн бэ?
              </p>
            </div>
          </div>
          <figcaption className="mt-3 flex items-center gap-2 text-sm text-ink-2">
            <SyntheticTag>Зураглал</SyntheticTag> Жишээ пост зохиомол. Бодит extension-ий харагдах байдал өөр байж болно.
          </figcaption>
        </figure>
      </div>

      <section aria-labelledby="install-title" className="mt-28">
        <h2 id="install-title" className="font-display text-2xl font-bold text-ink md:text-3xl">
          Суулгах
        </h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.t}>
              <span aria-hidden className="font-display inline-flex size-11 items-center justify-center rounded-full bg-accent text-lg font-bold text-ink">
                {i + 1}
              </span>
              <p className="mt-3 text-lg font-semibold text-ink">{s.t}</p>
              <p className="mt-1 leading-relaxed text-ink-2">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-24 rounded-2xl bg-accent-tint px-8 py-10 md:px-14">
        <h2 className="font-display text-xl font-bold text-ink md:text-2xl">Хувийн мэдээлэл</h2>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink">
          Extension зөвхөн чиний тэмдэглэсэн текстийг шинжилнэ. Нэр, сэтгэгдэл, үзсэн түүх зэргийг хадгалахгүй.
        </p>
      </section>
    </div>
  );
}
