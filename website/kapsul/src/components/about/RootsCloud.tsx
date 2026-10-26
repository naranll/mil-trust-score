"use client";

// «Бид навч биш, үндсийг хардаг»: нүүрний капсул шиг жижиг цэгүүдээс бүтсэн мод (WebGL).
// 1) Титэм ба их бие тархсан цэгүүдээс нийлнэ. 2) Газрын доорх 4 үндэс (4 давхаргын өнгө) цэг цэгээр ургана,
// ургаж буй үзүүр нь тод. 3) Гэрэл үндсээр дээш, их биеэр дамжин урсаж титэм од шиг гэрэлтэнэ: систем навчийг тэжээдэг.
// Байрлалыг CPU дээр нэг удаа тооцно, frame бүрт зөвхөн uniform шинэчилнэ (PointCapsule-тэй ижил арга).
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import * as THREE from "three";
import { LAYERS } from "@/data/layers";

// Модны орон зай (px): газар y = 0, дээш эерэг. Титэм ~ +270 хүртэл, үндэс ~ -105 хүртэл.
const W = 400;
const H = 395;
const MID_Y = 82; // модны босоо төв

const vertex = /* glsl */ `
attribute vec3 aTarget;
attribute vec3 aScatter;
attribute float aDepth;   // < 0: газрын дээр; 0…1: үндэс дагуух зай (газраас)
attribute float aRand;
attribute float aKind;    // 0 титэм, 1 их бие, 2…5 үндэс (давхарга)

uniform float uTime, uAssemble, uGrow, uLit, uScale, uSize, uDpr, uRotY, uMotion;
uniform vec3 uBase;
uniform vec3 uColors[4];

varying vec3 vColor;
varying float vAlpha;
varying float vGlow; // зөөлөн гэрэлтэлт (гэрэлтсэн титэм)
varying float vStar; // одны туяа (титмийн зарим цэг)

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
float easeOut(float t) { return 1.0 - pow(1.0 - t, 3.0); }

void main() {
  bool root = aKind > 1.5;
  vec3 p = aTarget;

  // Титэм салхинд зөөлөн найгана (дээд хэсэг нь илүү)
  if (aKind < 0.5) {
    float h = clamp(p.y / 270.0, 0.0, 1.0);
    p.x += sin(uTime * 0.7 + p.y * 0.012) * 4.0 * h * uMotion;
    p.y += sin(uTime * 1.3 + aRand * 30.0) * 1.2 * uMotion;
  }

  float show = 1.0;
  float tip = 0.0;
  if (root) {
    // Үндэс: uGrow хүрсэн цэгүүд гарч ирнэ, үзүүр хэсэг тод, том
    float d = aDepth - uGrow;
    show = smoothstep(0.02, -0.015, d);
    tip = smoothstep(-0.09, 0.0, d) * show;
    p = mix(p * vec3(1.0, 0.0, 1.0) * 0.2, p, easeOut(show)); // газраас гарч ирнэ
  } else {
    float t = clamp(uAssemble * 1.5 - aRand * 0.5, 0.0, 1.0);
    p = mix(aScatter, p, easeOut(t));
    show = t;
  }

  vec3 world = rotY(uRotY) * p;
  world.y -= ${MID_Y.toFixed(1)};
  world *= uScale;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);

  // Үндсээр гэрэл дээш урсана (гүнээс газар руу), их биеэр дамжаад титэм рүү
  float flow = 0.0;
  if (root) {
    float w = fract(aDepth * 1.6 + uTime * 0.28);
    flow = smoothstep(0.86, 1.0, w) * smoothstep(0.98, 1.0, uGrow) * uMotion;
  } else if (aKind < 1.5) {
    float w = fract(aTarget.y * 0.006 - uTime * 0.45);
    flow = smoothstep(0.88, 1.0, w) * uLit * uMotion;
  }

  // Титэм: их биеийн оройгоос гадагш гэрэлтэнэ (uLit), навч бүр үндсийнхээ өнгөөр од шиг асна
  float lit = 0.0, star = 0.0;
  vec3 leaf = uBase;
  if (aKind < 0.5) {
    float dist = length(aTarget - vec3(0.0, 150.0, 0.0)) / 150.0;
    lit = smoothstep(dist, dist + 0.25, uLit * 1.35);
    int b = int(fract(aRand * 7.31) * 4.0);
    for (int i = 0; i < 4; i++) if (i == b) leaf = uColors[i];
    leaf = mix(leaf, vec3(1.0), 0.3 + aRand * 0.25);
    star = lit * step(0.86, aRand) * (0.6 + 0.4 * sin(uTime * (1.4 + aRand * 2.2) + aRand * 90.0) * uMotion);
  } else if (aKind < 1.5) {
    lit = uLit * 0.6;
    leaf = mix(uBase, vec3(1.0), 0.35);
  }
  vGlow = root ? 0.12 : lit * (0.45 + aRand * 0.55);
  vStar = star;

  float att = clamp(1.0 + world.z / 600.0, 0.6, 1.25);
  float grow = root ? 1.35 + tip * 1.1 + flow * 0.6 : 0.9 + lit * 0.9 + flow * 0.5;
  gl_PointSize = uSize * uDpr * att * grow * (1.0 + star * 2.6) * (vGlow > 0.2 ? 1.6 : 1.0);

  int k = int(aKind + 0.5) - 2;
  vec3 c = mix(uBase, leaf, lit);
  if (root) {
    for (int i = 0; i < 4; i++) if (i == k) c = uColors[i];
  }
  vColor = mix(c, vec3(1.0), tip * 0.35 + flow * 0.45 + star * 0.4);
  float baseA = root ? 0.75 + aRand * 0.25 : (aKind < 0.5 ? 0.35 + aRand * 0.45 : 0.7);
  if (aKind < 0.5) baseA = mix(baseA, 0.75 + aRand * 0.25, lit) * (0.8 + 0.2 * sin(uTime * 1.7 + aRand * 50.0) * uMotion);
  vAlpha = baseA * show;
}
`;

const fragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vGlow;
varying float vStar;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c);
  // Тод цөм + зөөлөн туяа + (од бол) хөндлөн туяанууд
  float core = exp(-r2 * (vGlow > 0.2 ? 60.0 : 30.0) * (1.0 + vStar * 2.5));
  float halo = exp(-r2 * 14.0) * vGlow * 0.55;
  vec2 a = abs(c);
  float rays = vStar * (exp(-a.x * 70.0) * exp(-a.y * 7.0) + exp(-a.y * 70.0) * exp(-a.x * 7.0));
  float alpha = clamp(core + halo + rays, 0.0, 1.0) * vAlpha;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(vColor, alpha);
}
`;

function buildGeometry(count: number) {
  let s = 17;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
  const target: number[] = [], depth: number[] = [], kind: number[] = [];

  // Титэм: хэд хэдэн бөмбөлгийн нэгдэл (бөөн навч), эзлэхүүн дотор
  const blobs = [
    [0, 185, 110, 70], [-78, 165, 62, 50], [80, 168, 64, 50], [-40, 222, 64, 48], [44, 226, 62, 46], [0, 130, 70, 40],
  ];
  const nCanopy = Math.round(count * 0.42);
  while (target.length / 3 < nCanopy) {
    const b = blobs[Math.floor(rnd() * blobs.length)];
    const x = (rnd() * 2 - 1) * b[2], y = (rnd() * 2 - 1) * b[3], z = (rnd() * 2 - 1) * b[2] * 0.7;
    if ((x / b[2]) ** 2 + (y / b[3]) ** 2 + (z / (b[2] * 0.7)) ** 2 > 1) continue;
    target.push(b[0] + x, b[1] + y, z);
    depth.push(-1);
    kind.push(0);
  }

  // Их бие ба гол мөчрүүд
  const nTrunk = Math.round(count * 0.08);
  for (let i = 0; i < nTrunk; i++) {
    const t = rnd();
    if (rnd() < 0.7) {
      const y = t * 140, r = 10 - t * 5, a = rnd() * Math.PI * 2;
      target.push(Math.cos(a) * r * Math.sqrt(rnd()), y, Math.sin(a) * r * 0.6);
    } else {
      const side = rnd() < 0.5 ? -1 : 1;
      target.push(side * t * 60 + gauss() * 3, 110 + t * 55, gauss() * 4);
    }
    depth.push(-1);
    kind.push(1);
  }

  // Үндэс: давхарга бүрт нэг гол үндэс, салаалж доош ургана. aDepth = газраас явсан зам (0…1).
  const roots: { x: number; y: number; z: number; d: number; k: number; w: number }[] = [];
  const grow = (x: number, y: number, z: number, ang: number, zd: number, len: number, d0: number, level: number, k: number) => {
    const step = 3;
    const n = Math.round(len / step);
    for (let i = 0; i < n; i++) {
      ang += (rnd() - 0.5) * 0.16;
      x += Math.cos(ang) * step;
      y -= Math.sin(ang) * step;
      z += zd * step;
      const d = d0 + i * step;
      roots.push({ x, y, z, d, k, w: Math.max(1.2, 6 - level * 1.6 - (i / n) * 2.5) });
      if (level < 3 && rnd() < 0.045) grow(x, y, z, ang + (rnd() < 0.5 ? -0.75 : 0.75), (rnd() - 0.5) * 0.6, len * 0.55, d, level + 1, k);
    }
  };
  LAYERS.forEach((_, i) => grow(0, -2, 0, Math.PI / 2 + (i - 1.5) * 0.5, (i % 2 ? 1 : -1) * 0.25, 100, 0, 0, i));
  const maxD = Math.max(...roots.map((r) => r.d));
  const nRoots = count - target.length / 3;
  for (let i = 0; i < nRoots; i++) {
    const r = roots[Math.floor(rnd() * roots.length)];
    target.push(r.x + gauss() * r.w, r.y + gauss() * r.w * 0.6, r.z + gauss() * r.w);
    depth.push(r.d / maxD);
    kind.push(2 + r.k);
  }

  const n = target.length / 3;
  const scatter = new Float32Array(n * 3);
  const rand = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    scatter.set([(rnd() * 2 - 1) * W * 0.9, (rnd() * 2 - 1) * H * 0.6 + 170, (rnd() * 2 - 1) * 200], i * 3);
    rand[i] = rnd();
  }
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(target);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aTarget", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));
  geo.setAttribute("aDepth", new THREE.BufferAttribute(new Float32Array(depth), 1));
  geo.setAttribute("aKind", new THREE.BufferAttribute(new Float32Array(kind), 1));
  geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
  return geo;
}

function hexToVec(h: string) {
  const n = parseInt(h.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export type TreeDrive = { assemble: number; grow: number; lit: number; motion: number; tilt: number };

function Tree({ drive, count, base }: { drive: React.RefObject<TreeDrive>; count: number; base: THREE.Vector3 }) {
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
          uAssemble: { value: 0 },
          uGrow: { value: 0 },
          uLit: { value: 0 },
          uScale: { value: 1 },
          uSize: { value: 2.2 },
          uDpr: { value: 1 },
          uRotY: { value: 0 },
          uMotion: { value: 1 },
          uBase: { value: base },
          uColors: { value: LAYERS.map((l) => hexToVec(l.particle)) },
        },
      }),
    [base],
  );
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);

  const points = useRef<THREE.Points>(null);
  const rot = useRef(0);
  useFrame((state, delta) => {
    if (!points.current) return;
    const u = (points.current.material as THREE.ShaderMaterial).uniforms;
    const d = drive.current;
    // Хулганы хазайлт руу зөөлөн ойртоно; хөдөлгөөнгүй үед ч бага зэрэг эргэлдэнэ
    const goal = d.tilt * 0.5 + Math.sin(state.clock.elapsedTime * 0.25) * 0.25 * d.motion;
    rot.current += (goal - rot.current) * Math.min(1, delta * 2.5);
    u.uTime.value = state.clock.elapsedTime;
    u.uAssemble.value = d.assemble;
    u.uGrow.value = d.grow;
    u.uLit.value = d.lit;
    u.uMotion.value = d.motion;
    u.uRotY.value = rot.current;
    u.uDpr.value = gl.getPixelRatio();
    u.uScale.value = Math.min(size.width / W, size.height / H);
    u.uSize.value = size.width < 400 ? 1.9 : 2.3;
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}

export default function RootsCloud({ reduced }: { reduced: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const drive = useRef<TreeDrive>({ assemble: reduced ? 1 : 0, grow: reduced ? 1 : 0, lit: reduced ? 1 : 0, motion: reduced ? 0 : 1, tilt: 0 });
  const active = useRef(false);
  const [base, count] = useMemo(() => {
    // Титмийн өнгө: сэдвийн гуравдагч текстийн өнгө (гэрэл/харанхуй аль алинд тохирно)
    const c = new THREE.Color();
    if (typeof window !== "undefined") {
      const probe = document.createElement("span");
      probe.style.color = "var(--text-tertiary)";
      document.body.appendChild(probe);
      c.setStyle(getComputedStyle(probe).color);
      probe.remove();
    }
    return [new THREE.Vector3(c.r, c.g, c.b), typeof window !== "undefined" && innerWidth < 768 ? 2200 : 3600] as const;
  }, []);
  const invalidate = useRef<() => void>(() => {});

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let played = false;
    const io = new IntersectionObserver(([e]) => {
      active.current = e.isIntersecting;
      el.dataset.active = e.isIntersecting ? "1" : "0";
      invalidate.current();
      if (e.isIntersecting && !played && !reduced) {
        played = true;
        const d = drive.current;
        gsap.timeline()
          .to(d, { assemble: 1, duration: 1.6, ease: "expo.out" }, 0.1)
          .to(d, { grow: 1, duration: 2.8, ease: "power2.inOut" }, 0.7)
          .to(d, { lit: 1, duration: 2.4, ease: "power2.out" }, 3.1);
      }
    });
    io.observe(el);
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      drive.current.tilt = reduced ? 0 : ((e.clientX - r.left) / r.width - 0.5) * 2;
    };
    const leave = () => (drive.current.tilt = 0);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      io.disconnect();
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [reduced]);

  return (
    <div ref={wrap} className="absolute inset-0">
      <Canvas
        orthographic
        camera={{ zoom: 1, position: [0, 0, 1000], near: 0.1, far: 5000 }}
        dpr={[1, 1.5]}
        frameloop={reduced ? "demand" : "always"}
        gl={{ antialias: false, alpha: true }}
        onCreated={({ invalidate: inv, setFrameloop }) => {
          invalidate.current = () => {
            // Дэлгэцээс гарвал зурахаа зогсооно
            if (!reduced) setFrameloop(active.current ? "always" : "never");
            inv();
          };
          invalidate.current();
        }}
        aria-hidden
      >
        <Tree drive={drive} count={count} base={base} />
      </Canvas>
    </div>
  );
}
