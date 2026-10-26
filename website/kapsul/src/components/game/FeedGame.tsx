"use client";

// Feed тоглоом: 2-р давхарга (тархалт) + 4-р давхарга (таамаглал ба бодит байдал).
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChartColumn, Copy, Eye, Heart, Hourglass, Repeat2, RotateCcw, Search, SkipForward } from "lucide-react";
import { CATEGORIES, type Category } from "@/data/posts";
import { act, initState, summarize, ROUNDS, type Action, type GameState } from "./engine";
import { SyntheticTag } from "@/components/ui/Pill";
import { LightPrompt } from "@/components/map/LightPrompt";
import { ShareButton } from "@/components/map/ShareButton";

type Phase = "intro" | "play" | "reveal";
const CATS = Object.keys(CATEGORIES) as Category[];

export function FeedGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [guess, setGuess] = useState(30);
  const [state, setState] = useState<GameState>(() => initState());
  const [seed, setSeed] = useState(1);
  const shownAt = useRef(0);
  const [dwellLive, setDwellLive] = useState(0);

  // Пост харагдсан хугацааг хэмжинэ
  const current = state.feed[state.feed.length - 1];
  useEffect(() => {
    shownAt.current = performance.now();
  }, [current?.post.id, phase]);

  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => setDwellLive(Math.max(0, (performance.now() - shownAt.current) / 1000)), 200);
    return () => clearInterval(id);
  }, [phase]);

  const start = () => {
    setSeed(Math.floor(Math.random() * 100000));
    setState(initState());
    setPhase("play");
  };

  const onAction = (a: Action) => {
    const dwell = performance.now() - shownAt.current;
    const next = act(state, a, dwell, seed);
    setState(next);
    if (next.feed.length >= ROUNDS && next.feed[next.feed.length - 1].action) setPhase("reveal");
  };

  if (phase === "intro") return <Intro guess={guess} setGuess={setGuess} onStart={start} />;
  if (phase === "reveal") return <Reveal state={state} guess={guess} onReplay={() => setPhase("intro")} />;

  const round = state.feed.length;

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,26rem)_1fr] md:items-start md:gap-14">
      {/* Утасны дэлгэц */}
      <div className="mx-auto w-full max-w-[26rem] rounded-[2rem] bg-subtle p-2.5 shadow-1">
        <div className="rounded-[1.6rem] bg-bg px-4 pt-4 pb-5">
          <div className="flex items-center justify-between px-1 pb-3 text-sm">
            <span className="font-semibold text-ink">Feed</span>
            <span className="tnum text-ink-2" aria-live="polite">
              {round} / {ROUNDS}
            </span>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-subtle" aria-hidden>
            <div className="h-full rounded-full bg-accent transition-[width] duration-[var(--dur-slow)]" style={{ width: `${(round / ROUNDS) * 100}%` }} />
          </div>

          <article key={current.post.id} className="animate-[postIn_.4s_var(--ease-out-expo)] rounded-2xl bg-surface p-5 shadow-1">
            <header className="flex items-center gap-3">
              <span aria-hidden className="size-10 shrink-0 rounded-full" style={{ background: CATEGORIES[current.post.category].color }} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{current.post.author}</p>
                <p className="text-[12.8px] text-ink-2">Зохиомол хуудас</p>
              </div>
            </header>
            <p className="mt-4 min-h-[6.5rem] text-[1.05rem] leading-relaxed text-ink">{current.post.text}</p>
            <p className="mt-3 text-[12.8px] text-ink-2 tnum">{current.post.reactions.toLocaleString("mn-MN")} хариу үйлдэл</p>
          </article>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <GameButton onClick={() => onAction("like")} icon={<Heart className="size-4" />} label="Like" />
            <GameButton onClick={() => onAction("share")} icon={<Repeat2 className="size-4" />} label="Хуваалцах" />
            <GameButton onClick={() => onAction("skip")} icon={<SkipForward className="size-4" />} label="Алгасах" quiet />
          </div>
          <p className="mt-3 text-center text-[12.8px] text-ink-3 tnum" aria-hidden>
            {dwellLive.toFixed(1)} сек
          </p>
        </div>
      </div>

      {/* Алгоритмын тэмдэглэл */}
      <section aria-labelledby="algo-title" className="md:pt-4">
        <h2 id="algo-title" className="text-[25px] font-bold text-ink">
          Алгоритм таныг ажиглаж байна
        </h2>
        <p className="mt-1 text-ink-2">Like, хуваалцах, удаан харах бүр жин нэмнэ.</p>

        <Weights weights={state.weights} />

        <div className="glass mt-6 p-5">
          <p className="text-sm font-semibold text-ink-2">Энэ пост яагаад танд хүрсэн бэ</p>
          <p className="mt-1 leading-relaxed text-ink" aria-live="polite">
            {current.reason}
          </p>
        </div>

        {state.log.length > 0 && (
          <ul className="mt-5 space-y-1.5 text-sm text-ink-2" aria-label="Сүүлийн үйлдлүүд">
            {state.log.slice(0, 3).map((l, i) => (
              <li key={state.log.length - i} className={i === 0 ? "text-ink" : ""}>
                {l}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function GameButton({ onClick, icon, label, quiet }: { onClick: () => void; icon: React.ReactNode; label: string; quiet?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`btn px-3 ${quiet ? "bg-subtle text-ink-2 hover:text-ink" : "btn-secondary"}`}>
      {icon}
      {label}
    </button>
  );
}

// Сонирхлын жин: хэвтээ багана
function Weights({ weights }: { weights: Record<Category, number> }) {
  const max = Math.max(...Object.values(weights), 2.5);
  return (
    <ul className="mt-6 space-y-2.5" aria-label="Алгоритмын сурсан сонирхол">
      {CATS.map((c) => {
        const score = weights[c] * CATEGORIES[c].bait;
        return (
          <li key={c} className="grid grid-cols-[7.5rem_1fr] items-center gap-3 text-[15px]">
            <span className="font-medium text-ink">{CATEGORIES[c].label}</span>
            <span className="relative h-5 overflow-hidden rounded-full bg-subtle">
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-[var(--dur-slow)] ease-[var(--ease-out-expo)]"
                style={{ width: `${Math.min((score / (max * 1.85)) * 100, 100)}%`, background: CATEGORIES[c].color }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function IconDot({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent">
      {children}
    </span>
  );
}

function Intro({ guess, setGuess, onStart }: { guess: number; setGuess: (n: number) => void; onStart: () => void }) {
  const steps = [
    { icon: <Copy className="size-5" />, text: `${ROUNDS} пост гарна` },
    { icon: <Heart className="size-5" />, text: "Бодит амьдрал дээрх шигээ хандаарай" },
    { icon: <ChartColumn className="size-5" />, text: "Алгоритм таныг хэрхэн «тодорхойлсныг» харна" },
  ];
  return (
    <div className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-center">
      <div>
        <h1 className="text-[clamp(2.4rem,6vw,4.25rem)] leading-[1.02] font-bold tracking-[-0.025em] text-ink">
          Таны feed хэрхэн бүтдэг вэ?
        </h1>
        <ol className="mt-8 space-y-3">
          {steps.map((st) => (
            <li key={st.text} className="flex items-center gap-4 text-lg text-ink">
              <IconDot>{st.icon}</IconDot>
              {st.text}
            </li>
          ))}
        </ol>
        <p className="mt-6">
          <SyntheticTag>Постууд зохиомол</SyntheticTag>
        </p>
      </div>

      <div className="glass p-7 md:p-9">
        <label htmlFor="guess" className="block text-[20px] leading-snug font-semibold text-ink">
          Таны feed-ийн хэдэн хувь нь сэтгэл хөдлөлд тулгуурласан пост вэ?
        </label>
        <div className="mt-6 flex items-center gap-5">
          <input
            id="guess"
            type="range"
            min={0}
            max={100}
            step={5}
            value={guess}
            onChange={(e) => setGuess(Number(e.target.value))}
            className="h-3 w-full cursor-pointer appearance-none rounded-full bg-subtle accent-[var(--accent)]"
          />
          <output htmlFor="guess" className="w-20 text-right text-[31.25px] font-bold text-ink tnum">
            {guess}%
          </output>
        </div>
        <button type="button" onClick={onStart} className="btn btn-primary mt-8 w-full text-base">
          Эхлэх
        </button>
      </div>
    </div>
  );
}

function Reveal({ state, guess, onReplay }: { state: GameState; guess: number; onReplay: () => void }) {
  const s = useMemo(() => summarize(state), [state]);
  const diff = s.actual - guess;
  return (
    <div>
      <h1 className="max-w-3xl text-[clamp(2.2rem,5.4vw,3.9rem)] leading-[1.04] font-bold tracking-[-0.025em] text-ink">
        Таны feed-ийн {s.actual}% нь сэтгэл хөдлөлд тулгуурласан пост байлаа
      </h1>

      {/* Таамаглал ба бодит байдал */}
      <figure className="mt-8 max-w-2xl space-y-2.5">
        {(
          [
            ["Таны таамаглал", guess, "bg-cat-5"],
            ["Бодит", s.actual, "bg-cat-1"],
          ] as const
        ).map(([l, v, c]) => (
          <div key={l} className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-3 text-[15px]">
            <span className="text-ink-2">{l}</span>
            <span className="h-6 overflow-hidden rounded-full bg-subtle">
              <span className={`grow block h-full rounded-full ${c}`} style={{ width: `${v}%` }} />
            </span>
            <span className="text-right text-lg font-bold text-ink tnum">{v}%</span>
          </div>
        ))}
        <figcaption className="pt-1 text-ink-2">
          {Math.abs(diff) <= 10
            ? "Маш ойрхон таамаглажээ."
            : diff > 0
              ? `Бодит байдал ${diff} пунктээр өндөр гарлаа.`
              : `Бодит байдал ${-diff} пунктээр бага гарлаа.`}
        </figcaption>
      </figure>

      {/* Feed-ийн найрлага */}
      <figure className="mt-12">
        <div
          className="flex h-14 overflow-hidden rounded-full md:h-16"
          role="img"
          aria-label={CATS.filter((c) => s.counts[c]).map((c) => `${CATEGORIES[c].label} ${s.counts[c]}`).join(", ")}
        >
          {CATS.filter((c) => s.counts[c] > 0).map((c) => (
            <div key={c} className="border-r-2 border-surface last:border-r-0" style={{ flex: s.counts[c], background: CATEGORIES[c].color }} />
          ))}
        </div>
        <figcaption className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[15px]">
          {CATS.filter((c) => s.counts[c] > 0).map((c) => (
            <span key={c} className="inline-flex items-center gap-2 text-ink">
              <span aria-hidden className="size-3 rounded-full ring-1 ring-line/30" style={{ background: CATEGORIES[c].color }} />
              {CATEGORIES[c].label} <span className="tnum text-ink-2">{s.counts[c]}</span>
            </span>
          ))}
        </figcaption>
      </figure>

      {s.push > 0 && (
        <p className="mt-8 max-w-2xl rounded-2xl bg-accent-tint px-6 py-4 text-lg text-ink">
          Үүний <strong className="tnum">{s.push} пунктийг</strong> таны сонирхол биш, платформ өөрөө нэмсэн.
        </p>
      )}

      <div className="mt-12">
        <LightPrompt />
      </div>

      <section aria-labelledby="forensics" className="mt-14">
        <h2 id="forensics" className="text-[25px] font-bold text-ink">
          Пост бүр яагаад танд хүрсэн бэ
        </h2>
        <ol className="mt-5 space-y-2">
          {state.feed.map((f, i) => (
            <li key={f.post.id} className="grid gap-1 rounded-2xl bg-surface px-5 py-3.5 shadow-1 md:grid-cols-[2rem_12rem_1fr] md:items-baseline md:gap-4">
              <span className="text-sm text-ink-3 tnum">{i + 1}</span>
              <span className="inline-flex items-center gap-2 font-semibold text-ink">
                <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: CATEGORIES[f.post.category].color }} />
                {f.post.author}
              </span>
              <span className="text-ink-2">
                {f.reason}
                {f.post.signals.length > 0 && <span className="text-ink"> Дохио: {f.post.signals.join(", ")}.</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="habits" className="mt-14">
        <h2 id="habits" className="text-[25px] font-bold text-ink">
          Дараагийн удаа
        </h2>
        <ul className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            { icon: <Hourglass className="size-5" />, t: "Уурлуулсан пост дээр 3 секунд зогсоорой" },
            { icon: <Eye className="size-5" />, t: "Удаан харах нь өөрөө like" },
            { icon: <Search className="size-5" />, t: "Хуваалцахаасаа өмнө эх сурвалжийг шалгаарай" },
          ].map((h) => (
            <li key={h.t} className="glass flex items-center gap-4 p-5 text-lg text-ink">
              <IconDot>{h.icon}</IconDot>
              {h.t}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button type="button" onClick={onReplay} className="btn btn-primary">
          <RotateCcw className="size-4" aria-hidden /> Дахин тоглох
        </button>
        <ShareButton title="Таны feed яагаад ийм харагддаг вэ? 2 минутын тоглоом" path="/game" quiet />
        <Link href="/about#map" className="btn-quiet inline-flex items-center">
          Газрын зураг үзэх
        </Link>
      </div>
    </div>
  );
}
