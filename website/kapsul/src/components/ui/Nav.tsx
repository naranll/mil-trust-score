"use client";

// Header: бүтэн өргөнтэй, frosted (85% surface + 12px blur), 64px өндөр, нэмэлт товчгүй. Холбоос нь icon-гүй, цэвэр текст;
// идэвхтэй хуудас 600 жин + доор нь accent зураас, aria-current. Утсан дээр цэсний товч бүтэн дэлгэцийн sheet нээнэ.
// Нүүрний гүйлгээтэй хэсэг (-mt-16) энэ өндрийг тооцдог.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { NAV } from "@/data/nav";

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(href + "/");

  // Sheet нээлттэй үед Esc-ээр хаана
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50">
      {/* Frost нь тусдаа давхарга: backdrop-filter нь header дээр байвал fixed sheet-ийн байрлалыг header-т хорьчихно */}
      <div aria-hidden className="frost pointer-events-none absolute inset-0 -z-10" />
      <nav aria-label="Үндсэн цэс" className="flex h-16 w-full items-center justify-between gap-6 px-5 md:px-10 xl:px-16">
        <Link href="/" aria-label="Нүүр хуудас" onClick={() => setOpen(false)} className="rounded-lg">
          <Wordmark />
        </Link>

        <ul className="hidden h-full items-stretch lg:flex">
          {NAV.map((n) => {
            const active = isActive(n.href);
            return (
              <li key={n.href} className="flex">
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative inline-flex items-center px-4 text-small transition-colors duration-(--dur-fast) after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:rounded-full ${
                    active ? "font-semibold text-ink after:bg-accent" : "text-ink-2 after:bg-transparent hover:text-ink"
                  }`}
                >
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Утсан дээр л цэсний товч (компьютер дээр холбоосууд шууд харагдана) */}
        <div className="flex items-center lg:hidden">
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-subtle lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Цэс хаах" : "Цэс нээх"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <ul
          id="mobile-menu"
          className="fixed inset-x-0 top-16 bottom-0 flex flex-col overflow-y-auto border-t border-(--rule) bg-bg px-5 py-4 lg:hidden"
        >
          {NAV.map((n) => {
            const active = isActive(n.href);
            return (
              <li key={n.href} className="border-b border-(--rule)">
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-14 items-center justify-between text-h3 ${active ? "font-semibold text-ink" : "text-ink-2"}`}
                >
                  {n.label}
                  {active && <span aria-hidden className="size-2 rounded-full bg-accent" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </header>
  );
}
