// Feed алгоритмын энгийн загвар. Бодит Facebook-ийн код биш, харин зарчмыг харуулах симуляц:
// 1) Чиний үйлдлээс сонирхлыг тань сурна (like, share, удаан харах).
// 2) Платформ өөрөө ч их харилцаа (engagement) авчирдаг постыг илүүд үзнэ (bait).
// Дараагийн пост = сонирхол × bait гэсэн оноогоор сонгогдоно.
import { CATEGORIES, POSTS, type Category, type Post } from "@/data/posts";

export const ROUNDS = 12;
export type Action = "like" | "share" | "skip";

export type Delivered = {
  post: Post;
  action?: Action;
  dwellMs?: number;
  reason: string; // яагаад энэ пост чамд хүрсэн бэ
};

export type GameState = {
  weights: Record<Category, number>;
  feed: Delivered[];
  log: string[];
};

const CATS = Object.keys(CATEGORIES) as Category[];
const STARTERS = ["n1", "h1", "o1"]; // эхний 3 пост: холимог

export function initState(): GameState {
  const weights = Object.fromEntries(CATS.map((c) => [c, 1])) as Record<Category, number>;
  const first = POSTS.find((p) => p.id === STARTERS[0])!;
  return { weights, feed: [{ post: first, reason: "Эхлэл: алгоритм чамайг одоохондоо мэдэхгүй байна." }], log: [] };
}

// Үйлдлээс сонирхлын жин хэр өөрчлөгдөх вэ
export function delta(action: Action, dwellMs: number) {
  const dwell = Math.min(dwellMs / 2500, 1.6) * 0.7; // удаан харсан ч гэсэн дохио
  if (action === "share") return 2.0 + dwell;
  if (action === "like") return 1.2 + dwell;
  return -0.35 + dwell * 0.5; // алгассан ч гэсэн харсан хугацаа тоологдоно
}

function mulberry(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function act(state: GameState, action: Action, dwellMs: number, seed: number): GameState {
  const current = state.feed[state.feed.length - 1];
  const cat = current.post.category;
  const d = delta(action, dwellMs);
  const weights = { ...state.weights, [cat]: Math.max(0.2, state.weights[cat] + d) };
  const verb = action === "share" ? "хуваалцлаа" : action === "like" ? "like дарлаа" : "алгаслаа";
  const line = `«${CATEGORIES[cat].label}» постыг ${(dwellMs / 1000).toFixed(1)} сек харж, ${verb}. Жин ${d >= 0 ? "+" : ""}${d.toFixed(1)}`;

  const feed = state.feed.slice(0, -1).concat({ ...current, action, dwellMs });

  if (feed.length >= ROUNDS) return { weights, feed, log: [line, ...state.log] };

  // Дараагийн постыг сонгоно
  const seen = new Set(feed.map((f) => f.post.id));
  let next: Post | undefined;
  let reason = "";
  if (feed.length < STARTERS.length) {
    next = POSTS.find((p) => p.id === STARTERS[feed.length]);
    reason = "Эхлэл: алгоритм өөр өөр төрлийн пост туршиж байна.";
  } else {
    const rnd = mulberry(seed + feed.length * 97);
    const pool = POSTS.filter((p) => !seen.has(p.id));
    const scored = pool.map((p) => {
      const s = weights[p.category] * CATEGORIES[p.category].bait;
      return { p, s: Math.pow(s, 2.6) };
    });
    const total = scored.reduce((a, b) => a + b.s, 0);
    let r = rnd() * total;
    next = scored[scored.length - 1].p;
    for (const x of scored) {
      r -= x.s;
      if (r <= 0) {
        next = x.p;
        break;
      }
    }
    reason = explain(next, weights, feed);
  }

  return { weights, feed: next ? feed.concat({ post: next, reason }) : feed, log: [line, ...state.log] };
}

// "Яагаад чамд хүрсэн бэ": тархалтын тайлбар
function explain(p: Post, weights: Record<Category, number>, feed: Delivered[]) {
  const c = CATEGORIES[p.category];
  const engaged = feed.filter((f) => f.post.category === p.category && f.action && f.action !== "skip").length;
  const parts: string[] = [];
  if (weights[p.category] > 1.6 && engaged > 0)
    parts.push(`Чи «${c.label}» төрлийн пост дээр ${engaged} удаа хариу үйлдэл хийсэн`);
  else if (weights[p.category] > 1.3) parts.push(`Чи «${c.label}» төрлийн постыг удаан харсан`);
  if (c.bait >= 1.5) parts.push("энэ төрөл сэтгэгдэл, хуваалцалт их цуглуулдаг тул платформ урагшлуулсан");
  if (parts.length === 0) return "Алгоритм шинэ сэдэв туршиж байна.";
  const s = parts.join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

// Үр дүнгийн тооцоо
export function summarize(state: GameState) {
  const n = state.feed.length;
  const counts = Object.fromEntries(CATS.map((c) => [c, 0])) as Record<Category, number>;
  for (const f of state.feed) counts[f.post.category]++;
  const emotionalShown = state.feed.filter((f) => CATEGORIES[f.post.category].emotional).length;
  const actual = Math.round((emotionalShown / n) * 100);

  // Харьцуулалт: платформ bait ашиглаагүй, зөвхөн чиний сонирхлыг харсан бол
  const interestOnly = (() => {
    let emo = 0;
    let tot = 0;
    for (const p of POSTS) {
      const s = Math.pow(state.weights[p.category], 2.6);
      tot += s;
      if (CATEGORIES[p.category].emotional) emo += s;
    }
    return Math.round((emo / tot) * 100);
  })();

  // Хамгийн их шагнагдсан төрөл
  const top = (Object.entries(state.weights) as [Category, number][]).sort((a, b) => b[1] - a[1])[0][0];

  return { counts, actual, interestOnly, push: actual - interestOnly, top, n };
}
