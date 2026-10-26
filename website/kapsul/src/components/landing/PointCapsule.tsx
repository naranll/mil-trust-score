"use client";

// Цэгэн капсул: цэг бүр = feed-ийн нэг пост. «Цөм» нь мэдээллээс бүтсэн.
// Байрлалуудыг CPU дээр НЭГ удаа тооцож attribute болгоно (нэгж хэмжээтэй), шилжилтийг vertex shader хийнэ.
// GSAP нь `drive` объектын тоонуудыг өөрчилнө, энд frame бүрт тэдгээрийг uniform руу хуулна (CPU-д хямд).
// Дэлгэцийн хэмжээ өөрчлөгдөхөд зөвхөн uniform (төв, өндөр, 5 бөөгнөрлийн байрлал) солигдоно.
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import "@/lib/three-console";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

export type Drive = {
  assemble: number; // 0 тархсан → 1 капсул (ачаалахад нэг удаа)
  problem: number; // 1-р үе: гадаргуу тогтворгүй болно
  manip: number; // 1-р үе: ~12% цэг улбар шар (манипуляцтай пост)
  split: number; // 2-р үе: хоёр хагас салах
  burst: number; // 2-р үе: цэгүүд гадагш цацрах
  regroup: number; // 3-р үе: 5 жижиг капсул
  shift: number; // 0 гарчгийн ард (x0,y0) → 1 баруун талд (cx,cy)
  tilt: { x: number; y: number }; // хулганын хазайлт (радиан, зорилт)
  hover: number; // хулгана/фокус байгаа бөөгнөрөл, -1 = байхгүй
  layout: {
    x0: number; // 0-р үе шатны төв: гарчгийн яг ард (px, canvas-ийн төвөөс, y дээшээ)
    y0: number;
    cx: number; // 1–2-р үе шатны төв
    cy: number;
    capH: number; // капсулын өндөр (px)
    clusterH: number; // жижиг капсулын өндөр (px)
    ex: number; // тархалтын хүрээ = дэлгэцийн хагас (px)
    ey: number;
    slots: number[]; // 5 бөөгнөрлийн төв [x0,y0,x1,y1,…] (px)
  };
};

const BASE = [0xe6 / 255, 0xed / 255, 0xf3 / 255]; // #E6EDF3
const MANIP = [0xd5 / 255, 0x5e / 255, 0x00 / 255]; // #D55E00

