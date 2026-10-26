// Лого: «Todruulii» багийн нэр + тэмдэг. Тэмдэг: бүдэг жижиг цэгүүд дараалан томорч, сүүлийнх нь тод бүтэн цэг болно,
// бүдэг зүйлийг тодруулна (сайтын цэгэн капсул, мод, хөрөгтэй нэг хэл).
export function TodruuliiMark({ className = "h-4 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 16" className={className} aria-hidden>
      <circle cx="2.4" cy="8" r="1.4" fill="currentColor" opacity="0.3" />
      <circle cx="7.6" cy="8" r="2.1" fill="currentColor" opacity="0.5" />
      <circle cx="14.2" cy="8" r="3" fill="currentColor" opacity="0.75" />
      <circle cx="22.6" cy="8" r="4.6" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className={`inline-flex select-none items-center gap-2 font-bold tracking-[-0.01em] text-ink ${size === "lg" ? "text-xl" : "text-[17px]"}`}>
      <TodruuliiMark className={`text-accent ${size === "lg" ? "h-5 w-9" : "h-4 w-7"}`} />
      Todruulii
    </span>
  );
}
