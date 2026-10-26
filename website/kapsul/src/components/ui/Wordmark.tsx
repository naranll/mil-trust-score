// Лого: капсул icon (зүүн тал дүүрэн, баруун тал хүрээ) + нэр. Design system v3-ийн дагуу.
export function CapsuleMark({ className = "h-4 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 16" className={className} aria-hidden>
      <rect x="1" y="1" width="30" height="14" rx="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 1h8v14H8a7 7 0 0 1 0-14z" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className={`inline-flex select-none items-center gap-2.5 font-bold text-ink ${size === "lg" ? "text-xl" : "text-[15px]"}`}>
      <CapsuleMark className={`text-accent ${size === "lg" ? "h-5 w-10" : "h-4 w-8"}`} />
      Cure from the Core
    </span>
  );
}