const vertex = /* glsl */ `
attribute vec3 aUnit;    // нэгж капсулын гадаргуу дээрх цэг (өндөр 1, радиус 0.22)
attribute vec3 aDir;     // цацралтын байрлал (нэгж)
attribute vec3 aScatter; // ачаалахын өмнөх тархсан байрлал [-1,1]
attribute float aRand;
attribute float aGroup;  // 0…4 = habits.ts-ийн дараалал

uniform float uTime, uAssemble, uProblem, uManip, uSplit, uBurst, uRegroup, uRotY, uTiltX, uTiltY;
uniform vec3 uCenter;
uniform float uCapH, uClusterH, uSize, uDpr, uBig;
uniform vec2 uExtent;
uniform vec3 uSlots[5];
uniform float uHover[5];
uniform vec3 uColors[5];

varying vec3 vColor;
varying float vAlpha;

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
float ease(float t) { return t * t * (3.0 - 2.0 * t); }

void main() {
  int g = int(aGroup + 0.5);
  float hov = uHover[g];

  // 0–1: капсул (+ тогтворгүй гадаргуу), 2: хоёр хагас салах
  vec3 u = aUnit;
  vec3 radial = normalize(vec3(u.x, 0.0, u.z) + 1e-5);
  float wob = sin(aRand * 60.0 + uTime * 5.0 + u.y * 12.0) * 0.5 + 0.5;
  u += radial * uProblem * wob * 0.09;
  u.y += sign(aUnit.y + 1e-4) * uSplit * 0.2;
  vec3 cap = rotX(uTiltY) * rotY(uRotY + uTiltX) * u * uCapH + uCenter;

  vec3 scat = vec3(aScatter.xy * uExtent, aScatter.z * 200.0);
  vec3 p = mix(scat, cap, ease(clamp(uAssemble * 1.4 - aRand * 0.4, 0.0, 1.0)));

  // 2: гадагш цацрах
  vec3 burst = rotY(uRotY) * aDir * uCapH + uCenter;
  p = mix(p, burst, ease(clamp(uBurst * 1.3 - aRand * 0.3, 0.0, 1.0)));

  // 3: 5 жижиг капсул (голын дадал uBig нь 1.3 дахин том). Hover үед бага зэрэг эргэж, тодорно.
  float scale = uClusterH * (abs(aGroup - uBig) < 0.5 ? 1.3 : 1.0) * (1.0 + hov * 0.08);
  vec3 cl = rotY(uTime * 0.25 + aGroup + hov * 0.8) * aUnit * scale + uSlots[g];
  float tr = ease(clamp(uRegroup * 1.35 - aRand * 0.35, 0.0, 1.0));
  p = mix(p, cl, tr);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  // Дэлгэцийн ирмэгт аажмаар бүдгэрнэ: хатуу хүрээ үүсэхгүй
  vec2 ndc = abs(gl_Position.xy / gl_Position.w);
  float edge = smoothstep(1.02, 0.78, max(ndc.x, ndc.y));

  // Гүнээр хэмжээ: ойрын цэг том (ортографик камер тул өөрсдөө тооцно)
  float depthRef = max(mix(uCapH, scale, tr) * 0.22, 1.0);
  float att = 1.0 + clamp(p.z / depthRef, -1.0, 1.0) * 0.35;
  gl_PointSize = uSize * uDpr * att * (1.0 + hov * 0.45 * tr);

  vec3 c = mix(vec3(${BASE.join(", ")}), vec3(${MANIP.join(", ")}), step(aRand, 0.12) * uManip);
  vColor = mix(c, uColors[g], tr);
  vAlpha = mix(0.35 + aRand * 0.6, 0.85 + hov * 0.15, tr) * (0.6 + 0.4 * att) * edge;
}
`;

const fragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  // Дугуй, зөөлөн ирмэгтэй цэг (additive биш, тод)
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.3, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

function buildGeometry(count: number, groupWeights: number[]) {
  // Нэгж капсул: нийт өндөр 1 (дунд хэсэг 0.56 + хоёр хагас бөмбөрцөг 0.22)
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.56, 8, 24));
  const sampler = new MeshSurfaceSampler(mesh).build();
  const v = new THREE.Vector3();
  const unit = new Float32Array(count * 3);
  const dir = new Float32Array(count * 3);
  const scatter = new Float32Array(count * 3);
  const rand = new Float32Array(count);
  const group = new Float32Array(count);
  const total = groupWeights.reduce((a, b) => a + b, 0);

  for (let i = 0; i < count; i++) {
    sampler.sample(v);
    unit.set([v.x, v.y, v.z], i * 3);
    // Цацралт: гадаргуугаас гадагш, санамсаргүй хазайлттай
    const r = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.2);
    const d = new THREE.Vector3(v.x, v.y * 0.6, v.z).add(r).normalize().multiplyScalar(0.6 + Math.random() * 1.3);
    dir.set([d.x, d.y, d.z], i * 3);
    scatter.set([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1], i * 3);
    rand[i] = Math.random();
    // Бүлэг: голын дадал 1.3 дахин том тул цэг илүү (талбай ~1.69)
    let x = Math.random() * total, gi = 0;
    while (x > groupWeights[gi] && gi < groupWeights.length - 1) x -= groupWeights[gi++];
    group[i] = gi;
  }
  mesh.geometry.dispose();

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(unit, 3));
  geo.setAttribute("aUnit", new THREE.BufferAttribute(unit, 3));
  geo.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
  geo.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));
  geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
  geo.setAttribute("aGroup", new THREE.BufferAttribute(group, 1));
  return geo;
}

