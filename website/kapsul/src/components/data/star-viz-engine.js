// Одтой data viz-ийн d3 логик. StarViz.tsx-ээс root элементийг өгч дуудна.
// Буцаах функц нь observer, listener-үүдийг цэвэрлэнэ (React-ийн effect cleanup).
import * as d3 from "d3";

const SITES = [["Zarig.mn", 37], ["Ikon.mn", 59], ["Gogo.mn", 68], ["News.mn", 58], ["Zuv.mn", 43], ["Zogii.mn", 25], ["Medee.mn", 41], ["Urug.mn", 45], ["Mass.mn", 44], ["Tsahiur.mn", 43]];
const TYPES = [
  ["Цаг үеийн мэдээлэл", "Цаг үе", 34],
  ["Улс төр, эдийн засгийн мэдээлэл", "Улс төр, эдийн засаг", 22],
  ["Эрүүл мэнд, хобби, амьдрах ухааны зөвлөгөө", "Эрүүл мэнд, хобби", 9],
  ["Танин мэдэхүй, шинжлэх ухааны мэдээлэл", "Танин мэдэхүй", 8],
  ["Спортын мэдээлэл", "Спорт", 8],
  ["Энтертайнмент мэдээлэл", "Энтертайнмент", 8],
  ["Бусдын яриа, алдартай хүмүүсийн амьдрал, хошин шог, онигоо, сонин хачин", "Бусдын яриа", 7],
  ["Технологи, хөгжил дэвшил", "Технологи", 4],
];
const AI = [["Иргэд", 17, 26], ["Иргэний нийгмийн бүлэг", 51, 53], ["Төрийн албан хаагчид", 43, 51]];
// график бүрийг дэлгэц уншигчид нэг өгүүлбэрээр тайлбарлана
const SAY = {
  "mv-c1": "Арван сайтын долоо нь голдуу орон нутагт уншигддаг. Хамгийн их орон нутгийн уншигчтай нь Zogii.mn, 75 хувь. Хамгийн их Улаанбаатарын уншигчтай нь Gogo.mn, 68 хувь.",
  "mv-c2": "Мэдээллийн сайтаас уншдаг мэдээллийн 34 хувь нь цаг үеийн мэдээлэл, 22 хувь нь улс төр, эдийн засгийн мэдээлэл. Бусад төрөл тус бүр 9 хувиас ихгүй.",
  "mv-c3": "Иргэдийн 17 хувь нь хиймэл оюуныг мэдээлэл олж авахад ашигладаг, 26 хувь нь түүний мэдээллийг давхар шалгадаг. Иргэний нийгмийн бүлэгт 51 ба 53 хувь, төрийн албан хаагчдад 43 ба 51 хувь.",
};
const DUR = 600; // тэмдэг бүр 600ms дотор байрандаа очно
const DRAW = 2000; // 2-р графикийн хүрээг үзэг шиг зурна

// n хошуутай одны зам; түлхүүр (key) дээр ч мөн адил хэлбэр
export function starPath(n, L) {
  const w = n === 4 ? L * 0.16 : L * 0.3;
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n, b = a + Math.PI / n, c = a + (2 * Math.PI) / n;
    const p = [L * Math.cos(a), L * Math.sin(a)], q = [w * Math.cos(b), w * Math.sin(b)], r = [L * Math.cos(c), L * Math.sin(c)];
    d += (i ? "" : `M${p[0].toFixed(2)} ${p[1].toFixed(2)}`) + `Q${q[0].toFixed(2)} ${q[1].toFixed(2)} ${r[0].toFixed(2)} ${r[1].toFixed(2)}`;
  }
  return d + "Z";
}

