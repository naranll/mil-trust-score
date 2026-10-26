"use client";

// Блогийн онцлох самбар: давхаргын цэгэн дүрс (DotGlyph-ийн том, амьд хувилбар, WebGL).
// Мэдэгдэл = амьсгалах бөөгнөрөл; Тархалт = төвөөс гадагш долгиолох цагирагууд; Үйлдвэрлэл = эгнээгээр гүйх сканнер;
// Танин мэдэхүй = эргэлдэх спираль. `layer` солигдоход цэгүүд шинэ дүрс, өнгө рүү урсаж хувирна.
// Байрлалыг CPU дээр нэг удаа тооцно, frame бүрт зөвхөн uniform шинэчилнэ (PointCapsule-тэй ижил арга).
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import * as THREE from "three";
import "@/lib/three-console";
import { LAYERS } from "@/data/layers";

const R = 150; // дүрсийн радиус (px, самбарын богино талд багтаана)

const vertex = /* glsl */ `
attribute vec3 aS0; // мэдэгдэл
attribute vec3 aS1; // тархалт
attribute vec3 aS2; // үйлдвэрлэл
attribute vec3 aS3; // танин мэдэхүй
attribute float aRand;

uniform float uTime, uMix, uScale, uLift, uSize, uDpr, uMotion, uFrom, uTo;
uniform vec3 uColFrom, uColTo;

varying vec3 vColor;
varying float vAlpha;

float easeInOut(float t) { return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0; }

// Дүрс бүрийн байрлал + өөрийн хөдөлгөөн; w = гэрэлтэлт
vec3 shape(float k, out float w) {
  float t = uTime * uMotion;
  w = 0.0;
  if (k < 0.5) {
    vec3 p = aS0;
    float r = length(p.xy) / ${R}.0;
    p.xy *= 1.0 + sin(t * 1.4 - r * 3.0) * 0.04;          // амьсгална
    w = (1.0 - r) * 0.6;
    return p;
  } else if (k < 1.5) {
    vec3 p = aS1;
    float r = length(p.xy);
    float wave = sin(t * 2.2 - r * 0.045);                  // төвөөс гадагш долгион
    p.xy *= 1.0 + wave * 0.035;
    w = smoothstep(0.6, 1.0, wave);
    return p;
  } else if (k < 2.5) {
    vec3 p = aS2;
    float scan = fract(t * 0.22) * 2.0 * ${R}.0 - ${R}.0; // дээрээс доош гүйх мөр
    w = smoothstep(26.0, 0.0, abs(-p.y - scan));
    return p;
  }
  vec3 p = aS3;
  float a = t * 0.25, c = cos(a), s = sin(a);                // спираль эргэлдэнэ
  p.xy = mat2(c, -s, s, c) * p.xy;
  w = smoothstep(0.85, 1.0, sin(length(p.xy) * 0.06 - t * 1.6));
  return p;
}

void main() {
  float w0, w1;
  vec3 a = shape(uFrom, w0);
  vec3 b = shape(uTo, w1);
  // Цэг бүр өөрийн хоцрогдолтой урсана; замын дунд бага зэрэг тарна
  float m = easeInOut(clamp(uMix * 1.35 - aRand * 0.35, 0.0, 1.0));
  vec3 p = mix(a, b, m);
  p.xy += vec2(sin(aRand * 40.0), cos(aRand * 27.0)) * sin(m * 3.14159) * 22.0;
  float w = mix(w0, w1, m);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(p * uScale + vec3(0.0, uLift, 0.0), 1.0);
  gl_PointSize = uSize * uDpr * (0.8 + aRand * 0.5) * (1.0 + w * 0.9);
  // Бараан дэвсгэр дээр харагдахаар давхаргын өнгийг бага зэрэг цайруулна (#0072B2 гэх мэт бараан өнгө)
  vColor = mix(mix(uColFrom, uColTo, m), vec3(1.0), 0.28 + w * 0.4);
  vAlpha = 0.6 + aRand * 0.4;
}
`;

const fragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (smoothstep(1.0, 0.35, d) * 0.6 + exp(-d * d * 4.0) * 0.4) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

const ORDER = LAYERS.map((l) => l.id); // claim, distribution, production, cognition

