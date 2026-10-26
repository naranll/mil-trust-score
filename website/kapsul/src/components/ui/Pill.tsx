import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Source } from "@/data/stats";

// Design system v3: товч 44px өндөр, капсул хэлбэртэй, нэг дэлгэцэнд нэг primary.
type Tone = "primary" | "secondary";

const tones: Record<Tone, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-strong",
  secondary: "bg-surface text-accent ring-[1.5px] ring-inset ring-accent hover:bg-accent-tint",
};

export function PillLink({
  href,
  children,
  tone = "primary",
  size = "md",
}: {
  href: string;
  children: React.ReactNode;
  tone?: Tone;
  size?: "md" | "lg";
}) {
  const sz = size === "lg" ? "min-h-12 px-7 text-base md:text-lg" : "min-h-11 px-5 text-[15px]";
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-[var(--dur-fast)] ${tones[tone]} ${sz}`}
    >
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
