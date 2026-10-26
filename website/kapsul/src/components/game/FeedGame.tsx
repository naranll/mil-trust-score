"use client";

// Feed тоглоом: 2-р давхарга (тархалт) + 4-р давхарга (таамаглал ба бодит байдал).
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, Repeat2, SkipForward, RotateCcw } from "lucide-react";
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
      <div className="mx-auto w-full max-w-[26rem] rounded-2xl bg-inverse p-3 shadow-2">
        <div className="rounded-2xl bg-surface px-4 pt-4 pb-5">
          <div className="flex items-center justify-between px-1 pb-3 text-sm">
            <span className="font-display font-semibold text-ink">Feed</span>
            <span className="tnum text-ink-2" aria-live="polite">
              {round} / {ROUNDS}
            </span>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-subtle" aria-hidden>
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(round / ROUNDS) * 100}%` }} />
          </div>

          <article key={current.post.id} className="animate-[postIn_.45s_var(--ease-out-expo)] rounded-2xl bg-surface p-5 ring-1 ring-line/20">
            <header className="flex items-center gap-3">
              <span aria-hidden className="size-10 shrink-0 rounded-full" style={{ background: CATEGORIES[current.post.category].color }} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{current.post.author}</p>
                <p className="text-xs text-ink-2">Зохиомол хуудас</p>
              </div>
            </header>
            <p className="mt-4 min-h-[6.5rem] text-[1.05rem] leading-relaxed text-ink">{current.post.text}</p>
            <p className="mt-3 text-xs text-ink-2 tnum">{current.post.reactions.toLocaleString("mn-MN")} хариу үйлдэл</p>
          </article>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <GameButton onClick={() => onAction("like")} icon={<Heart className="size-4" />} label="Like" />
            <GameButton onClick={() => onAction("share")} icon={<Repeat2 className="size-4" />} label="Хуваалцах" />
            <GameButton onClick={() => onAction("skip")} icon={<SkipForward className="size-4" />} label="Алгасах" quiet />
          </div>
          <p className="mt-3 text-center text-xs text-ink-2 tnum" aria-hidden>
            Харж буй хугацаа: {dwellLive.toFixed(1)} сек
          </p>
        </div>
      </div>

      {/* Алгоритмын тэмдэглэл */}
      <section aria-labelledby="algo-title" className="md:pt-4">
        <h2 id="algo-title" className="font-display text-2xl font-bold text-ink">
          Алгоритм чамайг ажиглаж байна
        </h2>
        <p className="mt-2 max-w-md leading-relaxed text-ink-2">
          Чиний like, хуваалцалт, бүр <strong className="text-ink">удаан харсан хугацаа</strong> хүртэл сонирхол болж
          тэмдэглэгдэнэ. Тэр дээр нь платформ өөрөө сэтгэл хөдлөл өдөөдөг постыг илүү түлхэнэ.
        </p>

        <Weights weights={state.weights} />

        <div className="mt-6 rounded-2xl bg-accent-tint p-5">
          <p className="text-sm font-semibold text-ink">Энэ пост яагаад чамд хүрсэн бэ</p>
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
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-3 text-sm font-semibold transition-colors active:scale-[0.97] ${
        quiet ? "bg-subtle text-ink hover:bg-subtle" : "bg-inverse text-on-inverse hover:bg-accent-strong"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// Сонирхлын жинг эм хэлбэрийн баганаар
function Weights({ weights }: { weights: Record<Category, number> }) {
  const max = Math.max(...Object.values(weights), 2.5);
  return (
    <ul className="mt-6 space-y-2.5" aria-label="Алгоритмын сурсан сонирхол">
      {CATS.map((c) => {
        const score = weights[c] * CATEGORIES[c].bait;
        return (
          <li key={c} className="grid grid-cols-[7.5rem_1fr] items-center gap-3 text-sm">
            <span className="font-medium text-ink">{CATEGORIES[c].label}</span>
            <span className="relative h-5 overflow-hidden rounded-full bg-subtle">
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-[var(--ease-out-expo)]"
                style={{ width: `${Math.min((score / (max * 1.85)) * 100, 100)}%`, background: CATEGORIES[c].color }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Intro({ guess, setGuess, onStart }: { guess: number; setGuess: (n: number) => void; onStart: () => void }) {
  return (
    <div className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-center">
      <div>
        <h1 className="font-display text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.98] font-bold tracking-[-0.025em] text-ink">
          Чиний feed хэрхэн бүтдэг вэ?
        </h1>
        <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink">
          {ROUNDS} пост гүйлгэнэ. Таалагдвал like дар, хуваалц, эсвэл алгас. Төгсгөлд нь алгоритм чамайг хэрхэн
          харсныг, пост бүр яагаад чамд хүрснийг харуулна.
        </p>
        <p className="mt-4 flex items-center gap-2 text-sm text-ink-2">
          <SyntheticTag>Постууд зохиомол</SyntheticTag> Бодит хүн, хуудас биш.
        </p>
      </div>

      <div className="rounded-2xl bg-accent-tint p-7 md:p-9">
        <label htmlFor="guess" className="font-display block text-lg leading-snug font-semibold text-ink">
          Эхлээд таамаглаарай: таны feed-ийн хэдэн хувь нь уур, айдас, “хожил” гэх мэт сэтгэл хөдлөл өдөөдөг пост байх
          вэ?
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
            className="h-3 w-full cursor-pointer appearance-none rounded-full bg-surface accent-[var(--accent)]"
          />
          <output htmlFor="guess" className="font-display w-20 text-right text-3xl font-bold text-ink tnum">
            {guess}%
          </output>
        </div>
        <button
          type="button"
          onClick={onStart}
          className="mt-8 w-full rounded-full bg-accent px-7 py-4 text-lg font-semibold text-ink transition-colors hover:bg-accent-deep hover:text-on-inverse"
        >
          Гүйлгэж эхлэх
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
      <h1 className="font-display max-w-3xl text-[clamp(2.2rem,5.4vw,4rem)] leading-[1.02] font-bold tracking-[-0.025em] text-ink">
        Таны feed-ийн {s.actual}% нь сэтгэл хөдлөл өдөөдөг пост байлаа.
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink">
        Та {guess}% гэж таамагласан.{" "}
        {Math.abs(diff) <= 10
          ? "Маш ойрхон байна. Та өөрийн feed-ээ сайн мэддэг юм байна."
          : diff > 0
            ? `Бодит байдал ${diff} пунктээр өндөр гарлаа. Ихэнх хүн өөрийн feed-ийг бодитоос нь тайван гэж боддог.`
            : `Бодит байдал ${-diff} пунктээр бага гарлаа. Та энэ удаад сэтгэл хөдлөлийн постыг сайн алгассан байна.`}
      </p>

      {/* Feed-ийн найрлага: нэг эм */}
      <figure className="mt-10">
        <div
          className="flex h-16 overflow-hidden rounded-full md:h-20"
          role="img"
          aria-label={CATS.filter((c) => s.counts[c]).map((c) => `${CATEGORIES[c].label} ${s.counts[c]}`).join(", ")}
        >
          {CATS.filter((c) => s.counts[c] > 0).map((c) => (
            <div key={c} style={{ flex: s.counts[c], background: CATEGORIES[c].color }} />
          ))}
        </div>
        <figcaption className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {CATS.filter((c) => s.counts[c] > 0).map((c) => (
            <span key={c} className="inline-flex items-center gap-2 text-ink">
              <span aria-hidden className="size-3 rounded-full ring-1 ring-line/30" style={{ background: CATEGORIES[c].color }} />
              {CATEGORIES[c].label} <span className="tnum text-ink-2">{s.counts[c]}</span>
            </span>
          ))}
        </figcaption>
      </figure>

      {s.push > 0 && (
        <p className="mt-8 max-w-2xl rounded-2xl bg-inverse px-7 py-5 text-lg leading-relaxed text-on-inverse">
          Хэрэв алгоритм зөвхөн таны сонирхлыг харсан бол энэ хувь ойролцоогоор {s.interestOnly}% байх байсан. Үлдсэн{" "}
          <strong className="text-accent">{s.push} пунктийг</strong> платформ өөрөө нэмсэн, учир нь ийм пост илүү их
          сэтгэгдэл, хуваалцалт авчирдаг.
        </p>
      )}

      <div className="mt-12">
        <LightPrompt />
      </div>

      <section aria-labelledby="forensics" className="mt-14">
        <h2 id="forensics" className="font-display text-2xl font-bold text-ink">
          Пост бүр яагаад танд хүрсэн бэ
        </h2>
        <ol className="mt-5 space-y-2">
          {state.feed.map((f, i) => (
            <li key={f.post.id} className="grid gap-1 rounded-2xl bg-subtle px-5 py-3.5 md:grid-cols-[2rem_12rem_1fr] md:items-baseline md:gap-4">
              <span className="text-sm text-ink-2 tnum">{i + 1}</span>
              <span className="inline-flex items-center gap-2 font-semibold text-ink">
                <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: CATEGORIES[f.post.category].color }} />
                {f.post.author}
              </span>
              <span className="text-ink-2">
                {f.reason}{" "}
                {f.post.signals.length > 0 && (
                  <span className="text-ink">Дохио: {f.post.signals.join(", ")}.</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="habits" className="mt-14 grid gap-8 md:grid-cols-[1fr_1.3fr]">
        <h2 id="habits" className="font-display text-2xl font-bold text-ink">
          Дараагийн удаа гүйлгэхдээ
        </h2>
        <ul className="space-y-4 text-lg leading-relaxed text-ink">
          <li>Уурлуулсан пост дээр 3 секунд зогсож, «Үүнийг хэн, юуны төлөө бичсэн бэ?» гэж асуу.</li>
          <li>Удаан харах нь өөрөө like юм. Хүсэхгүй байгаа контент дээрээ бүү саат.</li>
          <li>Хуваалцахаасаа өмнө эх сурвалжийг нь нэг удаа хай. Ингэвэл тархалтын гинж тасарна.</li>
        </ul>
      </section>

      <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button"
          onClick={onReplay}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-4 text-lg font-semibold text-ink hover:bg-accent-deep hover:text-on-inverse"
        >
          <RotateCcw className="size-5" aria-hidden /> Дахин тоглох
        </button>
        <ShareButton title="Чиний feed яагаад ийм харагддаг вэ? 2 минутын тоглоом" path="/game" quiet />
        <Link href="/extension" className="font-semibold text-ink link-accent">
          Extension бодит Facebook дээр яаж тусалдаг вэ
        </Link>
      </div>
    </div>
  );
}
