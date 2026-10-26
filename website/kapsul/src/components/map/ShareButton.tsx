"use client";

// Хуваалцах товч. Амжилттай хуваалцвал (эсвэл линк хуулбал) хуваалцагчийн аймаг дээр +1 гэрэл асна.
// Нэг хуудсыг нэг браузераас нэг л удаа тоолно.
import Link from "next/link";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { AIMAG_BY_ID } from "@/data/aimags";
import { addLight, getSavedAimag } from "@/lib/lights";
import { AimagPicker } from "./AimagPicker";

type State = { kind: "idle" } | { kind: "pick" } | { kind: "busy" } | { kind: "done"; text: string } | { kind: "error"; text: string };

export function ShareButton({ title, path, quiet }: { title: string; path: string; quiet?: boolean }) {
  const [st, setSt] = useState<State>({ kind: "idle" });
  const key = `ctc-shared:${path}`;

  const light = async (aimag: string, copied: boolean) => {
    const prefix = copied ? "Линк хуулагдлаа." : "Хуваалцлаа.";
    try {
      if (localStorage.getItem(key)) {
        setSt({ kind: "done", text: `${prefix} Энэ хуудсанд гэрэл аль хэдийн асаасан.` });
        return;
      }
    } catch {
      /* localStorage байхгүй: үргэлжлүүлнэ */
    }
    setSt({ kind: "busy" });
    try {
      await addLight("share", aimag);
      try {
        localStorage.setItem(key, "1");
      } catch {}
      setSt({ kind: "done", text: `${prefix} ${AIMAG_BY_ID[aimag]?.name} дээр +1 гэрэл асав.` });
    } catch (e) {
      setSt({ kind: "error", text: (e as Error).message });
    }
  };

  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = new URL(path, window.location.origin).toString();
    let didCopy = false;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        didCopy = true;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // хэрэглэгч цуцалсан
      setSt({ kind: "error", text: "Хуваалцаж чадсангүй. Хаягийн мөрөөс линкийг хуулна уу." });
      return;
    }
    setCopied(didCopy);
    const saved = getSavedAimag();
    if (saved) light(saved, didCopy);
    else setSt({ kind: "pick" });
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={share}
        disabled={st.kind === "busy"}
        className={`btn self-start ${quiet ? "btn-secondary" : "btn-primary"}`}
      >
        <Share2 className="size-4" aria-hidden />
        Хуваалцах
      </button>
      {st.kind === "pick" && <AimagPicker onPick={(id) => light(id, copied)} />}
      {/* Хоосон үед sr-only: зай эзлэхгүй тул товч хажуугийн товчтойгоо нэг шугамд байна */}
      <p role="status" className="text-[15px] text-ink-2 empty:sr-only">
        {st.kind === "done" && (
          <>
            {st.text}{" "}
            <Link href="/about#map" className="link-accent font-semibold">
              Газрын зураг дээр харах
            </Link>
          </>
        )}
        {st.kind === "error" && <span className="text-false">{st.text}</span>}
      </p>
    </div>
  );
}
