"use client";

// 3D Монгол: одтой огторгуйд цэгээр бүтсэн газрын зураг. Гэрэл бүр = нэг хүний оруулсан хувь нэмэр.
// Нэг аймгийн гэрлүүд хоорондоо зураасаар холбогдож одны орд шиг харагдана (reference: tsaaguur.mn/network).
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { MONGOLIA_OUTLINE } from "@/data/mongolia-outline";
import { AIMAGS, AIMAG_BY_ID } from "@/data/aimags";
import { KIND_COLOR, type Light } from "@/lib/lights";


// Газарзүйн координатыг хавтгайд буулгана (Монголын төвд cos(lat) засвартай)
const LAT0 = 46.8;
const LON0 = 103.8;
const K = 0.2;
const COS = Math.cos((LAT0 * Math.PI) / 180);
export const project = (lon: number, lat: number): [number, number] => [(lon - LON0) * COS * K, (lat - LAT0) * K];

function inside(lon: number, lat: number, poly: [number, number][]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

// Зөөлөн гэрэлтэлтийн текстур
function useGlow() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.18, "rgba(255,255,255,0.85)");
    r.addColorStop(0.45, "rgba(255,255,255,0.22)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }, []);
}

function Stars() {
  const geo = useMemo(() => {
    const n = 700;
    const pos = new Float32Array(n * 3);
    let s = 11;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      // Газрын зургийн доор ба ард бөмбөрцөг хэлбэрээр тарсан одод
      const th = rnd() * Math.PI * 2;
      const ph = Math.acos(2 * rnd() - 1);
      const r = 9 + rnd() * 6;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) * 0.6 - 2;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) - 3;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial color="#9aa2ba" size={0.05} transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

// Улсын нутгийг дүүргэх цэгүүд
function LandDots() {
  const geo = useMemo(() => {
    const pts: number[] = [];
    const step = 0.42;
    for (let lon = 87.5; lon <= 120.2; lon += step / COS) {
      for (let lat = 41.5; lat <= 52.2; lat += step) {
        if (inside(lon, lat, MONGOLIA_OUTLINE)) {
          const [x, y] = project(lon, lat);
          pts.push(x, y, 0);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial color="#7d86a3" size={0.026} transparent opacity={0.75} sizeAttenuation />
    </points>
  );
}

function Outline() {
  const pts = useMemo(() => MONGOLIA_OUTLINE.map(([lon, lat]) => new THREE.Vector3(...project(lon, lat), 0)), []);
  return <Line points={pts} color="#6f86ff" lineWidth={1.5} transparent opacity={0.75} />;
}

// Нэг гэрэл: шинэ бол гялс гэж томроод тогтворжино
function LightSprite({ light, glow, pos }: { light: Light; glow: THREE.Texture; pos: [number, number, number] }) {
  const ref = useRef<THREE.Sprite>(null);
  const born = useMemo(() => performance.now() - Math.max(0, Date.now() - new Date(light.created_at).getTime()), [light.created_at]);
  const phase = useMemo(() => hash(light.id) * Math.PI * 2, [light.id]);
  useFrame(() => {
    if (!ref.current) return;
    const age = (performance.now() - born) / 1000;
    const flash = age < 2.2 ? Math.max(0, 1 - age / 2.2) : 0;
    const twinkle = 1 + Math.sin(performance.now() / 900 + phase) * 0.08;
    ref.current.scale.setScalar((0.2 + flash * 0.6) * twinkle);
    (ref.current.material as THREE.SpriteMaterial).opacity = 0.55 + flash * 0.45;
  });
  return (
    <sprite ref={ref} position={pos}>
      <spriteMaterial map={glow} color={KIND_COLOR[light.kind]} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  );
}

function Lights({ lights, glow }: { lights: Light[]; glow: THREE.Texture }) {
  // Гэрэл бүрийн байрлал: аймгийн төвөөс тогтвортой санамсаргүй зай
  const placed = useMemo(
    () =>
      lights
        .filter((l) => AIMAG_BY_ID[l.aimag])
        .map((l) => {
          const a = AIMAG_BY_ID[l.aimag];
          const [cx, cy] = project(a.lon, a.lat);
          const ang = hash(l.id + "a") * Math.PI * 2;
          const rad = 0.04 + Math.sqrt(hash(l.id + "r")) * 0.17;
          return { l, pos: [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, 0.06 + hash(l.id + "z") * 0.22] as [number, number, number] };
        }),
    [lights],
  );

  // Нэг аймгийн гэрлүүдийг дарааллаар нь холбоно
  const links = useMemo(() => {
    const by: Record<string, [number, number, number][]> = {};
    for (const p of [...placed].reverse()) (by[p.l.aimag] ??= []).push(p.pos);
    const segs: [number, number, number][][] = [];
    for (const arr of Object.values(by)) for (let i = 1; i < arr.length && i < 14; i++) segs.push([arr[i - 1], arr[i]]);
    return segs;
  }, [placed]);

  return (
    <>
      {links.map((s, i) => (
        <Line key={i} points={s} color="#6f86ff" lineWidth={0.8} transparent opacity={0.28} />
      ))}
      {placed.map((p) => (
        <LightSprite key={p.l.id} light={p.l} glow={glow} pos={p.pos} />
      ))}
    </>
  );
}

// Шошго: хамгийн олон гэрэлтэй аймгаас эхэлж, давхцахгүйгээр сонгоно
type LabelItem = { id: string; name: string; n: number; x: number; y: number };
function pickLabels(counts: Record<string, number>, narrow: boolean): LabelItem[] {
  const out: LabelItem[] = [];
  const minGap = narrow ? 0.8 : 0.55;
  const list = AIMAGS.filter((a) => counts[a.id]).sort((p, q) => counts[q.id] - counts[p.id]);
  for (const a of list) {
    const [x, y] = project(a.lon, a.lat);
    if (out.some((o) => Math.hypot(o.x - x, o.y - y) < minGap)) continue;
    out.push({ id: a.id, name: a.name, n: counts[a.id], x, y });
    if (out.length >= (narrow ? 4 : 9)) break;
  }
  return out;
}

// Канвасын дотроос шошгын DOM элементүүдийг дэлгэцийн байрлалд нь шилжүүлнэ
function LabelProjector({ items, refs }: { items: LabelItem[]; refs: React.RefObject<Record<string, HTMLSpanElement | null>> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const it of items) {
      const el = refs.current?.[it.id];
      if (!el) continue;
      // Газрын зураг -90° эргэсэн: (x, y, z) → (x, z, -y)
      v.set(it.x, 0.05, -(it.y - 0.2)).project(camera);
      const visible = v.z < 1;
      el.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`;
      el.style.opacity = visible ? "1" : "0";
    }
  });
  return null;
}

// Аймаг бүрийн гэрлийн "мананцар": олон гэрэлтэй газар илүү тод
function Halos({ counts, glow }: { counts: Record<string, number>; glow: THREE.Texture }) {
  return (
    <>
      {AIMAGS.filter((a) => counts[a.id]).map((a) => {
        const [x, y] = project(a.lon, a.lat);
        const s = 0.45 + Math.sqrt(counts[a.id]) * 0.16;
        return (
          <sprite key={a.id} position={[x, y, 0.02]} scale={[s, s, s]}>
            <spriteMaterial map={glow} color="#6f86ff" transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        );
      })}
    </>
  );
}

// Камерын зай: нарийн (утас) дэлгэцэд газрын зураг бүтэн багтахаар холдуулна
function FitCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const a = size.width / size.height;
    const d = a < 0.8 ? 9.5 : a < 1.3 ? 6.8 : 4.9;
    camera.position.set(0, d * 0.72, d * 0.7);
    camera.lookAt(0, 0, 0);
  }, [camera, size.width, size.height]);
  return null;
}

function Scene({ lights, counts }: { lights: Light[]; counts: Record<string, number> }) {
  const glow = useGlow();
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <LandDots />
      <Outline />
      <Halos counts={counts} glow={glow} />
      <Lights lights={lights} glow={glow} />
    </group>
  );
}

export default function MapScene({ lights, counts }: { lights: Light[]; counts: Record<string, number> }) {
  const wrap = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const on = () => setNarrow((wrap.current?.clientWidth ?? 1000) < 600);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const items = useMemo(() => pickLabels(counts, narrow), [counts, narrow]);

  return (
    <div ref={wrap} className="relative h-full w-full">
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 3.5, 3.4], fov: 42 }} gl={{ antialias: true, alpha: true }}>
      <Stars />
      <FitCamera />
      <LabelProjector items={items} refs={refs} />
      {/* Газрын зураг хэвтээ (XZ) хавтгайд хэвтэнэ, гэрлүүд дээш хөвнө */}
      <Scene lights={lights} counts={counts} />
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={2.5}
        maxDistance={12}
        minPolarAngle={0.25}
        maxPolarAngle={1.2}
        minAzimuthAngle={-0.7}
        maxAzimuthAngle={0.7}
        target={[0, 0, 0]}
      />
    </Canvas>
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {items.map((a) => (
          <span
            key={a.id}
            ref={(el) => {
              refs.current[a.id] = el;
            }}
            className="absolute top-0 left-0 rounded-md bg-[#111a36]/90 px-1.5 py-0.5 text-[12px] font-semibold whitespace-nowrap text-[#e9edf7] opacity-0 ring-1 ring-[#6b7596]/50"
          >
            {a.name} <span className="text-[#6f86ff] tnum">{a.n}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
