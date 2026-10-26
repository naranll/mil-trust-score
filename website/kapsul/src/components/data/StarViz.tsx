"use client";

// Хэвлэлийн хүрээлэнгийн өгөгдлийг одтой 3 графикаар харуулна: сайтууд, мэдээллийн төрөл, хиймэл оюун.
// Тэмдэглэгээг React зурна, графикуудыг d3 (star-viz-engine.js) зурна.
import { useEffect, useRef } from "react";
import { mountStarViz } from "./star-viz-engine";
import "./star-viz.css";

const SRC_BOOK =
  "Эх сурвалж: Хэвлэлийн Хүрээлэн, Мэдээлэл сургалтын алба. «Монголын хэвлэл мэдээлэл өнөөдөр», 2025 оны 12 сар";

function Key({ items }: { items: [4 | 6, string, string][] }) {
  return (
    <div className="key" aria-hidden>
      {items.map(([n, color, label]) => (
        <span key={label}>
          <svg viewBox="-9 -9 18 18">
            <path className={`k${n}`} fill={color} />
          </svg>
          {label}
        </span>
      ))}
    </div>
  );
}

export function StarViz() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return mountStarViz(ref.current);
  }, []);

  return (
    <section id="mv-viz" ref={ref} aria-label="Хэвлэлийн хүрээлэнгийн өгөгдөл">
      <div className="wrap">
        <section className="plate" aria-labelledby="mv-t1">
          <h2 id="mv-t1">Хамгийн түгээмэл зочилдог 10 мэдээллийн сайт</h2>
          <Key items={[[4, "#FFB547", "Улаанбаатар"], [6, "#6F86FF", "Орон нутаг"]]} />
          <div className="tools" data-chart="mv-c1" />
          <div className="chart" id="mv-c1" />
          <div className="tblwrap" id="tbl-mv-c1">
            <table className="data">
              <caption>Уншигчдын байршил, %</caption>
              <thead>
                <tr>
                  <th scope="col">Сайт</th>
                  <th scope="col">Улаанбаатар</th>
                  <th scope="col">Орон нутаг</th>
                </tr>
              </thead>
              <tbody id="mv-tb1" />
            </table>
          </div>
          <p className="src">{SRC_BOOK}</p>
        </section>

        <section className="plate" aria-labelledby="mv-t2">
          <h2 id="mv-t2">Мэдээллийн сайтаас уншдаг мэдээллийн төрөл</h2>
          <div className="tools" data-chart="mv-c2" />
          <div className="chart" id="mv-c2" />
          <div className="tblwrap" id="tbl-mv-c2">
            <table className="data">
              <caption>Мэдээллийн төрөл, %</caption>
              <thead>
                <tr>
                  <th scope="col">Төрөл</th>
                  <th scope="col">%</th>
                </tr>
              </thead>
              <tbody id="mv-tb2" />
            </table>
          </div>
          <p className="src">{SRC_BOOK}</p>
        </section>

        <section className="plate" aria-labelledby="mv-t3">
          <h2 id="mv-t3">Хиймэл оюуны хэрэглээ</h2>
          <Key
            items={[
              [4, "#FFB547", "Хиймэл оюуны хэрэглүүрийг мэдээлэл олж авах, бэлтгэхэд ашигладаг"],
              [6, "#6F86FF", "Хиймэл оюуны боловсруулсан мэдээллийг давхар шалгадаг"],
            ]}
          />
          <div className="tools" data-chart="mv-c3" />
          <div className="chart" id="mv-c3" />
          <div className="tblwrap" id="tbl-mv-c3">
            <table className="data">
              <caption>Хиймэл оюуны хэрэглээ, %</caption>
              <thead>
                <tr>
                  <th scope="col">Бүлэг</th>
                  <th scope="col">Ашигладаг</th>
                  <th scope="col">Давхар шалгадаг</th>
                </tr>
              </thead>
              <tbody id="mv-tb3" />
            </table>
          </div>
          <p className="src">
            Эх сурвалж: Хэвлэлийн Хүрээлэн, «Хэвлэл мэдээлэл, мэдээллийн суурь боловсролын үндэсний суурь судалгаа», 2026.
            Иргэд n=940. Иргэний нийгмийн бүлэг (n=100), төрийн албан хаагчид (n=160) нь зорилтот түүвэр тул
            ерөнхийлөхгүй.
          </p>
        </section>

      </div>
    </section>
  );
}
