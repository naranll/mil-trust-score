"use client";

// Апп маягийн хуудас (тоглоом) идэвхтэй байх хугацаанд <html data-app-mode> тавина: хуудас гүйлгэгдэхгүй, footer нуугдана.
// CSS-ийн :has([data-app]) ашиглахгүй: Next (cacheComponents) өмнөх хуудсыг нуугаад DOM-д үлдээдэг тул
// тоглоомоос гарсны дараа ч дүрэм хэрэгжиж, дараагийн хуудас гүйлгэгдэхгүй гацдаг байсан. Effect нь хуудас нуугдахад цэвэрлэгдэнэ.
import { useEffect } from "react";

export function AppMode() {
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.appMode = "";
    return () => {
      delete html.dataset.appMode;
    };
  }, []);
  return null;
}
