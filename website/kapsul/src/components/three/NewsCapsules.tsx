"use client";

// 3D viz 2: дэлхийн мэдээний 5 үзүүлэлт. Капсул бүрийн улбар шар хэсгийн урт = хувь.
// Orthographic камер ашигласан тул 3D мөр бүр DOM дээрх шошготой яг таарна.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type Row = { label: string; value: number };

const RAD = 0.27;

function Pill({ value, y, delay, progress, rowPx }: { value: number; y: number; delay: number; progress: React.RefObject<number>; rowPx: number }) {
  const { size } = useThree();
  const len = Math.max(size.width / rowPx - 0.3, 1.5); // канвасын өргөнд тааруулна
  const fill = useRef<THREE.Mesh>(null);
  const rest = useRef<THREE.Mesh>(null);
  const capL = useRef<THREE.Mesh>(null);
  const capR = useRef<THREE.Mesh>(null);
  const g = useRef<THREE.Group>(null);
  const cyl = useMemo(() => new THREE.CylinderGeometry(RAD, RAD, 1, 40, 1, true), []);

  useFrame(({ clock }) => {
    const C = len - 2 * RAD;
    const x0 = -len / 2 + RAD;
    // Харагдах үед дүүргэлт 0-ээс утга хүртэл өснө
    const t = Math.min(Math.max((progress.current - delay) * 1.7, 0), 1);
    const v = (value / 100) * (1 - Math.pow(1 - t, 3));
    const a = Math.max(v * C, 0.001);
    const b = Math.max(C - a, 0.001);
    if (fill.current) {
      fill.current.scale.y = a;
      fill.current.position.x = x0 + a / 2;
    }
    if (rest.current) {
      rest.current.scale.y = b;
      rest.current.position.x = x0 + a + b / 2;
    }
    capL.current?.position.set(x0, 0, 0);
    capR.current?.position.set(-x0, 0, 0);
    // Урт тэнхлэгээ дагуу аажим эргэнэ: гэрлийн тусгал гулсаж харагдана
    if (g.current) g.current.rotation.x = clock.elapsedTime * 0.35 + y;
  });

  return (
    <group ref={g} position={[0, y, 0]}>
      <mesh ref={capL}>
        <sphereGeometry args={[RAD, 32, 24]} />
        <meshStandardMaterial color="#0072b2" roughness={0.35} />
      </mesh>
      <mesh ref={fill} geometry={cyl} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial color="#0072b2" roughness={0.35} />
      </mesh>
      <mesh ref={rest} geometry={cyl} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial color="#c9ced6" roughness={0.4} />
      </mesh>
      <mesh ref={capR}>
        <sphereGeometry args={[RAD, 32, 24]} />
        <meshStandardMaterial color="#c9ced6" roughness={0.4} />
      </mesh>
    </group>
  );
}

export function NewsCapsules({ rows }: { rows: Row[] }) {
  const box = useRef<HTMLDivElement>(null);
  const progress = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const update = () => {
      const el = box.current;
      if (!el) return;
      if (reduce) {
        progress.current = 1;
        return;
      }
      const r = el.getBoundingClientRect();
      // Дэлгэцийн доороос орж ирэхэд 0, дэлгэцийн дунд ирэхэд 1
      progress.current = Math.min(Math.max((window.innerHeight - r.top) / (window.innerHeight * 0.75), 0), 1.2);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const n = rows.length;
  // Утсан дээр шошго капсулын дээр байрлах тул мөр өндөр
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const rowPx = mobile ? 112 : 80;
  const dy = mobile ? -0.2 : 0; // утсан дээр капсулыг мөрийн доод хэсэгт

  return (
    <div ref={box} className="relative grid grid-cols-[minmax(0,1fr)_3.5rem] gap-x-3 md:grid-cols-[17rem_minmax(0,1fr)_4.5rem] md:gap-x-6">
      {/* Шошго: мөр бүр 3D капсултай таарна */}
      <ul className="col-start-1 row-start-1 grid md:col-start-1" style={{ gridTemplateRows: `repeat(${n}, ${rowPx}px)` }}>
        {rows.map((r) => (
          <li key={r.label} className="relative z-10 flex items-start pt-1 text-sm leading-snug text-ink md:items-center md:pt-0 md:text-base">
            {r.label}
          </li>
        ))}
      </ul>

      <div
        className="col-start-1 row-start-1 md:col-start-2"
        style={{ height: n * rowPx }}
        role="img"
        aria-label={rows.map((r) => `${r.label}: ${r.value}%`).join(". ")}
      >
        <Canvas key={rowPx} orthographic dpr={[1, 1.5]} camera={{ position: [0, 0, 10], zoom: rowPx }} gl={{ alpha: true, antialias: true }}>
          <hemisphereLight args={["#ffffff", "#9aa0a8", 1.2]} />
          <directionalLight position={[2, 4, 6]} intensity={2.2} />
          {rows.map((r, i) => (
            <Pill key={r.label} value={r.value} y={(n - 1) / 2 - i + dy} delay={i * 0.07} progress={progress} rowPx={rowPx} />
          ))}
        </Canvas>
      </div>

      <ul className="col-start-2 row-start-1 grid md:col-start-3" style={{ gridTemplateRows: `repeat(${n}, ${rowPx}px)` }} aria-hidden>
        {rows.map((r) => (
          <li
            key={r.label}
            className="font-display flex items-end pb-[18px] text-xl font-bold text-ink tnum md:items-center md:pb-0 md:text-2xl"
          >
            {r.value}%
          </li>
        ))}
      </ul>
    </div>
  );
}
