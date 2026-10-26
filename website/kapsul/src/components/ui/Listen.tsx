"use client";

// Сонсох горим (Design system v3: --highlight = уншиж буй өгүүлбэр).
// #main доторх гарчиг, догол мөр, жагсаалтыг дарааллаар нь уншиж, уншиж буй хэсгийг тодруулна.
// Монгол хоолой байхгүй бол кирилл уншдаг орос хоолой, тэр ч байхгүй бол үндсэн хоолой.
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Square, Volume2 } from "lucide-react";

const READABLE = "h1,h2,h3,p,li,dt,dd,figcaption,label,blockquote,caption";

function collect(): HTMLElement[] {
  const main = document.getElementById("main");
  if (!main) return [];
  const all = Array.from(main.querySelectorAll<HTMLElement>(READABLE)).filter(
    (el) => el.offsetParent !== null && !el.closest('[aria-hidden="true"]') && !el.closest(".sr-only") && el.innerText.trim().length > 1,
  );
  // Дотроо өөр уншигдах элемент агуулсан бол давхардуулахгүй (жишээ нь p агуулсан li)
  return all.filter((el) => !all.some((o) => o !== el && el.contains(o)));
}

function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang.toLowerCase().startsWith("mn")) ?? voices.find((v) => v.lang.toLowerCase().startsWith("ru")) ?? null;
}

export function ListenButton() {
  const [on, setOn] = useState(false);
  // Браузер дэмжих эсэх (server дээр false)
  const ok = useSyncExternalStore(
    () => () => {},
    () => "speechSynthesis" in window,
    () => false,
  );
  const run = useRef(0);
  const path = usePathname();

  const clearMark = () => document.querySelectorAll("[data-listen-now]").forEach((el) => el.removeAttribute("data-listen-now"));

  const stop = useCallback(() => {
    run.current++;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    clearMark();
    setOn(false);
  }, []);

  const start = () => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const id = ++run.current;
    const items = collect();
    const voice = pickVoice();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setOn(true);

    const speak = (i: number) => {
      if (id !== run.current) return;
      clearMark();
      if (i >= items.length) return stop();
      const el = items[i];
      el.setAttribute("data-listen-now", "");
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      const u = new SpeechSynthesisUtterance(el.innerText.replace(/\s+/g, " ").trim());
      u.lang = voice?.lang ?? "mn-MN";
      if (voice) u.voice = voice;
      u.onend = () => speak(i + 1);
      u.onerror = (e) => (e.error === "interrupted" || e.error === "canceled" ? undefined : speak(i + 1));
      synth.speak(u);
    };
    speak(0);
  };

  useEffect(() => {
    // Зарим браузер хоолойн жагсаалтыг хожуу ачаална
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
  }, []);

  // Хуудас солиход эсвэл Esc дарахад зогсоно
  useEffect(() => stop, [path, stop]);
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && stop();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on, stop]);

  if (!ok) return null;
  return (
    <button
      type="button"
      onClick={on ? stop : start}
      aria-pressed={on}
      aria-label={on ? "Сонсохыг зогсоох" : "Хуудсыг чангаар унших"}
      className="btn btn-secondary px-4"
    >
      {on ? <Square aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
      <span className="hidden xl:inline">{on ? "Зогсоох" : "Сонсох"}</span>
    </button>
  );
}
