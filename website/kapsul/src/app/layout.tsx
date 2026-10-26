import type { Metadata, Viewport } from "next";
import { ArrowUpRight } from "lucide-react";
import "./globals.css";
import { Nav } from "@/components/ui/Nav";
import { SITE } from "@/data/site";

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
        {/* Footer: minimal, зөвхөн холбогдох мэдээлэл (цэс нь header-т). Имэйл нь SITE.email бөглөгдсөн үед л. */}
        <footer className="mt-24 border-t border-(--rule)">
          <div className="flex w-full flex-col gap-2 px-5 py-6 text-[14px] text-ink-3 sm:flex-row sm:items-center sm:justify-between md:px-10 xl:px-16">
            <p>
              Cure the Core баг, {SITE.hackathon}
            </p>
            <ul className="flex flex-wrap items-center gap-x-6">
              {SITE.email && (
                <li>
                  <a href={`mailto:${SITE.email}`} className="inline-flex min-h-11 items-center hover:text-ink">
                    {SITE.email}
                  </a>
                </li>
              )}
              <li>
                <a
                  href={SITE.github}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-1 hover:text-ink"
                >
                  GitHub
                  <ArrowUpRight aria-hidden className="size-3" />
                </a>
              </li>
            </ul>
          </div>
        </footer>
      </body>
    </html>
  );
}
