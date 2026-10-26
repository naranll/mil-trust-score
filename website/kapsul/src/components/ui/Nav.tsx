"use client";

// Header: frosted (85% surface + 12px blur). Идэвхтэй хуудас: tint pill, 600 жин, aria-current.
// Утсан дээр цэсний товч бүтэн өндөртэй sheet нээнэ.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChartColumn,
  Copy,
  House,
  Menu,
  Pencil,
  ScanSearch,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Wordmark } from "./Wordmark";
import { ListenButton } from "./Listen";
import { NAV } from "@/data/nav";

const ICONS: Record<string, LucideIcon> = {
  "/": House,
  "/extension": ScanSearch,
  "/game": Copy,
  "/data": ChartColumn,
  "/blog": Pencil,
  "/about": Users,
};

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
    <header className="sticky top-3 z-50 px-4">
      <nav
        aria-label="Үндсэн цэс"
        className="frost mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full py-1.5 pr-1.5 pl-4"
      >
        <Link
          href="/"
          aria-label="Нүүр хуудас"
          onClick={() => setOpen(false)}
          className="rounded-full"
        >
          <Wordmark />
        </Link>

        <ul className="hidden items-center gap-0.5 lg:flex">
          {NAV.map((n) => {
            const Icon = ICONS[n.href];
            const active = isActive(n.href);
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-[15px] transition-colors duration-[var(--dur-fast)] ${
                    active
                      ? "bg-accent-tint font-semibold text-accent"
                      : "text-ink-2 hover:bg-subtle hover:text-ink"
                  }`}
                >
                  <Icon aria-hidden className="size-4" strokeWidth={2} />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-1.5">
          <ListenButton />
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
          className="fixed inset-x-4 top-[4.5rem] bottom-4 flex flex-col gap-1 overflow-y-auto rounded-2xl bg-surface p-3 shadow-2 lg:hidden"
        >
          {NAV.map((n) => {
            const Icon = ICONS[n.href];
            const active = isActive(n.href);
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-12 items-center gap-3 rounded-full px-5 text-lg ${
                    active
                      ? "bg-accent-tint font-semibold text-accent"
                      : "text-ink hover:bg-subtle"
                  }`}
                >
                  <Icon aria-hidden className="size-5" />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </header>
  );
}
