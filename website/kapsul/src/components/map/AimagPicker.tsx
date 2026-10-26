"use client";

// Гэрэл асаах аймгийг сонгох. Сонголтыг дараагийн удаа санана.
import { useState } from "react";
import { AIMAGS } from "@/data/aimags";
import { getSavedAimag, saveAimag } from "@/lib/lights";

export function AimagPicker({ onPick, label = "Гэрэл асаах", busy }: { onPick: (id: string) => void; label?: string; busy?: boolean }) {
  const [value, setValue] = useState(() => (typeof window === "undefined" ? "" : getSavedAimag() ?? ""));
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value) return;
        saveAimag(value);
        onPick(value);
      }}
    >
      <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-[15px] font-semibold text-ink">
        Таны аймаг, хот
        <select
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-11 rounded-lg bg-surface px-3 text-base font-normal text-ink ring-[1.5px] ring-inset ring-line focus:outline-none focus-visible:ring-[3px] focus-visible:ring-accent"
        >
          <option value="" disabled>
            Сонгох
          </option>
          {AIMAGS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={!value || busy}
        className="btn btn-primary"
      >
        {busy ? "Асааж байна…" : label}
      </button>
    </form>
  );
}
