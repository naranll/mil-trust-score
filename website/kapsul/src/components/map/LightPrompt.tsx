"use client";

// Тоглоом дуусахад гарна: аймгаа сонгоод газрын зураг дээр гэрлээ асаана.
import Link from "next/link";
import { useState } from "react";
import { AIMAG_BY_ID } from "@/data/aimags";
import { addLight } from "@/lib/lights";
import { AimagPicker } from "./AimagPicker";

export function LightPrompt() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const light = async (aimag: string) => {
    setState("busy");
    try {
      await addLight("game", aimag);
      setMsg(`${AIMAG_BY_ID[aimag]?.name} дээр таны гэрэл асав.`);
      setState("done");
    } catch (e) {
      setMsg((e as Error).message);
      setState("error");
    }
  };

  return (
    <section aria-labelledby="light-title" className="glass p-6 md:p-8">
      <div>
                <div className="min-w-0 flex-1">
          <h2 id="light-title" className="text-h2 leading-tight font-bold text-ink">
            Газрын зураг дээр гэрлээ асаагаарай
          </h2>
          <div className="mt-5">
            {state === "done" ? (
              <p role="status" className="text-body text-ink">
                {msg}{" "}
                <Link href="/about#map" className="link-accent font-semibold">
                  Газрын зураг дээр харах
                </Link>
              </p>
            ) : (
              <>
                <AimagPicker onPick={light} busy={state === "busy"} />
                {state === "error" && (
                  <p role="alert" className="mt-3 text-small text-false">
                    {msg}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
