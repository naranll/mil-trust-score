// 3D (WebGL) хөдөлгөөн харуулах эсэх. Server дээр "pending" (hydration зөрөхгүй), хөтөч дээр нэг удаа шалгана.
// "anim" = WebGL байгаа, хөдөлгөөн зөвшөөрөгдсөн; "static" = хөдөлгөөн багасгасан эсвэл WebGL байхгүй.
import { useSyncExternalStore } from "react";

export type RenderMode = "pending" | "anim" | "static";

let cached: { webgl: boolean; reduced: boolean } | null = null;
function probe() {
  if (cached) return cached;
  let webgl = false;
  try {
    const c = document.createElement("canvas");
    webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webgl = false;
  }
  cached = { webgl, reduced: matchMedia("(prefers-reduced-motion: reduce)").matches };
  return cached;
}

const noSubscribe = () => () => {};

// Нүүрний түүх: хөдөлгөөн багасгасан үед canvas огт хэрэглэхгүй
export function useRenderMode(): RenderMode {
  return useSyncExternalStore(
    noSubscribe,
    () => {
      const p = probe();
      return p.reduced || !p.webgl ? "static" : "anim";
    },
    () => "pending" as RenderMode,
  );
}

// Тоглоом: WebGL байвал хөрөг зурна (хөдөлгөөн багасгасан үед ч хөдөлгөөнгүй хэлбэрээр)
export function useWebGL(): boolean | null {
  return useSyncExternalStore(noSubscribe, () => probe().webgl, () => null);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(noSubscribe, () => probe().reduced, () => false);
}
