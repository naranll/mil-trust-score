import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { Nav } from "@/components/ui/Nav";
import { NAV } from "@/data/nav";
import { Wordmark } from "@/components/ui/Wordmark";

export const metadata: Metadata = {
  title: { default: "Cure from the Core", template: "%s · Cure from the Core" },
  description: "Худал мэдээ бол шинж тэмдэг. Үндэс нь түүнийг түгээдэг систем. HACKMIL 2026 төсөл.",
};

export const viewport: Viewport = {
  themeColor: "#0a1024",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="mn" className="h-full">
      <body className="stardust relative isolate flex min-h-full flex-col overflow-x-clip">
        <a
          href="#main"
          className="sr-only rounded-full bg-accent px-4 py-2 font-semibold text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60]"
        >
          Үндсэн агуулга руу шилжих
        </a>
        <Nav />
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="mt-24 px-4 pb-6">
          <div className="glass mx-auto flex max-w-6xl flex-col gap-8 px-8 py-10 text-ink md:flex-row md:items-end md:justify-between md:px-14">
            <div className="space-y-2">
              <Wordmark size="lg" />
              <p className="text-[12.8px] text-ink-3">HACKMIL 2026 · demo</p>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="inline-flex min-h-11 items-center text-ink-2 hover:text-accent">
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
