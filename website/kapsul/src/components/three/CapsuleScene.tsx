"use client";

// Хоёр хагас болж нээгддэг капсул + доош асгарах хэсгүүд (particles).
// open (0..1) утгыг ref-ээр өгнө: гүйлгэх (scroll) эсвэл товч дарахад өөрчлөгдөнө.
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

export type ParticleGroup = { color: string; count: number };

const R = 0.62; // капсулын радиус
const L = 0.95; // хагас бүрийн цилиндр хэсгийн урт

// Хагас капсулын хэлбэр (Lathe): таслагдсан тал нь y=0, бөмбөрцөг үзүүр нь доор
function useHalfGeometry() {
  return useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.max(0.0001, R * Math.sin(a)), -L - R * Math.cos(a)));
    }
    pts.push(new THREE.Vector2(R, 0));
    return new THREE.LatheGeometry(pts, 64);
  }, []);
}

// Тогтвортой санамсаргүй тоо (seed)
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

function Halves({ openRef, shellA, shellB }: { openRef: RefObject<number>; shellA: string; shellB: string }) {
  const geo = useHalfGeometry();
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const p = ease(openRef.current ?? 0);
    const bob = Math.sin(clock.elapsedTime * 0.8) * 0.04;
    // Хаалттай үед бүхэлдээ бага зэрэг хазайна (лого шиг), нээгдэхэд "V" хэлбэр үүснэ
    const tilt = 0.22 * (1 - p);
    if (left.current) {
      // Зүүн хагас: бөмбөрцөг үзүүр нь зүүн дээш, таслагдсан тал нь төв рүү доош
      left.current.position.set(-0.03 - 1.0 * p, 0.32 * p + bob - 0.012 * (1 - p), 0);
      left.current.rotation.set(0, 0, -Math.PI / 2 - 0.62 * p + tilt);
    }
    if (right.current) {
      right.current.position.set(0.03 + 1.0 * p, 0.32 * p + bob + 0.012 * (1 - p), 0);
      right.current.rotation.set(0, 0, Math.PI / 2 + 0.62 * p + tilt);
    }
  });

  return (
    <>
      <group ref={left}>
        <mesh geometry={geo}>
          <meshStandardMaterial color={shellA} roughness={0.32} metalness={0.05} side={THREE.FrontSide} />
        </mesh>
        <mesh geometry={geo} scale={0.985}>
          <meshStandardMaterial color="#1b1d21" roughness={0.9} side={THREE.BackSide} />
        </mesh>
      </group>
      <group ref={right}>
        <mesh geometry={geo}>
          <meshStandardMaterial color={shellB} roughness={0.32} metalness={0.05} side={THREE.FrontSide} />
        </mesh>
        <mesh geometry={geo} scale={0.985}>
          <meshStandardMaterial color="#1b1d21" roughness={0.9} side={THREE.BackSide} />
        </mesh>
      </group>
    </>
  );
}

function Particles({ openRef, groups, seed = 7 }: { openRef: RefObject<number>; groups: ParticleGroup[]; seed?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const total = groups.reduce((s, g) => s + g.count, 0);

  // Хэсэг бүрийн эхлэл, төгсгөл, хэмжээ, өнгийг нэг удаа тооцоолно
  const data = useMemo(() => {
    const rnd = mulberry32(seed);
    const start: THREE.Vector3[] = [];
    const end: THREE.Vector3[] = [];
    const size: number[] = [];
    const phase: number[] = [];
    const delay: number[] = [];
    const colors = new Float32Array(total * 3);
    const c = new THREE.Color();
    let i = 0;
    for (const g of groups) {
      c.set(g.color);
      for (let k = 0; k < g.count; k++) {
        // Эхлэл: капсулын дотор, таслагдсан хэсгийн ойролцоо
        start.push(new THREE.Vector3((rnd() - 0.5) * 0.5, 0.35 + (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.5));
        // Төгсгөл: хоёр хагаснаас асгарч, төвд солбилцон "X" хэлбэр үүсгэнэ (reference 1)
        const fall = rnd();
        const side = rnd() < 0.5 ? -1 : 1;
        const cross = 0.75 - fall * 1.5; // дээр: өөрийн тал, дунд: төв, доор: эсрэг тал
        end.push(
          new THREE.Vector3(
            side * cross * (0.8 + rnd() * 0.4) + (rnd() - 0.5) * 0.45,
            0.15 - fall * 2.4 + (rnd() - 0.5) * 0.3,
            (rnd() - 0.5) * 1.1,
          ),
        );
        size.push(0.03 + Math.pow(rnd(), 2.4) * 0.07);
        phase.push(rnd() * Math.PI * 2);
        delay.push(fall * 0.35);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
        i++;
      }
    }
    return { start, end, size, phase, delay, colors };
  }, [groups, total, seed]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const p = openRef.current ?? 0;
    const t = clock.elapsedTime;
    for (let i = 0; i < total; i++) {
      // Хоцрогдолтой асгаралт: доод хэсгүүд сүүлд хүрнэ
      const local = ease((p - data.delay[i]) / (1 - data.delay[i] * 0.6));
      v.lerpVectors(data.start[i], data.end[i], local);
      v.x += Math.sin(t * 0.6 + data.phase[i]) * 0.025 * local;
      v.y += Math.cos(t * 0.5 + data.phase[i]) * 0.025 * local;
      dummy.position.copy(v);
      const s = data.size[i] * Math.min(1, local * 3);
      dummy.scale.setScalar(Math.max(s, 0.0001));
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, total]} key={total}>
      <sphereGeometry args={[1, 14, 14]}>
        <instancedBufferAttribute attach="attributes-color" args={[data.colors, 3]} />
      </sphereGeometry>
      <meshStandardMaterial vertexColors roughness={0.45} />
    </instancedMesh>
  );
}

export default function CapsuleScene({
  openRef,
  groups,
  shellA = "#0072b2",
  shellB = "#e6f1f8",
  scale = 1,
  offsetY = 0,
  seed,
  label,
}: {
  openRef: RefObject<number>;
  groups: ParticleGroup[];
  shellA?: string;
  shellB?: string;
  scale?: number;
  offsetY?: number;
  seed?: number;
  label: string;
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 6.2], fov: 38 }}
      gl={{ antialias: true, alpha: true }}
      aria-label={label}
      role="img"
    >
      <hemisphereLight args={["#ffffff", "#9aa0a8", 1.2]} />
      <directionalLight position={[3, 4, 5]} intensity={2.2} color="#ffffff" />
      <directionalLight position={[-4, -2, 2]} intensity={0.6} color="#e6f1f8" />
      <group scale={scale} position={[0, offsetY, 0]}>
        <Halves openRef={openRef} shellA={shellA} shellB={shellB} />
        <Particles openRef={openRef} groups={groups} seed={seed} />
      </group>
    </Canvas>
  );
}
