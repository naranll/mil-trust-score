import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { Nav } from "@/components/ui/Nav";
import { NAV } from "@/data/nav";
import { Wordmark } from "@/components/ui/Wordmark";
import { Ambient } from "@/components/ui/Ambient";

export const metadata: Metadata = {
  title: { default: "Cure the Core: навчийг биш, үндсийг эмчил", template: "%s · Cure the Core" },
  description:
    "Худал мэдээлэл бол шинж тэмдэг. Өвчин нь түүнийг үйлдвэрлэж, түгээдэг систем. Facebook-ийн алгоритм, тархалт, бидний дадлыг ойлгох HACKMIL 2026 төсөл.",
};

export const viewport: Viewport = {
  themeColor: "#f4ecdf",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="mn" className="h-full">
      <body className="relative isolate flex min-h-full flex-col overflow-x-clip">
        <a
          href="#main"
          className="sr-only rounded-full bg-accent px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60]"
        >
          Үндсэн агуулга руу шилжих
        </a>
        <Ambient />
        <Nav />
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="mt-24 px-4 pb-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 glass rounded-2xl px-8 py-10 text-ink md:flex-row md:items-end md:justify-between md:px-14">
            <div className="space-y-3">
              <Wordmark size="lg" />
              <p className="max-w-sm text-sm text-ink-2">
                HACKMIL 2026 хакатонд зориулж хийсэн demo вэб.
              </p>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="text-ink-2 hover:text-accent">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </footer>
      </body>
    </html>
  );
}
