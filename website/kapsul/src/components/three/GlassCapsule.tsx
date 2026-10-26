"use client";

// Тунгалаг шилэн капсул. Дотор нь 4 давхарга (мэдэгдэл → танин мэдэхүй) үүрлэсэн байна.
// Дарахад шилэн бүрхүүл задарч, 4 давхарга 4 эм болж эгнэнэ. Эмийг дарж давхарга сонгоно.
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { LAYERS } from "@/data/layers";

const R = 0.62; // гаднах шилний радиус
const L = 0.95; // хагас бүрийн цилиндрийн урт
const NEST = [0.5, 0.38, 0.26, 0.14]; // дотоод давхаргуудын радиус (гаднаас гүн рүү)
const ROW = [-1.5, -0.5, 0.5, 1.5]; // задарсан үеийн байрлал
const PILL = 0.23; // задарсан үеийн эмийн радиус

const ease = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Хагас капсул (Lathe): таслагдсан тал y=0
function useHalf() {
  return useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.max(0.0001, R * Math.sin(a)), -L - R * Math.cos(a)));
    }
    pts.push(new THREE.Vector2(R, 0));
    return new THREE.LatheGeometry(pts, 72);
  }, []);
}

type Props = {
  open: boolean;
  selected: number | null;
  onOpen: () => void;
  onSelect: (i: number) => void;
  onHover: (i: number | null) => void;
  still: boolean;
};

function Model({ open, selected, onOpen, onSelect, onHover, still }: Props) {
  const half = useHalf();
  // Бүх эм нэг ижил хэлбэртэй: радиус 1, цилиндр 2L/R урт. Хэмжээг scale-аар өөрчилнө
  const pillGeo = useMemo(() => new THREE.CapsuleGeometry(1, (2 * L) / R, 12, 48), []);
  const root = useRef<THREE.Group>(null);
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const layers = useRef<(THREE.Mesh | null)[]>([]);
  const p = useRef(0); // 0 = хаалттай, 1 = задарсан
  const pointer = useRef({ x: 0, y: 0 });
  // Нарийн дэлгэцэд эмүүдийг ойртуулж, бүгд багтахаар болгоно
  const { size } = useThree();
  const spread = size.width < 520 ? 0.58 : size.width < 800 ? 0.8 : 1;

  useFrame((state, dt) => {
    // Нээгдэх/хаагдах явц зөөлөн
    p.current = THREE.MathUtils.damp(p.current, open ? 1 : 0, still ? 100 : 3.2, dt);
    const e = ease(p.current);
    pointer.current.x = THREE.MathUtils.damp(pointer.current.x, state.pointer.x, 4, dt);
    pointer.current.y = THREE.MathUtils.damp(pointer.current.y, state.pointer.y, 4, dt);

    if (root.current) {
      // Хаалттай үед хулганыг дагаж бага зэрэг эргэнэ, нээгдэхэд тэгширнэ
      const t = still ? 0 : state.clock.elapsedTime;
      root.current.rotation.y = lerp(pointer.current.x * 0.5 + Math.sin(t * 0.4) * 0.15, 0, e);
      root.current.rotation.x = lerp(-pointer.current.y * 0.3, 0, e);
    }
    // Шилэн хоёр хагас: хажуу тийш гарч жижгэрнэ
    const out = lerp(0.02, 3.4, e);
    const shrink = lerp(1, 0.001, ease(p.current * 1.4));
    left.current?.position.set(-out, 0, 0);
    left.current?.scale.setScalar(shrink);
    right.current?.position.set(out, 0, 0);
    right.current?.scale.setScalar(shrink);

    // Дотоод давхаргууд: үүрээсээ гарч эгнээнд зогсоно
    layers.current.forEach((m, i) => {
      if (!m) return;
      const sel = selected === i;
      const dim = selected !== null && !sel;
      const target = PILL * (sel ? 1.22 : 1) * (spread < 1 ? 0.85 : 1);
      // Давхарга бүр арай өөр цагт хөдөлнө (гүн давхарга хамгийн сүүлд)
      const li = ease((p.current - i * 0.08) / 0.76);
      m.position.set(lerp(0, ROW[i] * spread, li), lerp(0, sel ? 0.08 : 0, li), lerp(0, 0.2, li));
      m.rotation.z = lerp(Math.PI / 2, 0, li);
      const s = lerp(NEST[i], target, li);
      m.scale.setScalar(THREE.MathUtils.damp(m.scale.x, s, 10, dt));
      const mat = m.material as THREE.MeshPhysicalMaterial;
      mat.opacity = THREE.MathUtils.damp(mat.opacity, lerp(i === 3 ? 1 : 0.42, dim ? 0.35 : 1, li), 8, dt);
      mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, sel ? 0.35 : 0.04, 8, dt);
    });
  });

  const glass = (
    <meshPhysicalMaterial
      transmission={1}
      thickness={0.35}
      roughness={0.06}
      ior={1.4}
      color="#eaf4fb"
      attenuationColor="#cfe6f5"
      attenuationDistance={2}
      clearcoat={1}
      clearcoatRoughness={0.1}
      side={THREE.DoubleSide}
    />
  );

  const click = (i: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!open) onOpen();
    else onSelect(i);
  };

  return (
    <group
      ref={root}
      onClick={(e) => {
        e.stopPropagation();
        if (!open) onOpen();
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => {
        document.body.style.cursor = "";
        onHover(null);
      }}
    >
      <group ref={left}>
        <mesh geometry={half} rotation={[0, 0, -Math.PI / 2]}>
          {glass}
        </mesh>
      </group>
      <group ref={right}>
        <mesh geometry={half} rotation={[0, 0, Math.PI / 2]}>
          {glass}
        </mesh>
      </group>
      {LAYERS.map((l, i) => (
        <mesh
          key={l.id}
          ref={(m) => {
            layers.current[i] = m;
          }}
          geometry={pillGeo}
          scale={NEST[i]}
          rotation={[0, 0, Math.PI / 2]}
          renderOrder={4 - i}
          onClick={click(i)}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = "pointer";
            if (open) onHover(i);
          }}
        >
          <meshPhysicalMaterial
            color={l.particle}
            emissive={l.particle}
            emissiveIntensity={0.04}
            roughness={0.28}
            clearcoat={0.6}
            transparent
            opacity={i === 3 ? 1 : 0.42}
            depthWrite={i === 3}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function GlassCapsule(props: Props & { label: string }) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0.2, 6], fov: 36 }} gl={{ antialias: true, alpha: true }} aria-label={props.label} role="img">
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      {/* Шилэнд тусах гэрэл: сүлжээнээс юу ч татахгүй, дотроо үүсгэнэ */}
      <Environment resolution={256}>
        <Lightformer intensity={2.4} position={[0, 4, -6]} scale={[12, 4, 1]} />
        <Lightformer intensity={1.2} position={[-6, 1, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} color="#e6f1f8" />
        <Lightformer intensity={1.2} position={[6, -1, 2]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} color="#fff4dc" />
      </Environment>
      <Model {...props} />
    </Canvas>
  );
}
