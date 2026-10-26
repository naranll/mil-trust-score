"use client";

// Тоглоомын цэгэн «хөрөг»: алгоритм таныг хэрхэн хардаг вэ. Цэг бүр = нэг пост.
// Толгой + мөрний дүрс. Цэг бүр санамсаргүй «эрэмбэ» (aRank)-тэй; ангиллын хуваарийн хуримтлагдсан
// утгаар (uCum) тухайн цэг аль ангиллын өнгөтэй байхыг shader тооцно: хуваарь өөрчлөгдөхөд хөрөг дахин будагдана.
// Төгсгөлд хөрөг ангилал бүрээр задарч (uSplit), шошго бүрийн дээр цэгэн багана болно (өндөр = пост тоо).
// Байрлалыг CPU дээр нэг удаа тооцно, frame бүрт зөвхөн uniform шинэчилнэ (нүүрний PointCapsule-тэй ижил арга).
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type PortraitDrive = {
  shares: number[]; // 6 ангиллын хувь (нийлбэр 1): тоглох үед алгоритмын загвар, төгсгөлд бодит feed
  known: number; // 0 саарал (алгоритм таныг мэдэхгүй) → 1 бүрэн будагдсан
  split: number; // 0 хөрөг → 1 ангилал бүрээр задарсан
  pulse: number; // үйлдэл хийх бүрт 1 болж, аажмаар унтарна
  pulseCat: number; // аль ангиллын пост дээр үйлдэл хийсэн бэ
  motion: number; // 0 = хөдөлгөөн багасгасан
  layout: { cx: number; cy: number; h: number; colW: number; slots: number[]; radii: number[] }; // px, canvas-ийн төвөөс, y дээшээ; radii = баганын өндөр
};

const vertex = /* glsl */ `
attribute vec3 aUnit;   // хөргийн гадаргуу (өндөр ~1)
attribute vec3 aSph;    // задрах үеийн баганын доторх байрлал (-1…1)
attribute float aRank;  // 0…1: аль ангиллын өнгө авахыг тодорхойлно
attribute float aRand;

uniform float uTime, uKnown, uSplit, uPulse, uPulseCat, uRotY, uH, uSize, uDpr, uMotion, uColW;
uniform vec3 uCenter;
uniform float uCum[6];
uniform vec3 uColors[6];
uniform vec3 uSlots[6];
uniform float uRadii[6]; // баганын өндөр (px)

varying vec3 vColor;
varying float vAlpha;

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
float ease(float t) { return t * t * (3.0 - 2.0 * t); }

void main() {
  int k = 5;
  for (int i = 0; i < 6; i++) { if (aRank < uCum[i]) { k = i; break; } }
  float kf = float(k);
  float emo = kf > 2.5 ? 1.0 : 0.0;          // уур хилэн, айдас, хожил: сэтгэл хөдлөлийн ангилал
  float hit = abs(kf - uPulseCat) < 0.5 ? 1.0 : 0.3;

  vec3 u = aUnit;
  // Сэтгэл хөдлөлийн цэгүүд чичирнэ: feed-д тэд давамгайлах тусам хөрөг тайван бус болно
  u += vec3(sin(uTime * 9.0 + aRand * 40.0), sin(uTime * 7.0 + aRand * 23.0), 0.0) * 0.007 * emo * uKnown * uMotion;
  // Үйлдэл: тухайн ангиллын цэгүүд гадагшаа үсэрнэ
  u += normalize(u + 1e-5) * uPulse * hit * 0.07 * uMotion;
  vec3 p = rotY(uRotY) * u * uH + uCenter;

  // Цэгэн багана: шошгоны дээрээс эхэлж дээш ургана
  vec3 s = uSlots[k] + vec3(aSph.x * uColW, (aSph.y * 0.5 + 0.5) * uRadii[k], aSph.z * uColW);
  float ts = ease(clamp(uSplit * 1.3 - aRand * 0.3, 0.0, 1.0));
  p = mix(p, s, ts);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  float depthRef = max(mix(uH * 0.25, uColW, ts), 1.0);
  float att = 1.0 + clamp((p.z - uCenter.z * (1.0 - ts)) / depthRef, -1.0, 1.0) * 0.3;
  gl_PointSize = uSize * uDpr * att * (1.0 + uPulse * hit * 0.5);

  vec3 grey = vec3(0.60, 0.65, 0.75);
  vColor = mix(grey, uColors[k], uKnown);
  vAlpha = (0.45 + aRand * 0.5) * (0.65 + 0.35 * att) + uPulse * hit * 0.2;
}
`;

const fragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.3, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, min(a, 1.0));
}
`;

// Гадаргуу дээрх цэг: ellipsoid-ийн чиглэл (y-ийн доод хязгаартай)
function onEllipsoid(c: number[], r: number[], minY: number) {
  for (;;) {
    const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    const l = v.length();
    if (l < 0.0001 || l > 1) continue;
    v.divideScalar(l);
    if (v.y < minY) continue;
    const j = 1 - Math.random() * 0.06; // бага зэрэг дотогш: гадаргуу «амьд» харагдана
    return [c[0] + v.x * r[0] * j, c[1] + v.y * r[1] * j, c[2] + v.z * r[2] * j];
  }
}

function buildGeometry(count: number) {
  const unit = new Float32Array(count * 3);
  const sph = new Float32Array(count * 3);
  const rank = new Float32Array(count);
  const rand = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const t = Math.random();
    let p: number[];
    if (t < 0.5) p = onEllipsoid([0, 0.2, 0], [0.19, 0.22, 0.19], -1); // толгой
    else if (t < 0.58) {
      const a = Math.random() * Math.PI * 2; // хүзүү
      p = [Math.cos(a) * 0.08, -0.06 - Math.random() * 0.1, Math.sin(a) * 0.08];
    } else p = onEllipsoid([0, -0.36, 0], [0.42, 0.24, 0.24], -0.15); // мөр, цээж
    unit.set(p, i * 3);
    sph.set([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1], i * 3);
    rank[i] = Math.random();
    rand[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(unit, 3));
  geo.setAttribute("aUnit", new THREE.BufferAttribute(unit, 3));
  geo.setAttribute("aSph", new THREE.BufferAttribute(sph, 3));
  geo.setAttribute("aRank", new THREE.BufferAttribute(rank, 1));
  geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
  return geo;
}

function hexToVec(h: string) {
  const n = parseInt(h.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function Cloud({ driveRef, count, colors }: { driveRef: RefObject<PortraitDrive>; count: number; colors: string[] }) {
  const gl = useThree((s) => s.gl);
  const geometry = useMemo(() => buildGeometry(count), [count]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uKnown: { value: 0 },
          uSplit: { value: 0 },
          uPulse: { value: 0 },
          uPulseCat: { value: -1 },
          uRotY: { value: 0 },
          uH: { value: 300 },
          uSize: { value: 2.6 },
          uDpr: { value: 1 },
          uMotion: { value: 1 },
          uColW: { value: 20 },
          uCenter: { value: new THREE.Vector3() },
          uCum: { value: [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1] },
          uColors: { value: colors.map(hexToVec) },
          uSlots: { value: Array.from({ length: 6 }, () => new THREE.Vector3()) },
          uRadii: { value: [0, 0, 0, 0, 0, 0] },
        },
      }),
    [colors],
  );
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);

  const points = useRef<THREE.Points>(null);
  const shares = useRef([1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6]);
  const rot = useRef(0);
  // Байрлалыг шууд биш, зөөлөн дагана: самбарын хэмжээ солигдох, багана ургахад үсрэлтгүй
  const sm = useRef<{ cx: number; cy: number; h: number; colW: number; slots: number[]; radii: number[] } | null>(null);
  const env = useRef(0); // pulse-ийн зөөлөн дугтуй: гэнэт үсрэхгүй, ~100мс-д өсөөд аажим унтарна

  useFrame((state, delta) => {
    if (!points.current) return;
    const u = (points.current.material as THREE.ShaderMaterial).uniforms;
    const d = driveRef.current;
    const L = d.layout;
    const k = Math.min(1, delta * 3);
    // Хувиарыг зөөлөн шилжүүлж, хуримтлагдсан утга болгоно
    const cum = u.uCum.value as number[];
    let acc = 0;
    for (let i = 0; i < 6; i++) {
      shares.current[i] += ((d.shares[i] ?? 0) - shares.current[i]) * k;
      acc += shares.current[i];
      cum[i] = acc;
    }
    for (let i = 0; i < 6; i++) cum[i] /= acc || 1;
    d.pulse *= Math.exp(-delta * 2.5);
    env.current += (d.pulse - env.current) * Math.min(1, delta * 10);
    rot.current += delta * 0.15 * d.motion;
    u.uTime.value = state.clock.elapsedTime;
    u.uKnown.value = d.known;
    u.uSplit.value = d.split;
    u.uPulse.value = env.current;
    u.uPulseCat.value = d.pulseCat;
    u.uRotY.value = rot.current;
    u.uMotion.value = d.motion;
    u.uDpr.value = gl.getPixelRatio();
    const m = (sm.current ??= { cx: L.cx, cy: L.cy, h: L.h, colW: L.colW, slots: [...L.slots], radii: [...L.radii] });
    const kl = d.motion ? Math.min(1, delta * 6) : 1;
    m.cx += (L.cx - m.cx) * kl;
    m.cy += (L.cy - m.cy) * kl;
    m.h += (L.h - m.h) * kl;
    m.colW += (L.colW - m.colW) * kl;
    u.uH.value = m.h;
    u.uColW.value = m.colW;
    (u.uCenter.value as THREE.Vector3).set(m.cx, m.cy, 0);
    const slots = u.uSlots.value as THREE.Vector3[];
    const radii = u.uRadii.value as number[];
    for (let i = 0; i < 6; i++) {
      for (const j of [i * 2, i * 2 + 1]) m.slots[j] = (m.slots[j] ?? 0) + ((L.slots[j] ?? 0) - (m.slots[j] ?? 0)) * kl;
      m.radii[i] = (m.radii[i] ?? 0) + ((L.radii[i] ?? 0) - (m.radii[i] ?? 0)) * kl * 0.6;
      slots[i].set(m.slots[i * 2], m.slots[i * 2 + 1], 0);
      radii[i] = m.radii[i];
    }
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}

export default function PortraitCloud({
  driveRef,
  count,
  colors,
  active,
}: {
  driveRef: RefObject<PortraitDrive>;
  count: number;
  colors: string[];
  active: boolean;
}) {
  return (
    // Ортографик камер, zoom 1: дэлхийн 1 нэгж = CSS-ийн 1px
    <Canvas
      orthographic
      camera={{ zoom: 1, position: [0, 0, 1000], near: 0.1, far: 5000 }}
      dpr={[1, 1.5]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: false, alpha: true }}
      aria-hidden
      style={{ pointerEvents: "none" }}
    >
      <Cloud driveRef={driveRef} count={count} colors={colors} />
    </Canvas>
  );
}
