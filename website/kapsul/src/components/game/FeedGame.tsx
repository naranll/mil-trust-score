"use client";

// Feed тоглоом: 2-р давхарга (тархалт) + 4-р давхарга (таамаглал ба бодит байдал).
// Баруун талын самбар: цэгэн «хөрөг» = алгоритм таныг хэрхэн харж байна вэ. Эхлээд саарал (таныг мэдэхгүй),
// тоглох тусам ангиллын өнгөөр будагдаж, төгсгөлд таны feed-ийн найрлагаар задарна (PortraitCloud).
// Постыг чирч (swipe) эсвэл товчоор хариулна. WebGL байхгүй үед хөргийн оронд баганан график.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ChartColumn, Copy, Eye, Heart, Hourglass, Repeat2, RotateCcw, Search, SkipForward } from "lucide-react";
import { CATEGORIES, type Category, type Post } from "@/data/posts";
import { act, initState, summarize, ROUNDS, type Action, type GameState } from "./engine";
import type { PortraitDrive } from "./PortraitCloud";
import { SyntheticTag } from "@/components/ui/Pill";
import { LightPrompt } from "@/components/map/LightPrompt";
import { ShareButton } from "@/components/map/ShareButton";
import { H1 } from "@/components/ui/PageTitle";
import { useReducedMotion, useWebGL } from "@/lib/render-mode";

const PortraitCloud = dynamic(() => import("./PortraitCloud"), { ssr: false });

type Phase = "intro" | "play" | "reveal";
const CATS = Object.keys(CATEGORIES) as Category[];
const COLORS = CATS.map((c) => CATEGORIES[c].color);

// Алгоритмын сонголтын магадлал (engine.ts-тэй ижил томьёо): сонирхол × платформын «bait», ^2.6
function algoShares(weights: Record<Category, number>) {
  const s = CATS.map((c) => Math.pow(weights[c] * CATEGORIES[c].bait, 2.6));
  const t = s.reduce((a, b) => a + b, 0);
  return s.map((x) => x / t);
}

export function FeedGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [guess, setGuess] = useState(30);
  const [state, setState] = useState<GameState>(() => initState());
  const [seed, setSeed] = useState(1);
  const shownAt = useRef(0);
  const reduced = useReducedMotion();
  const driveRef = useRef<PortraitDrive>({
    shares: [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6],
    known: 0,
    split: 0,
    pulse: 0,
    pulseCat: -1,
    motion: 1,
    layout: { cx: 0, cy: 0, h: 200, colW: 20, slots: Array(12).fill(0), radii: Array(6).fill(0) },
  });

  // Пост харагдсан хугацааг хэмжинэ
  const current = state.feed[state.feed.length - 1];
  useEffect(() => {
    shownAt.current = performance.now();
  }, [current?.post.id, phase]);


  const summary = useMemo(() => summarize(state), [state]);
  const shares = useMemo(
    () => (phase === "reveal" ? CATS.map((c) => summary.counts[c] / summary.n) : algoShares(state.weights)),
    [phase, state.weights, summary],
  );

  // Хөрөгт өгөх утгууд: үе шат бүрт
  useEffect(() => {
    const d = driveRef.current;
    d.motion = reduced ? 0 : 1;
    d.shares = shares;
    const known = phase === "intro" ? 0 : phase === "reveal" ? 1 : Math.min(1, 0.3 + state.feed.length * 0.15);
    const split = phase === "reveal" ? 1 : 0;
    if (reduced) Object.assign(d, { known, split });
    else gsap.to(d, { known, split, duration: phase === "reveal" ? 1.6 : 0.8, ease: "power2.inOut", overwrite: true });
  }, [phase, shares, state.feed.length, reduced]);

  const start = () => {
    setSeed(Math.floor(Math.random() * 100000));
    setState(initState());
    setPhase("play");
  };

  const onAction = (a: Action) => {
    const dwell = performance.now() - shownAt.current;
    const d = driveRef.current;
    d.pulse = 1;
    d.pulseCat = CATS.indexOf(current.post.category);
    const next = act(state, a, dwell, seed);
    setState(next);
    if (next.feed.length >= ROUNDS && next.feed[next.feed.length - 1].action) setPhase("reveal");
  };

  const panel = <Panel phase={phase} shares={shares} summary={summary} reason={current?.reason} driveRef={driveRef} />;

  if (phase === "intro")
    return (
      <Layout panel={panel} phase={phase}>
        <Intro guess={guess} setGuess={setGuess} onStart={start} />
      </Layout>
    );
  if (phase === "reveal")
    return (
      <Layout panel={panel} phase={phase}>
        <Reveal state={state} summary={summary} guess={guess} onReplay={() => setPhase("intro")} />
      </Layout>
    );

  const round = state.feed.length;
  return (
    <Layout panel={panel} phase={phase}>
      {/* Утасны дэлгэц */}
      <div className="mx-auto w-full max-w-[26rem] rounded-[2rem] bg-subtle p-1.5 shadow-1 md:p-2.5">
        <div className="rounded-[1.6rem] bg-bg px-3 pt-3 pb-3 md:px-4 md:pt-4 md:pb-5">
          <div className="flex items-center justify-between px-1 pb-3 text-small">
            <span className="font-semibold text-ink">Feed</span>
            <span className="tnum text-ink-2" aria-live="polite">
              {round} / {ROUNDS}
            </span>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-subtle" aria-hidden>
            <div className="h-full rounded-full bg-accent transition-[width] duration-[var(--dur-slow)]" style={{ width: `${(round / ROUNDS) * 100}%` }} />
          </div>

          <SwipeCard key={current.post.id} post={current.post} onAction={onAction} reduced={reduced} last={round >= ROUNDS} />

          <p className="mt-3 text-center text-caption text-ink-3" aria-hidden>
            Баруун тийш чирвэл Like, зүүн тийш Алгасах, дээш Хуваалцах · <DwellTimer since={shownAt} />
          </p>
        </div>
      </div>
    </Layout>
  );
}

