import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Source } from "@/data/stats";

// Design system v3: товч 44px, капсул хэлбэртэй, нэг дэлгэцэнд нэг primary. Класс нь globals.css-д.
type Tone = "primary" | "secondary" | "quiet";

export function PillLink({ href, children, tone = "primary" }: { href: string; children: React.ReactNode; tone?: Tone }) {
  return (
    <Link href={href} className={tone === "quiet" ? "btn-quiet inline-flex items-center" : `btn btn-${tone}`}>
      {children}
    </Link>
  );
}

// Тоо бүрийн эх сурвалж. Шүүгч дарж шалгах боломжтой.
export function SourceLink({ source, period, className = "" }: { source: Source; period?: string; className?: string }) {
  if (!source.url)
    return (
      <span className={`inline-flex items-center gap-1 text-[12.8px] font-medium ${className}`}>
        Эх сурвалж: {source.name}
        {period ? `, ${period}` : ""}
      </span>
    );
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1 text-[12.8px] font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current ${className}`}
    >
      Эх сурвалж: {source.name}
      {period ? `, ${period}` : ""}
      <ArrowUpRight aria-hidden className="size-3" />
    </a>
  );
}

// Зохиомол контентыг тэмдэглэх ("Мэдээлэл" дүгнэлтийн өнгө)
export function SyntheticTag({ children = "Зохиомол жишээ" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-info-tint px-2.5 py-0.5 text-[12.8px] font-semibold text-ink">
      {children}
    </span>
  );
}
