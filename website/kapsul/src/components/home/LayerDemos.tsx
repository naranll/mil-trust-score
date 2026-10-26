"use client";

// Давхарга бүрийн жижиг тоглоом. Уншихын оронд хүрч, хараад ойлгоно.
import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

// Товчны класс globals.css-д (Design system v3)
const primary = "btn btn-primary";
const quiet = "btn btn-secondary";
const panel = "rounded-2xl bg-bg p-5 ring-1 ring-line/20";

/* ---------- 1. Мэдэгдэл: дохиог өөрөө ол ---------- */
const POST: { t: string; sig?: string }[] = [
  { t: "ЭНЭ Ч ДЭЭ!!!", sig: "Том үсэг, олон анхаарлын тэмдэг нь бодохоос өмнө уурлуулдаг." },
  { t: " " },
  { t: "Тэд", sig: "«Тэд» гэж хэн бэ? Нэргүй дайсан нь шалгах боломжгүй." },
  { t: " дахиад л биднийг тоосонгүй. " },
  { t: "Хуваалцаж бүгдэд мэдэгдээрэй", sig: "Хуваалцахыг шахах нь постыг хурдан тараах арга." },
  { t: ", чимээгүй байж болохгүй!" },
];

export function ClaimDemo() {
  const [found, setFound] = useState<number[]>([]);
  const total = POST.filter((p) => p.sig).length;
  const done = found.length === total;
  return (
    <div>
      <p className="text-[15px] text-ink-2">Сэжигтэй 3 үгийг олоорой.</p>
      <div className={`mt-4 ${panel} text-lg leading-relaxed text-ink`}>
        {POST.map((p, i) =>
          p.sig ? (
            <button
              key={i}
              type="button"
              onClick={() => setFound((f) => (f.includes(i) ? f : [...f, i]))}
              aria-pressed={found.includes(i)}
              className={`rounded-md px-0.5 underline decoration-dotted decoration-2 underline-offset-4 transition-colors ${
                found.includes(i) ? "bg-highlight/80 decoration-transparent" : "decoration-line/60 hover:bg-subtle"
              }`}
            >
              {p.t}
            </button>
          ) : (
            <span key={i}>{p.t}</span>
          ),
        )}
      </div>
      <ul className="mt-4 space-y-2" aria-live="polite">
        {found.map((i) => (
          <li key={i} className="flex gap-2.5 rounded-xl bg-false-tint px-4 py-2.5 text-[15px] text-ink">
            <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full bg-false" />
            {POST[i].sig}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[15px] text-ink-2">
        <span className="font-semibold text-ink tnum">
          {found.length}/{total}
        </span>{" "}
        {done ? (
          <>
            олсон. Хуваалцахаасаа өмнө ийм дохиог хайгаарай.
          </>
        ) : (
          "дохио олсон"
        )}
      </p>
    </div>
  );
}

/* ---------- 2. Тархалт: нэг дарахад хэдэн хүнд хүрэх вэ ---------- */
type Node = { id: number; g: number; x: number; y: number; px: number; py: number };

function buildTree(branch: (i: number) => number) {
  const nodes: Node[] = [{ id: 0, g: 0, x: 0, y: 0, px: 0, py: 0 }];
  let prev = [{ ...nodes[0], a: 0, span: Math.PI * 2 }];
  let id = 1;
  for (let g = 1; g <= 4; g++) {
    const next: (Node & { a: number; span: number })[] = [];
    prev.forEach((p, pi) => {
      const k = branch(pi + g);
      for (let c = 0; c < k; c++) {
        const span = p.span / Math.max(k, 1);
        const a = p.a - p.span / 2 + span * (c + 0.5);
        const r = g * 34;
        const n = { id: id++, g, x: Math.cos(a) * r, y: Math.sin(a) * r, px: p.x, py: p.y, a, span };
        next.push(n);
        nodes.push(n);
      }
    });
    prev = next;
  }
  return nodes;
}

export function SpreadDemo() {
  const [mode, setMode] = useState<"calm" | "angry">("angry");
  const [gen, setGen] = useState(0);
  // Тайван пост: хүн бүр дунджаар ~1 хүнд, уурлуулсан пост: ~2.5 хүнд хуваалцана (энгийн загвар)
  const tree = useMemo(
    () => (mode === "calm" ? buildTree((i) => (i % 3 === 0 ? 2 : i % 3 === 1 ? 1 : 0) + (i < 2 ? 1 : 0)) : buildTree((i) => (i % 2 ? 3 : 2))),
    [mode],
  );
  const shown = tree.filter((n) => n.g <= gen);
  return (
    <div>
      <div className="seg" role="radiogroup" aria-label="Постын төрөл">
        {(
          [
            ["calm", "Тайван мэдээ"],
            ["angry", "Уурлуулсан пост"],
          ] as const
        ).map(([m, l]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => {
              setMode(m);
              setGen(0);
            }}
          >
            {l}
          </button>
        ))}
      </div>

      <svg viewBox="-150 -150 300 300" className="mx-auto mt-3 aspect-square w-full max-w-[19rem]" role="img" aria-label={`${shown.length} хүнд хүрсэн`}>
        {shown.slice(1).map((n) => (
          <line key={`l${n.id}`} x1={n.px} y1={n.py} x2={n.x} y2={n.y} stroke="var(--border-control)" strokeOpacity={0.45} strokeWidth={1} />
        ))}
        {shown.map((n) => (
          <circle
            key={n.id}
            cx={n.x}
            cy={n.y}
            r={n.g === 0 ? 9 : 5}
            fill={n.g === 0 ? "var(--accent)" : mode === "angry" ? "var(--false)" : "var(--chart-cat-3)"}
            style={{ transformBox: "fill-box", transformOrigin: "center", animation: "popIn .45s var(--ease-out-expo) both" }}
          />
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" className={primary} disabled={gen >= 4} onClick={() => setGen((g) => Math.min(g + 1, 4))}>
          {gen === 0 ? "Хуваалцах" : gen < 4 ? "Цааш тарах" : "Дууслаа"}
        </button>
        {gen > 0 && (
          <button type="button" className={quiet} onClick={() => setGen(0)}>
            <RotateCcw className="size-4" aria-hidden /> Дахин
          </button>
        )}
        <p className="text-[15px] text-ink-2" aria-live="polite">
          <span className="text-[25px] font-bold text-ink tnum">{shown.length - 1}</span> хүнд хүрлээ
        </p>
      </div>
      <p className="mt-3 text-[12.8px] text-ink-3">Зарчмыг харуулах энгийн загвар</p>
    </div>
  );
}

/* ---------- 3. Үйлдвэрлэл: зарын ард юу байна ---------- */
const CHAIN = ["Хэт сайхан зар", "Хуурамч линк", "Нууц код", "Данс хоосорно"];

export function ProductionDemo({ loss, sourceUrl }: { loss: number; sourceUrl: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div>
      <p className="text-[15px] text-ink-2">Гаднаа бэлэг. Ард нь хэн нэгний бизнес.</p>
      <div className="mt-4 [perspective:1200px]">
        <div
          className="relative min-h-[15rem] transition-transform duration-700 ease-[var(--ease-out-expo)] [transform-style:preserve-3d]"
          style={{ transform: flipped ? "rotateY(180deg)" : "none" }}
        >
          {/* Нүүр тал */}
          <div className="absolute inset-0 flex flex-col justify-between rounded-2xl bg-bg p-5 ring-1 ring-line/20 [backface-visibility:hidden]">
            <div>
              <p className="text-[12.8px] font-semibold text-ink-3">Мега Сугалаа MN, ивээн тэтгэсэн</p>
              <p className="mt-2 text-[25px] leading-tight font-bold text-ink">Баяр хүргэе! Та iPhone хожлоо.</p>
              <p className="mt-2 text-ink-2">Хүлээн авахын тулд линкээр орж нэг удаагийн кодоо оруулна уу.</p>
            </div>
            <button type="button" className={`${primary} self-start`} onClick={() => setFlipped(true)} aria-expanded={flipped}>
              Ард нь юу байгааг харах
            </button>
          </div>
          {/* Ар тал */}
          <div
            className="absolute inset-0 flex flex-col justify-between rounded-2xl bg-inverse p-5 text-on-inverse [backface-visibility:hidden]"
            style={{ transform: "rotateY(180deg)" }}
            aria-hidden={!flipped}
          >
            <ol className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
              {CHAIN.map((c, i) => (
                <li key={c} className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1.5 ${i === CHAIN.length - 1 ? "bg-false text-[#1b1d21]" : "bg-on-inverse/15"}`}>{c}</span>
                  {i < CHAIN.length - 1 && (
                    <svg aria-hidden viewBox="0 0 20 10" className="h-2.5 w-5 text-on-inverse-2">
                      <path d="M1 5h16M13 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  )}
                </li>
              ))}
            </ol>
            <p className="text-[15px] text-on-inverse-2">
              2025 онд Монголд залилангаас <span className="text-[25px] font-bold text-on-inverse tnum">{loss} тэрбум ₮</span>{" "}
              хохирол учирсан.{" "}
              <a href={sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                ЦЕГ
              </a>
            </p>
            <button type="button" className="btn self-start text-on-inverse ring-[1.5px] ring-inset ring-on-inverse/60 hover:bg-on-inverse/10" onClick={() => setFlipped(false)}>
              Буцааж эргүүлэх
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 4. Танин мэдэхүй: 3 секундын сорил ---------- */
export function CognitionDemo() {
  const [phase, setPhase] = useState<"idle" | "run" | "share" | "check" | "late">("idle");
  const [ms, setMs] = useState(0);
  const t0 = useRef(0);

  useEffect(() => {
    if (phase !== "run") return;
    t0.current = performance.now();
    const id = setTimeout(() => setPhase("late"), 3000);
    return () => clearTimeout(id);
  }, [phase]);

  const answer = (a: "share" | "check") => {
    setMs(performance.now() - t0.current);
    setPhase(a);
  };

  return (
    <div>
      <p className="text-[15px] text-ink-2">Гарчиг 3 секунд харагдана. Юу хийх вэ?</p>
      <div className={`mt-4 min-h-[13rem] ${panel}`}>
        {phase === "idle" && (
          <button type="button" className={primary} onClick={() => setPhase("run")}>
            Эхлэх
          </button>
        )}
        {phase === "run" && (
          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-subtle" aria-hidden>
              <div className="h-full origin-left rounded-full bg-mislead" style={{ animation: "drain 3s linear forwards" }} />
            </div>
            <p className="mt-4 text-[20px] leading-snug font-bold text-ink">
              АНХААР: Маргааш шөнө хүчтэй газар хөдлөлт болно гэж эрдэмтэд анхааруулав!!!
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className={primary} onClick={() => answer("share")}>
                Хуваалцах
              </button>
              <button type="button" className={quiet} onClick={() => answer("check")}>
                Эхлээд шалгах
              </button>
            </div>
          </div>
        )}
        {phase !== "idle" && phase !== "run" && (
          <div aria-live="polite">
            <p className="text-[20px] leading-snug font-bold text-ink">
              {phase === "share" && `${(ms / 1000).toFixed(1)} секундэд хуваалцлаа.`}
              {phase === "check" && `${(ms / 1000).toFixed(1)} секундэд зогсож чадлаа.`}
              {phase === "late" && "Цаг дууслаа."}
            </p>
            <p className="mt-2 max-w-md text-ink-2">
              {phase === "share" && "Хурдан шийдвэрийг айдас гаргадаг. Газар хөдлөлтийг хэн ч урьдчилан таамаглаж чаддаггүй."}
              {phase === "check" && "«Ямар эрдэмтэд, хаана хэлсэн бэ?» гэдэг ганц асуулт хангалттай."}
              {phase === "late" && "Шийдэхгүй өнгөрөх нь ч бас сонголт."}
            </p>
            <button type="button" className={`${quiet} mt-4`} onClick={() => setPhase("idle")}>
              <RotateCcw className="size-4" aria-hidden /> Дахин
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