// Хоёр багана, нэг дэлгэцэнд багтана: зүүн талд үе шатны агуулга (дотроо гүйлгэгдэнэ), баруун талд хөрөгтэй самбар.
// Утсан дээр самбар дээр нь (дэлгэцийн ~30%), доор нь агуулга: пост ба хөрөг нэг дэлгэцэнд.
function Layout({ children, panel, phase }: { children: React.ReactNode; panel: React.ReactNode; phase: Phase }) {
  const play = phase === "play";
  // Үе шат солигдоход агуулга дээд талаасаа эхэлнэ (тоглох үеийн гүйлгэлт үлдэхгүй)
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [phase]);
  return (
    <div
      className={`grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 md:grid-rows-1 md:gap-10 lg:gap-14 ${
        play ? "md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]" : "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      }`}
    >
      <div ref={scroller} className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-width:thin] md:pr-2">
        {children}
      </div>
      <aside className="order-first min-h-0 md:order-none">{panel}</aside>
    </div>
  );
}

// Пост дээр зарцуулсан хугацаа: зөвхөн энэ жижиг хэсэг өөрийгөө шинэчилнэ (бүх тоглоом секундэд 5 удаа дахин зурагдахгүй)
function DwellTimer({ since }: { since: React.RefObject<number> }) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSec(Math.max(0, (performance.now() - since.current) / 1000)), 200);
    return () => clearInterval(id);
  }, [since]);
  return <span className="tnum">{sec.toFixed(1)} сек</span>;
}

// --- Swipe карт -----------------------------------------------------------------
const FLY: Record<Action, string> = {
  like: "translate(140%, -8%) rotate(16deg)",
  skip: "translate(-140%, -8%) rotate(-16deg)",
  share: "translate(0, -150%) rotate(-3deg)",
};