export function mountStarViz(ROOT) {
  const $ = (id) => ROOT.querySelector("#" + id);
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = (n) => getComputedStyle(ROOT).getPropertyValue(n).trim();
  const BL = css("--blue"), AM = css("--amber"), ST = css("--star");

  ROOT.querySelectorAll(".k4").forEach((p) => p.setAttribute("d", starPath(4, 8.5)));
  ROOT.querySelectorAll(".k6").forEach((p) => p.setAttribute("d", starPath(6, 8.5)));

  // хүснэгтүүд (StrictMode-д давхар нэмэгдэхгүйн тулд эхлээд цэвэрлэнэ)
  const tb1 = d3.select($("mv-tb1")).html(""), tb2 = d3.select($("mv-tb2")).html(""), tb3 = d3.select($("mv-tb3")).html("");
  SITES.forEach(([s, u]) => tb1.append("tr").html(`<td>${s}</td><td>${u}%</td><td>${100 - u}%</td>`));
  TYPES.forEach(([n, , v]) => tb2.append("tr").html(`<td>${n}</td><td>${v}%</td>`));
  AI.forEach(([g, u, c]) => tb3.append("tr").html(`<td>${g}</td><td>${u}%</td><td>${c}%</td>`));

  let seed = 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  function base(id, w, h) {
    const host = d3.select($(id));
    host.selectAll("*").interrupt().remove();
    const svg = host.append("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("role", "group").attr("aria-label", SAY[id]);
    const defs = svg.append("defs");
    // гэрэлтэлт = radial gradient (frame бүрт blur тооцохгүй, хямд)
    [[BL, "b"], [AM, "a"], [ST, "s"]].forEach(([c, k]) => {
      const g = defs.append("radialGradient").attr("id", `${id}h${k}`);
      g.append("stop").attr("offset", 0).attr("stop-color", c).attr("stop-opacity", 0.55);
      g.append("stop").attr("offset", 0.35).attr("stop-color", c).attr("stop-opacity", 0.18);
      g.append("stop").attr("offset", 1).attr("stop-color", c).attr("stop-opacity", 0);
    });
    const dust = svg.append("g").attr("class", "dust").attr("aria-hidden", "true");
    seed = id.charCodeAt(id.length - 1) * 97;
    for (let i = 0; i < Math.round((w * h) / 9000); i++)
      dust.append("circle").attr("cx", rnd() * w).attr("cy", rnd() * h).attr("r", 0.4 + rnd() * 0.7).attr("opacity", 0.06 + rnd() * 0.12);
    svg.on("click", (e) => {
      if (!e.target.closest(".pt") && svg.node().__clear) svg.node().__clear();
    });
    return { svg, defs, id };
  }

  function star(parent, o, x, y, color, haloKey, n, size, label, big) {
    const g = parent.append("g").attr("class", "pt").attr("transform", `translate(${x},${y})`).attr("tabindex", 0).attr("role", "button").attr("aria-pressed", "false").attr("aria-label", label);
    const hv = g.append("g").attr("class", "hv");
    const d = (rnd() * -4.2).toFixed(2) + "s";
    hv.append("circle").attr("class", "halo").attr("r", size * (big ? 3.4 : 2.6)).attr("fill", `url(#${o.id}h${haloKey})`).style("animation-delay", d);
    const tw = hv.append("g").attr("class", "tw").style("animation-delay", d);
    if (big) {
      const R = size * 2.3;
      tw.append("path").attr("d", `M0 ${-R}V${R}M${-R} 0H${R}`).attr("stroke", color).attr("stroke-width", 0.9).attr("opacity", 0.6);
    }
    tw.append("path").attr("d", starPath(n, size)).attr("fill", color);
    tw.append("circle").attr("r", size * 0.2).attr("fill", "#fff");
    g.append("circle").attr("class", "ring").attr("r", Math.max(14, size * 1.5)).attr("fill", "none").attr("stroke", "var(--text)").attr("stroke-width", 1.5);
    g.append("circle").attr("r", Math.max(16, size * 1.5)).attr("fill", "transparent");
    return g;
  }

  const count = (sel, to, fmt, dur, delay) => {
    if (RM || !dur) {
      sel.text(fmt(to));
      return;
    }
    sel.text(fmt(0)).transition("count").delay(delay).duration(dur).ease(d3.easeCubicOut).tween("text", function () {
      const i = d3.interpolateNumber(0, to);
      return (t) => (this.textContent = fmt(Math.round(i(t))));
    });
  };

  function interactive(svg, pts) {
    let pinned = null;
    const show = (k) => {
      svg.classed("dim", k != null);
      pts.forEach((p) => {
        p.g.classed("on", p.k === k).attr("aria-pressed", p.k === pinned);
        p.v.forEach((v) => v.classed("on", p.k === k));
      });
    };
    svg.node().__clear = () => {
      pinned = null;
      show(null);
    };
    pts.forEach((p) => {
      p.g
        .on("pointerenter", (e) => { if (e.pointerType === "mouse") show(p.k); })
        .on("pointerleave", (e) => { if (e.pointerType === "mouse") show(pinned); })
        .on("click", () => { pinned = pinned === p.k ? null : p.k; show(pinned); })
        .on("focus", () => show(p.k))
        .on("blur", () => show(pinned))
        .on("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pinned = pinned === p.k ? null : p.k;
            show(pinned);
          }
          if (e.key === "Escape") {
            pinned = null;
            show(null);
          }
        });
    });
  }

  /* 1. Сайтууд: Улаанбаатар ба орон нутаг */
  function draw1(animate) {
    const el = $("mv-c1");
    if (!el || !el.clientWidth) return;
    const W = el.clientWidth, mob = W < 560;
    const data = SITES.map(([s, u]) => ({ s, u, r: 100 - u })).sort((a, b) => b.r - a.r);
    const rowH = mob ? 46 : 42, top = 40, bottom = 48, nameW = mob ? 0 : 116, padR = mob ? 14 : 60, padL = mob ? 14 : 28;
    const H = top + data.length * rowH + bottom;
    const o = base("mv-c1", W, H);
    const { svg, defs } = o;
    const x = d3.scaleLinear().domain([0, 100]).range([nameW + padL, W - padR]);
    const y = (i) => top + i * rowH + (mob ? rowH * 0.64 : rowH / 2);
    [0, 25, 50, 75, 100].forEach((v) =>
      svg.append("line").attr("x1", x(v)).attr("x2", x(v)).attr("y1", top - 8).attr("y2", H - bottom + 6)
        .attr("stroke", v === 50 ? "rgba(165,182,225,.28)" : "var(--grid)").attr("stroke-dasharray", v === 50 ? "2 4" : null),
    );
    [[0, "100%"], [25, "75%"], [50, "50 / 50"], [75, "75%"], [100, "100%"]].forEach(([v, t]) =>
      svg.append("text").attr("class", "axl").attr("x", x(v)).attr("y", H - bottom + 26).attr("text-anchor", v === 0 ? "start" : v === 100 ? "end" : "middle").text(t),
    );
    svg.append("text").attr("class", "axl").attr("x", x(0)).attr("y", top - 18).text("← Улаанбаатар");
    svg.append("text").attr("class", "axl").attr("x", x(100)).attr("y", top - 18).attr("text-anchor", "end").text("Орон нутаг →");
    const pts = [];
    data.forEach((d, i) => {
      const rural = d.r > 50, col = rural ? BL : AM, cx = x(d.r), cy = y(i), gid = "mv-g1_" + i, ext = d.s === "Zogii.mn" || d.s === "Gogo.mn";
      const gr = defs.append("linearGradient").attr("id", gid).attr("gradientUnits", "userSpaceOnUse").attr("x1", x(50)).attr("x2", cx).attr("y1", 0).attr("y2", 0);
      gr.append("stop").attr("offset", 0).attr("stop-color", col).attr("stop-opacity", 0);
      gr.append("stop").attr("offset", 1).attr("stop-color", col).attr("stop-opacity", 0.9);
      svg.append("text").attr("class", "nm").attr("x", mob ? x(0) : 0).attr("y", mob ? cy - 13 : cy + 4.5).text(d.s);
      svg.append("line").attr("x1", x(0)).attr("x2", x(100)).attr("y1", cy).attr("y2", cy).attr("stroke", "var(--grid)");
      const stem = svg.append("line").attr("x1", x(50)).attr("y1", cy).attr("y2", cy).attr("stroke", `url(#${gid})`).attr("stroke-width", 1.5).attr("x2", animate ? x(50) : cx);
      const g = star(svg, o, animate ? x(50) : cx, cy, col, rural ? "b" : "a", rural ? 6 : 4, ext ? 10 : 8, `${d.s}: Улаанбаатар ${d.u}%, орон нутаг ${d.r}%`, ext);
      const v = svg.append("text").attr("class", "val").attr("x", rural ? cx + 16 : cx - 16).attr("y", cy + 6).attr("text-anchor", rural ? "start" : "end").style("font-size", mob ? "17px" : "19px");
      const dl = i * 30;
      if (animate) {
        const t = d3.transition().delay(dl).duration(DUR).ease(d3.easeCubicOut);
        stem.transition(t).attr("x2", cx);
        g.transition(t).attr("transform", `translate(${cx},${cy})`);
      }
      count(v, rural ? d.r : d.u, (n) => n + "%", animate ? DUR : 0, dl);
      pts.push({ k: i, g, v: [v] });
    });
    interactive(svg, pts);
  }

  /* 2. Мэдээллийн төрөл: радар хэлбэр */
  function draw2(animate) {
    const el = $("mv-c2");
    if (!el || !el.clientWidth) return;
    const W = el.clientWidth, mob = W < 560, S = Math.min(W, 620), pad = mob ? 96 : 104, R = S / 2 - pad;
    const H = S, cx = W / 2, cy = S / 2, N = TYPES.length;
    const o = base("mv-c2", W, H);
    const { svg, defs } = o;
    const r = d3.scaleLinear().domain([0, 40]).range([0, R]), ang = (i) => (i * 2 * Math.PI) / N;
    const rg = defs.append("radialGradient").attr("id", "mv-fill2").attr("gradientUnits", "userSpaceOnUse").attr("cx", cx).attr("cy", cy).attr("r", r(34));
    rg.append("stop").attr("offset", 0).attr("stop-color", BL).attr("stop-opacity", 0.03);
    rg.append("stop").attr("offset", 1).attr("stop-color", BL).attr("stop-opacity", 0.32);
    const g = svg.append("g").attr("transform", `translate(${cx},${cy})`);
    [10, 20, 30, 40].forEach((v) => {
      g.append("circle").attr("r", r(v)).attr("fill", "none").attr("stroke", "var(--grid)").attr("stroke-dasharray", v === 40 ? null : "2 4");
      const la = -Math.PI / 2 - Math.PI / N;
      if (!mob || v % 20 === 0)
        g.append("text").attr("class", "axl").attr("x", Math.cos(la) * r(v) - 3).attr("y", Math.sin(la) * r(v) - 3).attr("text-anchor", "end").style("font-size", "11px").text(v + "%");
    });
    TYPES.forEach((t, i) => {
      const a = ang(i) - Math.PI / 2;
      g.append("line").attr("x2", Math.cos(a) * r(40)).attr("y2", Math.sin(a) * r(40)).attr("stroke", "var(--grid)");
    });
    const line = d3.lineRadial().angle((d) => ang(d.i)).radius((d) => r(d.v)).curve(d3.curveCatmullRomClosed.alpha(0.5));
    // хаалттай Catmull-Rom зам 2-р цэгээс эхэлдэг тул сүүлийн цэгийг эхэнд өгнө: үзэг дээд талаас (34%) эхэлнэ
    const PTS = TYPES.map((t, i) => ({ i, v: t[2] }));
    const D = line([PTS[N - 1], ...PTS.slice(0, N - 1)]);
    // төвөөс гарах удаан долгион
    if (!RM) g.append("circle").attr("class", "ripple").attr("r", r(40)).attr("fill", "none").attr("stroke", BL).attr("stroke-width", 1);
    const shape = g.append("g");
    const fill = shape.append("path").classed("breathe", !(animate && !RM)).attr("d", D).attr("fill", "url(#mv-fill2)");
    const outline = shape.append("path").attr("d", D).attr("pathLength", 1000).attr("fill", "none").attr("stroke", BL).attr("stroke-width", 1.5).attr("stroke-opacity", 0.9);
    // хүрээг тойрон гүйх гэрэл: зөөлөн өргөн мөр + тод цөм
    const flowG = shape.append("g").attr("class", "flowg").style("opacity", animate && !RM ? 0 : 1);
    if (!RM) {
      flowG.append("path").attr("class", "flow").attr("d", D).attr("pathLength", 1000).attr("fill", "none").attr("stroke", BL).attr("stroke-width", 6).attr("stroke-opacity", 0.25).attr("stroke-linecap", "round").attr("stroke-dasharray", "70 930");
      flowG.append("path").attr("class", "flow").attr("d", D).attr("pathLength", 1000).attr("fill", "none").attr("stroke", ST).attr("stroke-width", 1.8).attr("stroke-linecap", "round").attr("stroke-dasharray", "40 960").style("animation-delay", "-.15s");
    }
    const pts = [];
    TYPES.forEach((t, i) => {
      const a = ang(i) - Math.PI / 2, px = Math.cos(a) * r(t[2]), py = Math.sin(a) * r(t[2]), key = i === 0;
      const s = star(g, o, px, py, key ? ST : BL, key ? "s" : "b", key ? 4 : 6, key ? (mob ? 13 : 17) : mob ? 6 : 7, `${t[0]}: ${t[2]}%`, key);
      if (animate && !RM) s.style("opacity", 0).transition("in").delay((DRAW * i) / N + 120).duration(400).style("opacity", 1);
      const lx = Math.cos(a) * (R + (mob ? 16 : 22)), ly = Math.sin(a) * (R + (mob ? 16 : 22));
      const anchor = Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
      const yo = Math.sin(a) > 0.6 ? 16 : Math.sin(a) < -0.6 ? -18 : 0;
      const v = g.append("text").attr("class", "val").attr("x", lx).attr("y", ly + yo).attr("text-anchor", anchor).style("font-size", key ? (mob ? "32px" : "44px") : mob ? "18px" : "22px");
      const nm = g.append("text").attr("class", "nm").attr("x", lx).attr("y", ly + yo + (mob ? 15 : 18)).attr("text-anchor", anchor).style("font-size", mob ? "12px" : "13px");
      t[1].split(", ").forEach((w, j, arr) => nm.append("tspan").attr("x", lx).attr("dy", j ? (mob ? 14 : 15) : 0).text(w + (j < arr.length - 1 ? "," : "")));
      count(v, t[2], (n) => n + "%", animate ? DUR : 0, 0);
      pts.push({ k: i, g: s, v: [v] });
    });
    interactive(svg, pts);
    if (animate && !RM) {
      // үзэг: хүрээ дээрээс эхлэн өөрөө зурагдаж, тод цэг тэргүүлнэ, дараа нь дүүргэлт гэрэлтэнэ
      const node = outline.node(), total = node.getTotalLength();
      const penHalo = g.append("circle").attr("r", 12).attr("fill", "url(#mv-c2hs)");
      const pen = g.append("circle").attr("r", 3.2).attr("fill", "#fff");
      outline.attr("stroke-dasharray", "1000 1000").attr("stroke-dashoffset", 1000)
        .transition().duration(DRAW).ease(d3.easeSinInOut).attr("stroke-dashoffset", 0)
        .tween("pen", () => (t) => {
          const q = node.getPointAtLength(t * total);
          pen.attr("cx", q.x).attr("cy", q.y);
          penHalo.attr("cx", q.x).attr("cy", q.y);
        })
        .on("end", () => {
          outline.attr("stroke-dasharray", null);
          pen.transition().duration(500).attr("r", 0).remove();
          penHalo.transition().duration(500).style("opacity", 0).remove();
          flowG.transition().duration(800).style("opacity", 1);
        });
      fill.style("opacity", 0).transition().delay(DRAW * 0.55).duration(900).style("opacity", 1)
        .on("end", function () { d3.select(this).style("opacity", null).classed("breathe", true); });
    }
  }

  /* 3. Хиймэл оюун: ашигладаг ба давхар шалгадаг */
  function draw3(animate) {
    const el = $("mv-c3");
    if (!el || !el.clientWidth) return;
    const W = el.clientWidth, mob = W < 560;
    const rowH = mob ? 112 : 80, top = 24, bottom = 44, nameW = mob ? 0 : 190, padR = 24;
    const H = top + AI.length * rowH + bottom;
    const o = base("mv-c3", W, H);
    const { svg, defs } = o;
    const x = d3.scaleLinear().domain([0, 100]).range([nameW + 14, W - padR]);
    const y = (i) => top + i * rowH + (mob ? rowH * 0.68 : rowH * 0.55);
    [0, 25, 50, 75, 100].forEach((v) => {
      svg.append("line").attr("x1", x(v)).attr("x2", x(v)).attr("y1", top - 6).attr("y2", H - bottom + 6).attr("stroke", "var(--grid)");
      svg.append("text").attr("class", "axl").attr("x", x(v)).attr("y", H - bottom + 26).attr("text-anchor", v === 0 ? "start" : v === 100 ? "end" : "middle").text(v + "%");
    });
    const pts = [];
    AI.forEach(([gname, u, c], i) => {
      const cy = y(i), gid = "mv-g3_" + i;
      svg.append("text").attr("class", "nm").attr("x", mob ? x(0) : 0).attr("y", mob ? cy - 50 : cy + 4.5).text(gname);
      const fg = defs.append("linearGradient").attr("id", gid).attr("gradientUnits", "userSpaceOnUse").attr("x1", x(0)).attr("x2", x(c)).attr("y1", 0).attr("y2", 0);
      fg.append("stop").attr("offset", 0).attr("stop-color", BL).attr("stop-opacity", 0);
      fg.append("stop").attr("offset", 1).attr("stop-color", BL).attr("stop-opacity", 0.35);
      const fade = svg.append("rect").attr("x", x(0)).attr("y", cy - 1).attr("height", 2).attr("fill", `url(#${gid})`).attr("width", animate ? 0 : x(c) - x(0));
      const link = svg.append("line").attr("x1", x(u)).attr("x2", animate ? x(u) : x(c)).attr("y1", cy).attr("y2", cy).attr("stroke", BL).attr("stroke-opacity", 0.45).attr("stroke-width", 1.5);
      const su = star(svg, o, x(u), cy, AM, "a", 4, 8, `${gname}: ашигладаг ${u}%`);
      const sc = star(svg, o, animate ? x(u) : x(c), cy, BL, "b", 6, 9, `${gname}: давхар шалгадаг ${c}%`);
      const close = Math.abs(x(c) - x(u)) < 70;
      const lu = svg.append("text").attr("class", "val").attr("x", x(u) + (close ? -12 : 0)).attr("y", cy - 18).attr("text-anchor", close ? "end" : "middle").style("font-size", mob ? "18px" : "22px");
      const lc = svg.append("text").attr("class", "val").attr("x", x(c) + (close ? 12 : 0)).attr("y", cy - 18).attr("text-anchor", close ? "start" : "middle").style("font-size", mob ? "18px" : "22px");
      const dl = i * 60;
      if (animate) {
        const t = d3.transition().delay(dl).duration(DUR).ease(d3.easeCubicOut);
        link.transition(t).attr("x2", x(c));
        sc.transition(t).attr("transform", `translate(${x(c)},${cy})`);
        fade.transition(t).attr("width", x(c) - x(0));
      }
      count(lu, u, (n) => n + "%", animate ? DUR : 0, dl);
      count(lc, c, (n) => n + "%", animate ? DUR : 0, dl);
      pts.push({ k: "u" + i, g: su, v: [lu] }, { k: "c" + i, g: sc, v: [lc] });
    });
    interactive(svg, pts);
  }

  const draws = { "mv-c1": draw1, "mv-c2": draw2, "mv-c3": draw3 }, seen = {};

  /* харах хэлбэр: ижил өгөгдлийг график эсвэл хүснэгтээр */
  const ICON_C = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M2 13h12"/><path d="M4 10l3-3 2 2 4-5"/></svg>';
  const ICON_T = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6.5h12M2 9.8h12M6.5 3v10"/></svg>';
  ROOT.querySelectorAll(".tools").forEach((t) => {
    const id = t.dataset.chart, plate = t.closest(".plate");
    t.innerHTML = "";
    plate.classList.remove("as-table");
    const box = document.createElement("div");
    box.className = "view";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "Харах хэлбэр");
    const bc = document.createElement("button");
    bc.type = "button";
    bc.setAttribute("aria-pressed", "true");
    bc.innerHTML = ICON_C + "<span>График</span>";
    const bt = document.createElement("button");
    bt.type = "button";
    bt.setAttribute("aria-pressed", "false");
    bt.setAttribute("aria-controls", "tbl-" + id);
    bt.innerHTML = ICON_T + "<span>Хүснэгт</span>";
    const set = (table) => {
      plate.classList.toggle("as-table", table);
      bc.setAttribute("aria-pressed", String(!table));
      bt.setAttribute("aria-pressed", String(table));
      if (!table) draws[id](false);
    };
    bc.addEventListener("click", () => set(false));
    bt.addEventListener("click", () => set(true));
    box.append(bc, bt);
    t.append(box);
  });

  Object.keys(draws).forEach((id) => draws[id](false));
  const io = new IntersectionObserver(
    (es) =>
      es.forEach((e) => {
        const id = e.target.id;
        e.target.classList.toggle("off", !e.isIntersecting);
        if (e.isIntersecting && !seen[id] && !RM) {
          seen[id] = 1;
          draws[id](true);
        }
      }),
    { threshold: 0.25 },
  );
  Object.keys(draws).forEach((id) => io.observe($(id)));

  let lastW = innerWidth, tm;
  const onResize = () => {
    clearTimeout(tm);
    tm = setTimeout(() => {
      if (innerWidth !== lastW) {
        lastW = innerWidth;
        Object.keys(draws).forEach((id) => draws[id](false));
      }
    }, 150);
  };
  addEventListener("resize", onResize);
  let alive = true;
  if (document.fonts)
    document.fonts.ready.then(() => {
      if (alive) Object.keys(draws).forEach((id) => { if (!seen[id]) draws[id](false); });
    });

  return () => {
    alive = false;
    io.disconnect();
    clearTimeout(tm);
    removeEventListener("resize", onResize);
    Object.keys(draws).forEach((id) => d3.select($(id)).selectAll("*").interrupt().remove());
  };
}