function Cloud({ driveRef, count, colors, big }: { driveRef: RefObject<Drive>; count: number; colors: string[]; big: number }) {
  const gl = useThree((s) => s.gl);
  const geometry = useMemo(() => buildGeometry(count, colors.map((_, i) => (i === big ? 1.69 : 1))), [count, colors, big]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uAssemble: { value: 0 },
          uProblem: { value: 0 },
          uManip: { value: 0 },
          uSplit: { value: 0 },
          uBurst: { value: 0 },
          uRegroup: { value: 0 },
          uRotY: { value: 0 },
          uTiltX: { value: 0 },
          uTiltY: { value: 0 },
          uCenter: { value: new THREE.Vector3() },
          uCapH: { value: 300 },
          uClusterH: { value: 80 },
          uSize: { value: count > 1500 ? 2.6 : 2.4 },
          uDpr: { value: 1 },
          uBig: { value: big },
          uExtent: { value: new THREE.Vector2(600, 400) },
          uSlots: { value: Array.from({ length: 5 }, () => new THREE.Vector3()) },
          uHover: { value: [0, 0, 0, 0, 0] },
          // Shader нь өнгийг шууд sRGB-ээр гаргана (color management-гүй), тиймээс hex-ийг шууд
          uColors: {
            value: colors.map((h) => {
              const n = parseInt(h.slice(1), 16);
              return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
            }),
          },
        },
      }),
    [colors, count, big],
  );
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);

  const rot = useRef(0);
  const tilt = useRef({ x: 0, y: 0 });
  const points = useRef<THREE.Points>(null);

  // Uniform-уудыг ref-ээр дамжуулж өөрчилнө (useMemo-гийн утгыг шууд өөрчлөхгүй)
  useFrame((state, delta) => {
    if (!points.current) return;
    const u = (points.current.material as THREE.ShaderMaterial).uniforms;
    const drive = driveRef.current;
    const L = drive.layout;
    rot.current += delta * 0.12; // маш удаан Y эргэлт
    tilt.current.x += (drive.tilt.x - tilt.current.x) * Math.min(1, delta * 4);
    tilt.current.y += (drive.tilt.y - tilt.current.y) * Math.min(1, delta * 4);
    u.uTime.value = state.clock.elapsedTime;
    u.uAssemble.value = drive.assemble;
    u.uProblem.value = drive.problem;
    u.uManip.value = drive.manip;
    u.uSplit.value = drive.split;
    u.uBurst.value = drive.burst;
    u.uRegroup.value = drive.regroup;
    u.uRotY.value = rot.current;
    u.uTiltX.value = tilt.current.x;
    u.uTiltY.value = tilt.current.y;
    u.uDpr.value = gl.getPixelRatio();
    const k = drive.shift;
    (u.uCenter.value as THREE.Vector3).set(L.x0 + (L.cx - L.x0) * k, L.y0 + (L.cy - L.y0) * k, 0);
    u.uCapH.value = L.capH;
    u.uClusterH.value = L.clusterH;
    (u.uExtent.value as THREE.Vector2).set(L.ex, L.ey);
    const slots = u.uSlots.value as THREE.Vector3[];
    const hov = u.uHover.value as number[];
    for (let i = 0; i < 5; i++) {
      slots[i].set(L.slots[i * 2] ?? 0, L.slots[i * 2 + 1] ?? 0, 0);
      hov[i] += ((drive.hover === i ? 1 : 0) - hov[i]) * Math.min(1, delta * 8);
    }
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}

export default function PointCapsule({
  driveRef,
  count,
  colors,
  big,
  active,
  onReady,
}: {
  driveRef: RefObject<Drive>;
  count: number;
  colors: string[];
  big: number; // 1.3 дахин том бөөгнөрлийн дугаар
  active: boolean;
  onReady: () => void;
}) {
  return (
    // Ортографик камер, zoom 1: дэлхийн 1 нэгж = CSS-ийн 1px (HTML шошготой тааруулахад хялбар)
    <Canvas
      orthographic
      camera={{ zoom: 1, position: [0, 0, 1000], near: 0.1, far: 5000 }}
      dpr={[1, 1.5]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      onCreated={onReady}
      aria-hidden
      style={{ pointerEvents: "none" }}
    >
      <Cloud driveRef={driveRef} count={count} colors={colors} big={big} />
    </Canvas>
  );
}