function buildGeometry(n: number) {
  let s = 23;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 2;
  const s0 = new Float32Array(n * 3), s1 = new Float32Array(n * 3), s2 = new Float32Array(n * 3), s3 = new Float32Array(n * 3);
  const rand = new Float32Array(n);
  const rings = [0, 34, 64, 94, 124, 150];
  const weight = (r: number) => Math.max(18, r); // дотор цагирагууд ч тод харагдахаар
  const ringTotal = rings.reduce((t, r) => t + weight(r), 0);
  const grid = 11;
  for (let i = 0; i < n; i++) {
    const z = (rnd() - 0.5) * 30;
    // 0: нягт бөөгнөрөл (төв рүү нягт)
    const a0 = rnd() * Math.PI * 2, r0 = Math.pow(rnd(), 0.75) * R * 0.95;
    s0.set([Math.cos(a0) * r0 + gauss() * 4, Math.sin(a0) * r0 * 0.86 + gauss() * 4, z], i * 3);
    // 1: цагирагууд (урт цагирагт олон цэг)
    let pick = rnd() * ringTotal, ri = 0;
    while (ri < rings.length - 1 && pick > weight(rings[ri])) pick -= weight(rings[ri++]);
    const a1 = rnd() * Math.PI * 2, r1 = rings[ri] + gauss() * (ri === 0 ? 7 : 2.5);
    s1.set([Math.cos(a1) * r1, Math.sin(a1) * r1, z], i * 3);
    // 2: эгнээ (ижил цэгүүд), нүд бүрт хэд хэдэн цэг
    const G = R * 0.78, cx = i % grid, cy = Math.floor(i / grid) % grid, step = (G * 2) / (grid - 1); // дөрвөлжин тор тойргоос том харагдах тул бага
    s2.set([-G + cx * step + gauss() * 2.2, G - cy * step + gauss() * 2.2, z * 0.3], i * 3);
    // 3: спираль (5 эргэлт), төвд нүдний хүүхэн хараа
    const t = rnd(), ang = t * Math.PI * 2 * 4.5, rr = t < 0.06 ? rnd() * 14 : 18 + t * (R - 18);
    s3.set([Math.cos(ang) * rr + gauss() * 4, Math.sin(ang) * rr * 0.9 + gauss() * 4, z], i * 3);
    rand[i] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(s0, 3));
  g.setAttribute("aS0", new THREE.BufferAttribute(s0, 3));
  g.setAttribute("aS1", new THREE.BufferAttribute(s1, 3));
  g.setAttribute("aS2", new THREE.BufferAttribute(s2, 3));
  g.setAttribute("aS3", new THREE.BufferAttribute(s3, 3));
  g.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
  return g;
}

const color = (id: string) => new THREE.Color(LAYERS.find((l) => l.id === id)?.particle ?? "#6f86ff");

type Drive = { from: number; to: number; mix: number; colFrom: THREE.Color; colTo: THREE.Color; motion: number };

function Cloud({ drive, count }: { drive: React.RefObject<Drive>; count: number }) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
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
          uMix: { value: 1 },
          uFrom: { value: 0 },
          uTo: { value: 0 },
          uScale: { value: 1 },
          uLift: { value: 0 },
          uSize: { value: 2.4 },
          uDpr: { value: 1 },
          uMotion: { value: 1 },
          uColFrom: { value: new THREE.Color() },
          uColTo: { value: new THREE.Color() },
        },
      }),
    [],
  );
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);

  const points = useRef<THREE.Points>(null);
  useFrame((state) => {
    const u = (points.current?.material as THREE.ShaderMaterial | undefined)?.uniforms;
    if (!u) return;
    const d = drive.current;
    u.uTime.value = state.clock.elapsedTime;
    u.uFrom.value = d.from;
    u.uTo.value = d.to;
    u.uMix.value = d.mix;
    (u.uColFrom.value as THREE.Color).copy(d.colFrom);
    (u.uColTo.value as THREE.Color).copy(d.colTo);
    u.uMotion.value = d.motion;
    u.uDpr.value = gl.getPixelRatio();
    u.uScale.value = (Math.min(size.width, size.height) * 0.38) / R;
    u.uLift.value = size.height * 0.05; // доод талын тайлбартай давхцахгүй
    u.uSize.value = size.width < 400 ? 2.6 : 3.2;
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}

export default function BlogCloud({ layer, reduced }: { layer: string; reduced: boolean }) {
  const id = LAYERS.find((l) => l.name === layer)?.id ?? "claim";
  const k = ORDER.indexOf(id);
  const drive = useRef<Drive>({ from: k, to: k, mix: 1, colFrom: color(id), colTo: color(id), motion: reduced ? 0 : 1 });
  const wrap = useRef<HTMLDivElement>(null);
  const frameloop = useRef<(v: "always" | "never") => void>(() => {});

  // Давхарга солигдоход одоогийн дүрсээс шинэ рүү урсана. Урсгал хагасаас өмнө тасалдвал эхлэл хэвээр үлдэнэ.
  useEffect(() => {
    const d = drive.current;
    if (d.to === k) return;
    if (d.mix >= 0.5) {
      d.from = d.to;
      d.colFrom.copy(d.colTo);
    }
    d.to = k;
    d.colTo = color(id);
    if (reduced) {
      d.from = k;
      d.colFrom.copy(d.colTo);
      d.mix = 1;
      return;
    }
    d.mix = 0;
    gsap.to(d, { mix: 1, duration: 1.1, ease: "power2.out", overwrite: true });
  }, [k, id, reduced]);

  // Дэлгэцээс гарвал зурахаа зогсооно
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => frameloop.current(e.isIntersecting ? "always" : "never"));
    io.observe(el);
    return () => io.disconnect();
  }, [frameloop]);

  return (
    <div ref={wrap} className="absolute inset-0">
      <Canvas
        orthographic
        camera={{ zoom: 1, position: [0, 0, 1000], near: 0.1, far: 5000 }}
        dpr={[1, 2]}
        gl={{ antialias: false, alpha: true }}
        onCreated={({ setFrameloop }) => {
          frameloop.current = setFrameloop;
        }}
        aria-hidden
      >
        <Cloud drive={drive} count={typeof window !== "undefined" && innerWidth < 768 ? 1100 : 1700} />
      </Canvas>
    </div>
  );
}
