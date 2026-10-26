"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { NAV } from "@/data/nav";


export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-3 z-50 px-4">
      <nav
        aria-label="Үндсэн цэс"
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full bg-surface/85 py-1.5 pr-1.5 pl-4 shadow-1 ring-1 ring-line/20 backdrop-blur-[12px]"
      >
        <Link href="/" aria-label="Нүүр хуудас" onClick={() => setOpen(false)}>
          <Wordmark />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => {
            const active = path === n.href || path.startsWith(n.href + "/");
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full px-4 text-[15px] transition-colors duration-[var(--dur-fast)] ${
                    active ? "bg-accent-tint font-semibold text-accent" : "text-ink-2 hover:bg-subtle hover:text-ink"
                  }`}
                >
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-subtle md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Цэс хаах" : "Цэс нээх"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {open && (
        <ul
          id="mobile-menu"
          className="mx-auto mt-2 flex max-w-6xl flex-col gap-1.5 rounded-2xl bg-surface p-2 shadow-2 ring-1 ring-line/20 md:hidden"
        >
          {NAV.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                onClick={() => setOpen(false)}
                className={`block rounded-full px-5 py-3 text-base ${
                  path.startsWith(n.href) ? "bg-accent-tint font-semibold text-accent" : "text-ink hover:bg-subtle"
                }`}
              >
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