function SwipeCard({ post, onAction, reduced, last }: { post: Post; onAction: (a: Action) => void; reduced: boolean; last: boolean }) {
  // Чирэлтийг React state-ээр биш, DOM-ийг шууд (кадр бүрт нэг удаа) шинэчилнэ: хуруу дагаж жигд хөдөлнө
  const card = useRef<HTMLElement>(null);
  const stamp = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ x0: number; y0: number; x: number; y: number; t: number; vx: number; vy: number } | null>(null);
  const raf = useRef(0);
  const done = useRef(false);

  const paint = (x: number, y: number) => {
    const el = card.current;
    if (!el) return;
    el.style.transform = `translate3d(${x}px, ${Math.min(y, 0) * 0.6}px, 0) rotate(${x * 0.05}deg)`;
    const up = -y > Math.abs(x);
    const st = stamp.current;
    if (st) {
      st.textContent = up ? "Хуваалцах" : x > 0 ? "Like" : "Алгасах";
      st.style.opacity = String(Math.min(1, Math.max(0, (Math.max(Math.abs(x), -y) - 12) / 78)));
    }
  };

  const settle = (transform: string, opacity = "1", ms = 320) => {
    const el = card.current;
    if (!el) return;
    el.style.transition = reduced ? "none" : `transform ${ms}ms var(--ease-out-expo), opacity ${ms}ms ease`;
    el.style.transform = transform;
    el.style.opacity = opacity;
    if (stamp.current && opacity === "1") stamp.current.style.opacity = "0";
  };

  const commit = (a: Action) => {
    if (done.current) return;
    done.current = true;
    settle(FLY[a], "0", 340);
    // Карт нисэж дууссаны дараа дараагийн пост гарна
    setTimeout(() => onAction(a), reduced ? 0 : 300);
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <div className="relative">
      {/* Ард нь дараагийн пост хүлээж байгаа мэт: feed-ийн гүн */}
      {!last && <div aria-hidden className="absolute inset-x-3 top-3 bottom-[-0.5rem] rounded-2xl bg-surface/50" />}
      {/* Шинэ пост ард байгаа картын байрнаас урагш гарч ирнэ (animation нь гаднах div дээр: чирэлтэд саад болохгүй) */}
      <div className="motion-safe:animate-[cardIn_.42s_var(--ease-out-expo)]">
        <article
          ref={card}
          onPointerDown={(e) => {
            if (done.current) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            e.currentTarget.style.transition = "none";
            drag.current = { x0: e.clientX, y0: e.clientY, x: 0, y: 0, t: e.timeStamp, vx: 0, vy: 0 };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const x = e.clientX - d.x0, y = e.clientY - d.y0, dt = Math.max(1, e.timeStamp - d.t);
            // Хурдыг зөөлрүүлж хадгална (шидэх хөдөлгөөнийг танихад)
            d.vx = d.vx * 0.6 + ((x - d.x) / dt) * 0.4;
            d.vy = d.vy * 0.6 + ((y - d.y) / dt) * 0.4;
            d.x = x;
            d.y = y;
            d.t = e.timeStamp;
            cancelAnimationFrame(raf.current);
            raf.current = requestAnimationFrame(() => paint(x, y));
          }}
          onPointerUp={() => {
            const d = drag.current;
            drag.current = null;
            if (!d) return;
            const { x, y, vx, vy } = d;
            // Зай (90px) эсвэл хурдан шидэлт (0.5px/мс, 30px-ээс дээш)
            const flickX = Math.abs(vx) > 0.5 && Math.abs(x) > 30;
            const flickUp = vy < -0.5 && -y > 30;
            if ((-y > 90 || flickUp) && -y > Math.abs(x)) commit("share");
            else if (x > 90 || (flickX && vx > 0)) commit("like");
            else if (x < -90 || (flickX && vx < 0)) commit("skip");
            else settle("translate3d(0,0,0)");
          }}
          onPointerCancel={() => {
            drag.current = null;
            settle("translate3d(0,0,0)");
          }}
          style={{ touchAction: "none" }}
          className="relative cursor-grab touch-none rounded-2xl bg-surface p-4 shadow-1 will-change-transform select-none active:cursor-grabbing md:p-5"
        >
          <header className="flex items-center gap-3">
            <span aria-hidden className="size-10 shrink-0 rounded-full" style={{ background: CATEGORIES[post.category].color }} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{post.author}</p>
              <p className="text-caption text-ink-2">Зохиомол хуудас</p>
            </div>
          </header>
          <p className="mt-3 min-h-[4.5rem] text-small leading-relaxed text-ink md:mt-4 md:min-h-[6.5rem] md:text-body">{post.text}</p>
          <p className="mt-3 text-caption text-ink-2 tnum">{post.reactions.toLocaleString("mn-MN")} хариу үйлдэл</p>
          {/* Чирэх чиглэлийн тэмдэг (Like / Алгасах / Хуваалцах) */}
          <span
            ref={stamp}
            aria-hidden
            className="pointer-events-none absolute top-4 right-4 rounded-full border-2 border-accent px-3 py-1 text-small font-semibold text-accent opacity-0"
          />
        </article>
      </div>

      <div className="relative mt-3 grid grid-cols-3 gap-2 md:mt-4">
        <GameButton onClick={() => commit("like")} icon={<Heart className="size-4" />} label="Like" />
        <GameButton onClick={() => commit("share")} icon={<Repeat2 className="size-4" />} label="Хуваалцах" />
        <GameButton onClick={() => commit("skip")} icon={<SkipForward className="size-4" />} label="Алгасах" quiet />
      </div>
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

// --- Хөрөгтэй самбар ---------------------------------------------------------------
function Panel({
  phase,
  shares,
  summary,
  reason,
  driveRef,
}: {
  phase: Phase;
  shares: number[];
  summary: ReturnType<typeof summarize>;
  reason?: string;
  driveRef: React.RefObject<PortraitDrive>;
}) {
  const webgl = useWebGL();
  const box = useRef<HTMLDivElement>(null);
  const mid = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);

  // Хөрөг ба 6 цэгэн баганын байрлал (px, самбарын төвөөс, y дээшээ). Багана бүр шошгоныхоо дээрээс ургана.
  useEffect(() => {
    if (!webgl || !box.current) return;
    const measure = () => {
      if (!box.current || !mid.current) return;
      const b = box.current.getBoundingClientRect();
      const m = mid.current.getBoundingClientRect();
      const bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const L = driveRef.current.layout;
      L.h = Math.min(m.height * 0.92, m.width * 1.1);
      L.cx = m.left + m.width / 2 - bx;
      L.cy = by - (m.top + m.height / 2);
      const items = box.current.querySelectorAll<HTMLElement>("[data-cat]");
      const maxShare = Math.max(...driveRef.current.shares, 0.01);
      items.forEach((el) => {
        const i = Number(el.dataset.cat);
        const r = el.getBoundingClientRect();
        L.colW = Math.min(r.width * 0.28, 28);
        // Хамгийн их ангилал самбарын дунд хэсгийн 85%-ийг эзэлнэ
        L.radii[i] = ((driveRef.current.shares[i] ?? 0) / maxShare) * (r.top - m.top) * 0.85;
        L.slots[i * 2] = r.left + r.width / 2 - bx;
        L.slots[i * 2 + 1] = by - (r.top - 10);
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box.current);
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting));
    io.observe(box.current);
    addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      io.disconnect();
      removeEventListener("scroll", measure);
    };
  }, [webgl, driveRef, phase, shares]);

  const title =
    phase === "intro" ? "Алгоритм таныг одоохондоо мэдэхгүй" : phase === "play" ? "Алгоритм таныг ингэж харж байна" : "Таны feed-ийн найрлага";
  const note =
    phase === "intro"
      ? "Тоглох тусам энэ хөрөг таны үйлдлээр будагдана."
      : phase === "play"
        ? reason
        : `${summary.n} постын ${summary.actual}% нь сэтгэл хөдлөлд тулгуурласан.`;

  return (
    <div
      ref={box}
      className="relative flex h-[30svh] min-h-[13rem] flex-col overflow-hidden rounded-[2rem] bg-surface/60 shadow-1 md:h-full"
    >
      {webgl && (
        <div aria-hidden className="absolute inset-0">
          <PortraitCloud driveRef={driveRef} count={typeof window !== "undefined" && innerWidth < 768 ? 700 : 1400} colors={COLORS} active={active} />
        </div>
      )}

      <div className="relative px-4 pt-3 md:p-7" aria-live="polite">
        <h2 className="text-lead leading-tight font-semibold text-ink md:text-h2">{title}</h2>
        {note && <p className="mt-0.5 line-clamp-2 max-w-md text-caption leading-snug text-ink-2 md:mt-1 md:line-clamp-none md:text-body">{note}</p>}
      </div>

      <div ref={mid} className="relative min-h-0 flex-1">
        {webgl === false && (phase === "reveal" ? <Composition summary={summary} /> : <Weights shares={shares} />)}
      </div>

      {/* Ангиллын шошго: тоглох үед алгоритмын хувь, төгсгөлд бодит пост тоо. Бөмбөлөг нь эдгээрийн дээр. */}
      <ul className="relative grid grid-cols-6 gap-x-1 px-2 pb-2.5 md:gap-x-2 md:px-6 md:pb-6" aria-label="Ангилал">
        {CATS.map((c, i) => (
          <li key={c} data-cat={i} className="flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-1 text-caption whitespace-nowrap text-ink-2 md:gap-1.5">
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: CATEGORIES[c].color }} />
              {/* Утсан дээр нэр нь багтахгүй: өнгөт цэг + тоо, нэрийг дэлгэц уншигч уншина */}
              <span className="sr-only md:not-sr-only">{CATEGORIES[c].label}</span>
            </span>
            <span className="text-caption font-semibold text-ink tnum md:text-small">
              {phase === "intro" ? "?" : phase === "reveal" ? summary.counts[c] : `${Math.round(shares[i] * 100)}%`}
              {phase === "reveal" && <span className="hidden md:inline"> пост</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// WebGL байхгүй үеийн нөөц: алгоритмын хувь (хэвтээ багана)
function Weights({ shares }: { shares: number[] }) {
  const max = Math.max(...shares, 0.2);
  return (
    <ul className="space-y-2.5 px-5 md:px-7" aria-hidden>
      {CATS.map((c, i) => (
        <li key={c} className="h-4 overflow-hidden rounded-full bg-subtle">
          <span
            className="block h-full rounded-full transition-[width] duration-[var(--dur-slow)] ease-[var(--ease-out-expo)]"
            style={{ width: `${(shares[i] / max) * 100}%`, background: CATEGORIES[c].color }}
          />
        </li>
      ))}
    </ul>
  );
}

// WebGL байхгүй үеийн нөөц: feed-ийн найрлага (нэг мөр)
function Composition({ summary }: { summary: ReturnType<typeof summarize> }) {
  return (
    <div className="flex h-14 overflow-hidden rounded-full mx-5 md:mx-7" aria-hidden>
      {CATS.filter((c) => summary.counts[c] > 0).map((c) => (
        <div key={c} className="border-r-2 border-surface last:border-r-0" style={{ flex: summary.counts[c], background: CATEGORIES[c].color }} />
      ))}
    </div>
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
    <div className="flex flex-col gap-10">
      <div>
        <h1 className={H1}>Таны feed хэрхэн бүтдэг вэ?</h1>
        <ol className="mt-8 space-y-3">
          {steps.map((st) => (
            <li key={st.text} className="flex items-center gap-4 text-lead text-ink">
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
        <label htmlFor="guess" className="block text-h3 leading-snug font-semibold text-ink">
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
          <output htmlFor="guess" className="w-20 text-right text-h2 font-bold text-ink tnum">
            {guess}%
          </output>
        </div>
        <button type="button" onClick={onStart} className="btn btn-primary mt-8 w-full text-body">
          Эхлэх
        </button>
      </div>
    </div>
  );
}

function Reveal({
  state,
  summary: s,
  guess,
  onReplay,
}: {
  state: GameState;
  summary: ReturnType<typeof summarize>;
  guess: number;
  onReplay: () => void;
}) {
  const diff = s.actual - guess;
  return (
    <div>
      <h1 className="max-w-3xl text-h1 leading-[1.04] font-bold tracking-tight text-ink">
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
          <div key={l} className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-3 text-small">
            <span className="text-ink-2">{l}</span>
            <span className="h-6 overflow-hidden rounded-full bg-subtle">
              <span className={`grow block h-full rounded-full ${c}`} style={{ width: `${v}%` }} />
            </span>
            <span className="text-right text-lead font-bold text-ink tnum">{v}%</span>
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

      {s.push > 0 && (
        <p className="mt-8 max-w-2xl rounded-2xl bg-accent-tint px-6 py-4 text-lead text-ink">
          Үүний <strong className="tnum">{s.push} пунктийг</strong> таны сонирхол биш, платформ өөрөө нэмсэн.
        </p>
      )}

      <div className="mt-12">
        <LightPrompt />
      </div>

      <section aria-labelledby="forensics" className="mt-14">
        <h2 id="forensics" className="text-h2 font-bold text-ink">
          Пост бүр яагаад танд хүрсэн бэ
        </h2>
        <ol className="mt-5 space-y-2">
          {state.feed.map((f, i) => (
            <li key={f.post.id} className="grid gap-1 rounded-2xl bg-surface px-5 py-3.5 shadow-1 md:grid-cols-[2rem_12rem_1fr] md:items-baseline md:gap-4">
              <span className="text-small text-ink-3 tnum">{i + 1}</span>
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

      <section aria-labelledby="next-time" className="mt-14">
        <h2 id="next-time" className="text-h2 font-bold text-ink">
          Дараагийн удаа
        </h2>
        <ul className="mt-5 grid gap-3 lg:grid-cols-3">
          {[
            { icon: <Hourglass className="size-5" />, t: "Уурлуулсан пост дээр 3 секунд зогсоорой" },
            { icon: <Eye className="size-5" />, t: "Удаан харах нь өөрөө like" },
            { icon: <Search className="size-5" />, t: "Хуваалцахаасаа өмнө эх сурвалжийг шалгаарай" },
          ].map((h) => (
            <li key={h.t} className="glass flex items-center gap-4 p-5 text-lead text-ink">
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
