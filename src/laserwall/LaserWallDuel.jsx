import { useState, useEffect, useRef, useCallback } from "react";

/* ═══════════════════ WORLD ═══════════════════ */
const VW = 1000, VH = 600;                      // viewport canvas
const WORLD = { w: 2000, h: 1100, ground: 950 };
const WALL = { x1: 350, x2: 1650, y1: 120, y2: 950 }; // the big drawing wall
const TBOX = { x: 690, y: 200, s: 620 };        // where templates are placed on the wall
const BLOCK_R = 52;                              // runner hitbox (matches inflatable suit)
const WIN_THRESHOLD = 80;

/* ═══════════════════ TEMPLATE SHAPES ═══════════════════ */
const C = (cx, cy, r, n = 26) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r]);
const ell = (cx, cy, rx, ry, n = 26) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * rx, cy + Math.sin((i / n) * Math.PI * 2) * ry]);
const star = (cx, cy, R, r) => { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r : R; p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } p.push(p[0].slice()); return p; };
const heart = () => { const p = []; for (let i = 0; i <= 40; i++) { const t = (i / 40) * Math.PI * 2; p.push([0.5 + 0.028 * 16 * Math.pow(Math.sin(t), 3), 0.45 - 0.028 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]); } return p; };

const TEMPLATES = [
  { name: "House", icon: "🏠", diff: "easy", lines: [
    [[0.2, 0.9], [0.2, 0.45], [0.5, 0.2], [0.8, 0.45], [0.8, 0.9], [0.2, 0.9]],
    [[0.45, 0.9], [0.45, 0.68], [0.58, 0.68], [0.58, 0.9]],
  ]},
  { name: "Rocket", icon: "🚀", diff: "easy", lines: [
    [[0.5, 0.08], [0.63, 0.28], [0.63, 0.7], [0.37, 0.7], [0.37, 0.28], [0.5, 0.08]],
    [[0.37, 0.7], [0.26, 0.9], [0.37, 0.8]], [[0.63, 0.7], [0.74, 0.9], [0.63, 0.8]],
    C(0.5, 0.42, 0.07, 16),
  ]},
  { name: "Lightning", icon: "⚡", diff: "easy", lines: [
    [[0.55, 0.05], [0.35, 0.5], [0.5, 0.5], [0.4, 0.95], [0.68, 0.42], [0.52, 0.42], [0.65, 0.05], [0.55, 0.05]],
  ]},
  { name: "Crown", icon: "👑", diff: "easy", lines: [
    [[0.15, 0.82], [0.15, 0.42], [0.32, 0.6], [0.5, 0.28], [0.68, 0.6], [0.85, 0.42], [0.85, 0.82], [0.15, 0.82]],
  ]},
  { name: "Star", icon: "⭐", diff: "medium", lines: [star(0.5, 0.52, 0.42, 0.18)] },
  { name: "Heart", icon: "❤️", diff: "medium", lines: [heart()] },
  { name: "Cat", icon: "🐱", diff: "medium", lines: [
    C(0.5, 0.55, 0.28),
    [[0.31, 0.38], [0.25, 0.1], [0.45, 0.3]], [[0.69, 0.38], [0.75, 0.1], [0.55, 0.3]],
    [[0.2, 0.55], [0.05, 0.5]], [[0.2, 0.62], [0.05, 0.64]],
    [[0.8, 0.55], [0.95, 0.5]], [[0.8, 0.62], [0.95, 0.64]],
  ]},
  { name: "Robot", icon: "🤖", diff: "medium", lines: [
    [[0.35, 0.14], [0.65, 0.14], [0.65, 0.38], [0.35, 0.38], [0.35, 0.14]],
    [[0.5, 0.14], [0.5, 0.04]],
    [[0.3, 0.44], [0.7, 0.44], [0.7, 0.86], [0.3, 0.86], [0.3, 0.44]],
    [[0.3, 0.5], [0.14, 0.7]], [[0.7, 0.5], [0.86, 0.7]],
  ]},
  { name: "Controller", icon: "🎮", diff: "hard", lines: [
    [[0.15, 0.38], [0.85, 0.38], [0.92, 0.55], [0.85, 0.7], [0.62, 0.7], [0.5, 0.58], [0.38, 0.7], [0.15, 0.7], [0.08, 0.55], [0.15, 0.38]],
    [[0.22, 0.54], [0.34, 0.54]], [[0.28, 0.48], [0.28, 0.6]],
    C(0.66, 0.5, 0.035, 12), C(0.75, 0.57, 0.035, 12),
  ]},
  { name: "UFO", icon: "🛸", diff: "hard", lines: [
    ell(0.5, 0.55, 0.34, 0.12),
    C(0.5, 0.44, 0.16, 20).slice(10, 27),
    [[0.32, 0.66], [0.26, 0.82]], [[0.5, 0.68], [0.5, 0.85]], [[0.68, 0.66], [0.74, 0.82]],
  ]},
  { name: "Magic Rune", icon: "🔮", diff: "hard", lines: [
    [[0.5, 0.08], [0.87, 0.82], [0.13, 0.82], [0.5, 0.08]],
    C(0.5, 0.56, 0.16), [[0.5, 0.26], [0.5, 0.86]],
  ]},
  { name: "Dinosaur", icon: "🦖", diff: "hard", lines: [
    [[0.15, 0.85], [0.2, 0.6], [0.35, 0.55], [0.45, 0.35], [0.55, 0.2], [0.7, 0.25], [0.68, 0.35], [0.55, 0.4], [0.55, 0.55], [0.75, 0.6], [0.85, 0.55], [0.8, 0.7], [0.6, 0.72], [0.55, 0.85], [0.45, 0.85], [0.42, 0.7], [0.3, 0.72], [0.28, 0.85], [0.15, 0.85]],
  ]},
  { name: "Snowflake", icon: "❄️", diff: "medium", lines: (() => {
    const L = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3, ca = Math.cos(a), sa = Math.sin(a);
      L.push([[0.5, 0.5], [0.5 + ca * 0.38, 0.5 + sa * 0.38]]);
      const bx = 0.5 + ca * 0.24, by = 0.5 + sa * 0.24;
      L.push([[bx, by], [bx + Math.cos(a + 0.7) * 0.1, by + Math.sin(a + 0.7) * 0.1]]);
      L.push([[bx, by], [bx + Math.cos(a - 0.7) * 0.1, by + Math.sin(a - 0.7) * 0.1]]);
    }
    return L;
  })() },
  { name: "Snowman", icon: "⛄", diff: "easy", lines: [
    C(0.5, 0.78, 0.17), C(0.5, 0.5, 0.13), C(0.5, 0.28, 0.1),
    [[0.42, 0.18], [0.58, 0.18], [0.58, 0.1], [0.42, 0.1], [0.42, 0.18]],
    [[0.37, 0.48], [0.2, 0.38]], [[0.63, 0.48], [0.8, 0.38]],
  ]},
  { name: "Sword", icon: "⚔️", diff: "medium", lines: [
    [[0.5, 0.05], [0.56, 0.12], [0.56, 0.6], [0.44, 0.6], [0.44, 0.12], [0.5, 0.05]],
    [[0.3, 0.63], [0.7, 0.63]], [[0.3, 0.68], [0.7, 0.68]], [[0.3, 0.63], [0.3, 0.68]], [[0.7, 0.63], [0.7, 0.68]],
    [[0.47, 0.68], [0.47, 0.88], [0.53, 0.88], [0.53, 0.68]],
    C(0.5, 0.92, 0.045, 14),
  ]},
  { name: "Alien", icon: "👽", diff: "medium", lines: [
    ell(0.5, 0.45, 0.24, 0.34),
    ell(0.41, 0.42, 0.07, 0.1), ell(0.59, 0.42, 0.07, 0.1),
    [[0.44, 0.66], [0.56, 0.66]],
    [[0.36, 0.14], [0.3, 0.03]], [[0.64, 0.14], [0.7, 0.03]],
  ]},
  { name: "Lollipop", icon: "🍭", diff: "easy", lines: [
    C(0.5, 0.34, 0.24),
    C(0.5, 0.34, 0.13, 20),
    [[0.5, 0.58], [0.5, 0.95]],
  ]},
  { name: "Dragon", icon: "🐉", diff: "hard", lines: [
    [[0.1, 0.7], [0.22, 0.55], [0.35, 0.6], [0.42, 0.45], [0.55, 0.35], [0.7, 0.3], [0.82, 0.2], [0.9, 0.28], [0.82, 0.34], [0.72, 0.42], [0.6, 0.5], [0.62, 0.62], [0.5, 0.58], [0.4, 0.7], [0.28, 0.72], [0.2, 0.85], [0.12, 0.82], [0.1, 0.7]],
    [[0.42, 0.45], [0.38, 0.3], [0.48, 0.4]], [[0.55, 0.35], [0.53, 0.2], [0.62, 0.32]],
  ]},
];

const TPL = Object.fromEntries(TEMPLATES.map((t) => [t.name, t]));

/* ═══════════════════ MAPS — each with its own look & its own drawings ═══════════════════ */
const MAPS = [
  { name: "Neon Studio", icon: "🎨", desc: "clean cyan gallery · classic shapes", glow: "rgba(56,199,255,.55)",
    sky: ["#0b0d1a", "#131629"], wall: ["#181d33", "#12162a"], edge: "#38c7ff", ground: "#4dff9e", fx: "sparkle",
    tpls: ["House", "Rocket", "Star", "Heart", "Controller"] },
  { name: "Thunder Peak", icon: "⚡", desc: "storm sky · lightning strikes · mystic shapes", glow: "rgba(168,107,255,.55)",
    sky: ["#0d0a1e", "#1c1038"], wall: ["#1c1533", "#141026"], edge: "#a86bff", ground: "#a86bff", fx: "lightning",
    tpls: ["Lightning", "Crown", "Magic Rune", "Sword"] },
  { name: "Frost Gallery", icon: "❄️", desc: "falling snow · icy wall · winter drawings", glow: "rgba(160,220,255,.55)",
    sky: ["#08141f", "#0e2438"], wall: ["#14293d", "#0e1f30"], edge: "#9fdcff", ground: "#9fdcff", fx: "snow",
    tpls: ["Snowflake", "Snowman", "Star", "Heart"] },
  { name: "Lava Forge", icon: "🌋", desc: "rising embers · molten glow · beast shapes", glow: "rgba(255,120,50,.55)",
    sky: ["#170a05", "#331408"], wall: ["#2b160c", "#1e0f08"], edge: "#ff7a2f", ground: "#ff7a2f", fx: "ember",
    tpls: ["Dragon", "Dinosaur", "Sword", "Crown"] },
  { name: "Space Dock", icon: "🛰️", desc: "twinkling stars · deep space · sci-fi shapes", glow: "rgba(140,160,255,.5)",
    sky: ["#040510", "#0a0c22"], wall: ["#121631", "#0c0f24"], edge: "#8ca0ff", ground: "#8ca0ff", fx: "stars",
    tpls: ["UFO", "Rocket", "Robot", "Alien"] },
  { name: "Candy Wall", icon: "🍬", desc: "floating bubbles · pink dream · sweet shapes", glow: "rgba(255,120,190,.55)",
    sky: ["#1c0a16", "#33122a"], wall: ["#2e1428", "#22101f"], edge: "#ff78be", ground: "#ff78be", fx: "bubble",
    tpls: ["Lollipop", "Heart", "Cat", "Snowman"] },
];

function sampleTemplate(tpl) {
  const pts = [];
  for (const line of tpl.lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const [x1, y1] = line[i], [x2, y2] = line[i + 1];
      const ax = TBOX.x + x1 * TBOX.s, ay = TBOX.y + y1 * TBOX.s;
      const bx = TBOX.x + x2 * TBOX.s, by = TBOX.y + y2 * TBOX.s;
      const d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.floor(d / 7));
      for (let k = 0; k < n; k++) pts.push({ x: ax + ((bx - ax) * k) / n, y: ay + ((by - ay) * k) / n, hit: false });
    }
  }
  return pts;
}

function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L)) : 0;
  return { d: Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t)), t };
}

const rating = (a) => (a >= 96 ? ["EXCELLENT", "#4dff9e"] : a >= 84 ? ["GREAT", "#38c7ff"] : a >= WIN_THRESHOLD ? ["GOOD", "#ffcf3f"] : ["FAILED", "#ff4d5a"]);

/* ═══════════════════ ANIMATED MAP CARD ═══════════════════ */
function MapCard({ i, selected, onSelect }) {
  const ref = useRef(null);
  useEffect(() => {
    const cvs = ref.current; if (!cvs) return;
    const map = MAPS[i];
    const pool = map.tpls.map((n) => TPL[n]).filter(Boolean);
    const items = []; let boltT = 1 + Math.random() * 2, flash = 0, raf;
    const w = 230, h = 130, gr = 108;
    const wallR = { x: 30, y: 16, w: 170, h: 92 };
    const tick = (ts) => {
      raf = requestAnimationFrame(tick);
      const t = ts / 1000, g = cvs.getContext("2d");
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, map.sky[0]); bg.addColorStop(1, map.sky[1]);
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      // fx
      if (map.fx === "snow" && Math.random() < 0.4) items.push({ t: "s", x: Math.random() * w, y: 0, vy: 0.6 + Math.random() * 0.6 });
      if (map.fx === "ember" && Math.random() < 0.3) items.push({ t: "e", x: Math.random() * w, y: gr, vy: -0.5 - Math.random() * 0.8, life: 60 });
      if (map.fx === "bubble" && Math.random() < 0.15) items.push({ t: "b", x: Math.random() * w, y: gr, vy: -0.4, r: 2 + Math.random() * 4, life: 90 });
      if (map.fx === "sparkle" && Math.random() < 0.1) items.push({ t: "p", x: Math.random() * w, y: Math.random() * gr, life: 50 });
      if (map.fx === "stars" && Math.random() < 0.1 && items.length < 30) items.push({ t: "st", x: Math.random() * w, y: Math.random() * gr * 0.9, life: 120 });
      if (map.fx === "lightning") { boltT -= 0.016; if (boltT <= 0) { boltT = 2.5 + Math.random() * 3; flash = 0.5; } }
      for (let k = items.length - 1; k >= 0; k--) {
        const f = items[k];
        if (f.t === "s") { f.y += f.vy; g.fillStyle = "rgba(220,240,255,.8)"; g.fillRect(f.x, f.y, 1.6, 1.6); if (f.y > h) items.splice(k, 1); }
        else if (f.t === "e") { f.y += f.vy; f.life--; g.fillStyle = "rgba(255,150,60,.8)"; g.fillRect(f.x, f.y, 2, 2); if (f.life <= 0) items.splice(k, 1); }
        else if (f.t === "b") { f.y += f.vy; f.life--; g.strokeStyle = "rgba(255,150,200,.5)"; g.beginPath(); g.arc(f.x, f.y, f.r, 0, 7); g.stroke(); if (f.life <= 0) items.splice(k, 1); }
        else if (f.t === "p") { f.life--; g.fillStyle = "rgba(120,220,255," + f.life / 60 + ")"; g.fillRect(f.x, f.y, 2, 2); if (f.life <= 0) items.splice(k, 1); }
        else if (f.t === "st") { f.life--; g.globalAlpha = 0.3 + 0.6 * Math.abs(Math.sin(t * 2 + f.x)); g.fillStyle = "#dfe6ff"; g.fillRect(f.x, f.y, 1.8, 1.8); g.globalAlpha = 1; if (f.life <= 0) items.splice(k, 1); }
      }
      if (flash > 0) { g.fillStyle = "rgba(190,160,255," + flash * 0.35 + ")"; g.fillRect(0, 0, w, h); flash -= 0.04; }
      // ground
      g.shadowColor = map.ground; g.shadowBlur = 6;
      g.strokeStyle = map.ground; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(4, gr); g.lineTo(w - 4, gr); g.stroke();
      // wall
      const wgd = g.createLinearGradient(0, wallR.y, 0, wallR.y + wallR.h);
      wgd.addColorStop(0, map.wall[0]); wgd.addColorStop(1, map.wall[1]);
      g.fillStyle = wgd; g.fillRect(wallR.x, wallR.y, wallR.w, wallR.h);
      g.strokeStyle = map.edge; g.lineWidth = 2; g.shadowColor = map.edge; g.shadowBlur = 8;
      g.strokeRect(wallR.x, wallR.y, wallR.w, wallR.h);
      g.shadowBlur = 0;
      // cycle through the map's own drawings
      const tpl = pool[Math.floor(t / 2.6) % pool.length];
      const bx = wallR.x + wallR.w / 2 - 34, by = wallR.y + wallR.h / 2 - 34, bs = 68;
      g.setLineDash([5, 4]); g.lineDashOffset = -t * 16;
      g.strokeStyle = "rgba(255,207,63,0.85)"; g.lineWidth = 1.6;
      g.shadowColor = "#ffcf3f"; g.shadowBlur = 6;
      for (const line of tpl.lines) {
        g.beginPath();
        line.forEach(([nx, ny], k) => (k ? g.lineTo(bx + nx * bs, by + ny * bs) : g.moveTo(bx + nx * bs, by + ny * bs)));
        g.stroke();
      }
      g.setLineDash([]); g.shadowBlur = 0;
      // tiny artist + runner ball
      g.strokeStyle = "#38c7ff"; g.lineWidth = 1.6; g.lineCap = "round"; g.shadowColor = "#38c7ff"; g.shadowBlur = 4;
      const ax = 14, ay = gr;
      g.beginPath(); g.arc(ax, ay - 15, 3, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(ax, ay - 12); g.lineTo(ax, ay - 5); g.moveTo(ax, ay - 5); g.lineTo(ax - 3, ay); g.moveTo(ax, ay - 5); g.lineTo(ax + 3, ay);
      g.moveTo(ax, ay - 10); g.lineTo(ax + 6, ay - 12); g.stroke();
      g.shadowBlur = 0;
      // laser beam toward the shape
      g.strokeStyle = "rgba(255,60,80,0.7)";
      g.beginPath(); g.moveTo(ax + 6, ay - 12); g.lineTo(bx + 34 + Math.sin(t * 2) * 20, by + 34 + Math.cos(t * 1.6) * 20); g.stroke();
      // runner ball on the wall
      const rx = wallR.x + wallR.w - 26 + Math.sin(t * 1.3 + i) * 12, ry = wallR.y + 30 + Math.cos(t * 1.1 + i) * 22;
      g.fillStyle = "rgba(255,77,90,0.75)"; g.shadowColor = "#ff4d5a"; g.shadowBlur = 6;
      g.beginPath(); g.arc(rx, ry, 8, 0, 7); g.fill();
      g.strokeStyle = "#ff4d5a"; g.lineWidth = 1.4;
      g.beginPath(); g.arc(rx, ry - 11, 2.6, 0, 7); g.stroke();
      g.shadowBlur = 0;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [i]);
  const map = MAPS[i];
  return (
    <div onClick={() => onSelect(i)}
      className="cursor-pointer rounded-2xl p-2.5 pb-3 transition-transform hover:-translate-y-1"
      style={{ background: "#0e111c", border: "1.5px solid #1c2236", boxShadow: selected ? `0 0 18px ${map.glow}` : "none" }}>
      <canvas ref={ref} width={230} height={130} className="w-full rounded-xl block bg-black" />
      <div className="font-bold tracking-widest mt-2 mb-1 text-sm">{map.icon} {map.name}</div>
      <div className="text-[11px] leading-relaxed" style={{ color: "#8b93ab" }}>{map.desc}</div>
      <div className="text-[10px] mt-1" style={{ color: "#8b93ab" }}>
        drawings: {map.tpls.map((n) => TPL[n]?.icon).join(" ")}
      </div>
    </div>
  );
}

/* ═══════════════════ TEMPLATE-ON-WALL PREVIEW (custom picker) ═══════════════════ */
function TplWallPreview({ tp, map }) {
  const ref = useRef(null);
  useEffect(() => {
    const cvs = ref.current; if (!cvs) return;
    let raf;
    const w = 110, h = 78;
    const tick = (ts) => {
      raf = requestAnimationFrame(tick);
      const t = ts / 1000, g = cvs.getContext("2d");
      // the wall
      const wg = g.createLinearGradient(0, 0, 0, h);
      wg.addColorStop(0, map.wall[0]); wg.addColorStop(1, map.wall[1]);
      g.fillStyle = wg; g.fillRect(0, 0, w, h);
      g.strokeStyle = map.edge; g.lineWidth = 2;
      g.shadowColor = map.edge; g.shadowBlur = 6;
      g.strokeRect(1, 1, w - 2, h - 2);
      g.shadowBlur = 0;
      // brick hints
      g.strokeStyle = "rgba(255,255,255,0.04)"; g.lineWidth = 1;
      for (let y = 20; y < h; y += 20) { g.beginPath(); g.moveTo(2, y); g.lineTo(w - 2, y); g.stroke(); }
      // the drawing, glowing + marching dashes, exactly like on the real wall
      const s = 54, bx = w / 2 - s / 2, by = h / 2 - s / 2;
      g.setLineDash([6, 5]); g.lineDashOffset = -t * 18;
      g.strokeStyle = "rgba(255,207,63,0.9)"; g.lineWidth = 1.7; g.lineCap = "round";
      g.shadowColor = "#ffcf3f"; g.shadowBlur = 7;
      for (const line of tp.lines) {
        g.beginPath();
        line.forEach(([nx, ny], k) => (k ? g.lineTo(bx + nx * s, by + ny * s) : g.moveTo(bx + nx * s, by + ny * s)));
        g.stroke();
      }
      g.setLineDash([]); g.shadowBlur = 0;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [tp, map]);
  return <canvas ref={ref} width={110} height={78} className="block w-full rounded-lg mb-1" />;
}

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */
export default function LaserWallDuel() {
  const canvasRef = useRef(null);
  const [screen, setScreen] = useState("menu"); // menu | play
  const [settings, setSettings] = useState({ time: 60, map: 0 });
  const [customOpen, setCustomOpen] = useState(false);
  const [customSet, setCustomSet] = useState([]); // template names chosen for a custom match; empty = use the map's drawings
  const customRef = useRef(customSet); customRef.current = customSet;
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hud, setHud] = useState({ timer: "60.0", acc: 0, tpl: "", artist: 0, round: 1 });
  const [intro, setIntro] = useState(null);       // {round, artist, tplName, tplIcon, count}
  const [roundEnd, setRoundEnd] = useState(null); // {artist, acc, ratingTxt, color, last}
  const [finalRes, setFinalRes] = useState(null); // {acc:[a,b], winner}

  const mutedRef = useRef(muted); mutedRef.current = muted;
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const settingsRef = useRef(settings); settingsRef.current = settings;

  const E = useRef({
    state: "menu", round: 1, artist: 0, accs: [0, 0],
    art: null, run: null, keys: {}, mouse: { x: 1000, y: 500, down: false },
    cam: { x: 1000, y: 650, z: 0.55 },
    tpl: null, tplPts: [], covered: 0, offTime: 0,
    timer: 60, parts: [], trace: null, lastDot: null,
    blockedFlicker: 0, now: 0,
  }).current;
  const audio = useRef({ AC: null, master: null, hum: null }).current;

  /* ---------- audio ---------- */
  const initAudio = useCallback(() => {
    if (!audio.AC) {
      audio.AC = new (window.AudioContext || window.webkitAudioContext)();
      audio.master = audio.AC.createGain();
      audio.master.gain.value = mutedRef.current ? 0 : 1;
      audio.master.connect(audio.AC.destination);
      const o = audio.AC.createOscillator(), g = audio.AC.createGain(), f = audio.AC.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.value = 180; g.gain.value = 0;
      f.type = "lowpass"; f.frequency.value = 900;
      o.connect(f); f.connect(g); g.connect(audio.master); o.start();
      audio.hum = g;
    }
    if (audio.AC.state === "suspended") audio.AC.resume();
  }, [audio]);
  useEffect(() => { if (audio.master) audio.master.gain.value = muted ? 0 : 1; }, [muted, audio]);
  const beep = useCallback((f, d = 0.08, v = 0.05, type = "sine") => {
    if (!audio.AC || mutedRef.current) return;
    const o = audio.AC.createOscillator(), g = audio.AC.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = v;
    o.connect(g); g.connect(audio.master); o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audio.AC.currentTime + d);
    o.stop(audio.AC.currentTime + d);
  }, [audio]);

  /* ---------- round setup ---------- */
  const startRound = useCallback(() => {
    E.art = { x: 250, y: WORLD.ground, face: 1 };
    E.run = { x: 1000, y: 450, vx: 0, vy: 0, onWall: true, onGround: false, stickCd: 0, squash: 0 };
    const map = MAPS[settingsRef.current.map];
    const custom = customRef.current;
    const pool = (custom.length ? custom : map.tpls).map((n) => TPL[n]).filter(Boolean);
    E.tpl = pool[Math.floor(Math.random() * pool.length)];
    E.tplPts = sampleTemplate(E.tpl);
    E.covered = 0; E.offTime = 0; E.parts = []; E.lastDot = null; E.blockedFlicker = 0;
    E.fxItems = []; E.boltT = 2; E.flashA = 0;
    E.stars = map.fx === "stars" ? Array.from({ length: 70 }, () => ({ x: Math.random() * WORLD.w, y: Math.random() * (WORLD.ground - 100), ph: Math.random() * 6.28 })) : [];
    E.timer = settingsRef.current.time;
    E.trace = document.createElement("canvas"); E.trace.width = WORLD.w; E.trace.height = WORLD.h;
    E.cam = { x: 1000, y: 650, z: 0.55 };
    setIntro({ round: E.round, artist: E.artist, tplName: E.tpl.name, tplIcon: E.tpl.icon, diff: E.tpl.diff, count: 3 });
    E.state = "intro"; E._introT = 3.6; E._cn = 0;
  }, [E]);

  const startMatch = useCallback(() => {
    E.round = 1; E.artist = 0; E.accs = [0, 0];
    setFinalRes(null); setRoundEnd(null);
    startRound();
  }, [E, startRound]);

  const finishRound = useCallback(() => {
    const coverage = (E.covered / E.tplPts.length) * 100;
    const sloppy = Math.min(20, E.offTime * 4);
    const acc = Math.max(0, Math.round(coverage - sloppy));
    E.accs[E.artist] = acc;
    const [txt, color] = rating(acc);
    E.state = "roundEnd";
    if (audio.hum) audio.hum.gain.value = 0;
    setRoundEnd({ artist: E.artist, acc, ratingTxt: txt, color, last: E.round === 2, blocked: acc < WIN_THRESHOLD });
    beep(acc >= WIN_THRESHOLD ? 880 : 220, 0.4, 0.07, acc >= WIN_THRESHOLD ? "sine" : "sawtooth");
  }, [E, audio, beep]);

  const nextAfterRound = useCallback(() => {
    setRoundEnd(null);
    if (E.round === 2) {
      const [a, b] = E.accs;
      setFinalRes({ accs: [...E.accs], winner: a === b ? -1 : a > b ? 0 : 1 });
      E.state = "done";
    } else { E.round = 2; E.artist = 1; startRound(); }
  }, [E, startRound]);

  /* ---------- physics ---------- */
  const dust = useCallback((x, y, n = 8) => {
    for (let i = 0; i < n; i++) E.parts.push({ x, y, vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 160, life: 0.4 + Math.random() * 0.3, color: "rgba(200,200,210,0.7)", size: 3 + Math.random() * 3 });
  }, [E]);

  const updateRunner = useCallback((dt) => {
    const r = E.run, k = E.keys;
    const L = k["ArrowLeft"], R = k["ArrowRight"], U = k["ArrowUp"], D = k["ArrowDown"];
    if (r.stickCd > 0) r.stickCd -= dt;
    if (r.squash > 0) r.squash -= dt * 3;
    const inWall = r.x > WALL.x1 + 10 && r.x < WALL.x2 - 10 && r.y > WALL.y1 + 20 && r.y < WALL.y2 + 4;

    if (r.onWall) {
      const S = 430;
      r.vx = L ? -S : R ? S : 0;
      r.vy = U ? -S : D ? S : 0;
      r.x += r.vx * dt; r.y += r.vy * dt;
      r.x = Math.max(WALL.x1 + 14, Math.min(WALL.x2 - 14, r.x));
      r.y = Math.max(WALL.y1 + 24, Math.min(WALL.y2 - 4, r.y));
      if (r.y >= WALL.y2 - 6 && D) { r.onWall = false; r.y = WORLD.ground; r.onGround = true; }
    } else {
      const S = 320;
      if (L) r.vx = -S; else if (R) r.vx = S; else r.vx *= Math.pow(0.0001, dt);
      r.vy += 1500 * dt;
      r.x += r.vx * dt; r.y += r.vy * dt;
      r.x = Math.max(30, Math.min(WORLD.w - 30, r.x));
      r.onGround = false;
      if (r.y >= WORLD.ground) { if (r.vy > 300) { dust(r.x, WORLD.ground, 10); r.squash = 0.3; beep(140, 0.06, 0.03, "triangle"); } r.y = WORLD.ground; r.vy = 0; r.onGround = true; }
      // auto re-stick to the wall
      if (r.stickCd <= 0 && inWall && (r.y < WALL.y2 - 30 || U)) {
        r.onWall = true; r.vx = 0; r.vy = 0; dust(r.x, r.y, 6); beep(500, 0.05, 0.03, "triangle");
      }
    }
  }, [E, dust, beep]);

  const tryRunnerJump = useCallback(() => {
    const r = E.run, k = E.keys;
    if (E.state !== "play") return;
    const dir = k["ArrowLeft"] ? -1 : k["ArrowRight"] ? 1 : 0;
    if (r.onWall) {
      r.onWall = false; r.stickCd = 0.28;
      r.vx = dir * 480; r.vy = k["ArrowDown"] ? 300 : -560;
      dust(r.x, r.y, 8); beep(340, 0.08, 0.04, "triangle");
    } else if (r.onGround) {
      r.vy = -640; r.onGround = false; dust(r.x, WORLD.ground, 8); beep(300, 0.08, 0.04, "triangle");
    }
  }, [E, dust, beep]);

  const updateArtist = useCallback((dt) => {
    const a = E.art, k = E.keys, S = 300;
    if (k["KeyA"]) { a.x -= S * dt; a.face = -1; }
    if (k["KeyD"]) { a.x += S * dt; a.face = 1; }
    a.x = Math.max(60, Math.min(WORLD.w - 60, a.x));
  }, [E]);

  /* ---------- laser ---------- */
  const updateLaser = useCallback((dt) => {
    const a = E.art, m = E.mouse;
    const hx = a.x + 26 * a.face, hy = WORLD.ground - 88; // laser pointer hand
    a.face = m.x >= a.x ? 1 : -1;
    E.beam = null;
    if (audio.hum) audio.hum.gain.value = 0;
    if (!m.down || E.state !== "play") { E.lastDot = null; return; }
    // dot clamped to wall
    const dx = Math.max(WALL.x1 + 4, Math.min(WALL.x2 - 4, m.x));
    const dy = Math.max(WALL.y1 + 4, Math.min(WALL.y2 - 4, m.y));
    // blocked by the runner's inflatable suit?
    const r = E.run;
    const { d, t } = segDist(r.x, r.y - 40, hx, hy, dx, dy);
    if (d < BLOCK_R) {
      const bx = hx + (dx - hx) * t, by = hy + (dy - hy) * t;
      E.beam = { hx, hy, x: bx, y: by, blocked: true };
      E.blockedFlicker = 0.15;
      E.lastDot = null;
      for (let i = 0; i < 3; i++) E.parts.push({ x: bx, y: by, vx: (Math.random() - 0.5) * 420, vy: (Math.random() - 0.5) * 420, life: 0.25, color: Math.random() < 0.5 ? "#ffcf3f" : "#ff8a3c", size: 2 + Math.random() * 2 });
      if (Math.random() < 0.2) beep(1600 + Math.random() * 800, 0.03, 0.03, "square");
      if (audio.hum) audio.hum.gain.value = 0.008;
      return;
    }
    E.beam = { hx, hy, x: dx, y: dy, blocked: false };
    if (audio.hum) { audio.hum.gain.value = 0.012; }
    // mark template points + measure sloppiness
    let nearest = Infinity;
    for (const p of E.tplPts) {
      const dd = Math.hypot(p.x - dx, p.y - dy);
      if (dd < nearest) nearest = dd;
      if (dd < 22 && !p.hit) { p.hit = true; E.covered++; }
    }
    const onTpl = nearest < 30;
    if (!onTpl) E.offTime += dt;
    // draw the trace
    const g = E.trace.getContext("2d");
    g.strokeStyle = onTpl ? "#38c7ff" : "rgba(255,77,90,0.55)";
    g.lineWidth = onTpl ? 6 : 4; g.lineCap = "round";
    g.shadowColor = onTpl ? "#38c7ff" : "#ff4d5a"; g.shadowBlur = 10;
    g.beginPath();
    if (E.lastDot && Math.hypot(E.lastDot.x - dx, E.lastDot.y - dy) < 90) g.moveTo(E.lastDot.x, E.lastDot.y);
    else g.moveTo(dx, dy);
    g.lineTo(dx, dy + 0.1); g.stroke();
    g.shadowBlur = 0;
    E.lastDot = { x: dx, y: dy };
  }, [E, audio, beep]);

  /* ---------- map ambience ---------- */
  const updateMapFX = useCallback((dt) => {
    const map = MAPS[settingsRef.current.map];
    if (!E.fxItems) E.fxItems = [];
    const F = E.fxItems;
    if (map.fx === "snow" && Math.random() < 0.5 && F.length < 120) F.push({ t: "snow", x: Math.random() * WORLD.w, y: 0, vx: 20 + Math.random() * 30, vy: 60 + Math.random() * 80, r: 2 + Math.random() * 3 });
    if (map.fx === "ember" && Math.random() < 0.4 && F.length < 100) F.push({ t: "ember", x: Math.random() * WORLD.w, y: WORLD.ground, vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 120, r: 2 + Math.random() * 2.5, life: 2 + Math.random() * 2 });
    if (map.fx === "bubble" && Math.random() < 0.25 && F.length < 60) F.push({ t: "bubble", x: Math.random() * WORLD.w, y: WORLD.ground, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 50, r: 5 + Math.random() * 12, life: 4 });
    if (map.fx === "sparkle" && Math.random() < 0.15 && F.length < 50) F.push({ t: "sparkle", x: Math.random() * WORLD.w, y: Math.random() * WORLD.ground, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, r: 1.5 + Math.random() * 2, life: 3 });
    if (map.fx === "lightning") {
      E.boltT -= dt;
      if (E.boltT <= 0) {
        E.boltT = 3 + Math.random() * 4;
        const segs = []; let x = 0, y = 0;
        while (y < WALL.y1 + 120) { segs.push([x, y]); y += 40 + Math.random() * 50; x += (Math.random() - 0.5) * 90; }
        F.push({ t: "bolt", x: 200 + Math.random() * (WORLD.w - 400), segs, life: 0.25 });
        E.flashA = Math.max(E.flashA || 0, 0.35);
        if (E.state === "play") beep(85, 0.2, 0.03, "sawtooth");
      }
    }
    for (let i = F.length - 1; i >= 0; i--) {
      const f = F[i];
      if (f.t === "bolt") { f.life -= dt; if (f.life <= 0) F.splice(i, 1); continue; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.life !== undefined) { f.life -= dt; if (f.life <= 0) { F.splice(i, 1); continue; } }
      if (f.y > WORLD.h || f.y < -20) F.splice(i, 1);
    }
    if (E.flashA > 0) E.flashA -= dt * 1.6;
  }, [E, beep]);

  /* ---------- camera ---------- */
  const updateCam = useCallback((dt) => {
    const a = E.art, r = E.run;
    const p1 = { x: a.x, y: WORLD.ground - 70 }, p2 = { x: r.x, y: r.y - 40 };
    const cx = (p1.x + p2.x) / 2, cy = (p1.y + p2.y) / 2 - 40;
    const bw = Math.abs(p1.x - p2.x) + 620, bh = Math.abs(p1.y - p2.y) + 480;
    let z = Math.min(VW / bw, VH / bh);
    z = Math.max(0.55, Math.min(0.95, z));
    const k = 1 - Math.pow(0.002, dt);
    E.cam.z += (z - E.cam.z) * k;
    // clamp to the world — if the view is wider/taller than the world, just center on it
    const hw = VW / 2 / E.cam.z, hh = VH / 2 / E.cam.z;
    const tx = hw * 2 >= WORLD.w ? WORLD.w / 2 : Math.max(hw, Math.min(WORLD.w - hw, cx));
    const ty = hh * 2 >= WORLD.h ? WORLD.h / 2 : Math.max(hh, Math.min(WORLD.h - hh, cy));
    E.cam.x += (tx - E.cam.x) * k;
    E.cam.y += (ty - E.cam.y) * k;
  }, [E]);

  /* ---------- drawing ---------- */
  const drawStickman = useCallback((ctx, x, y, color, opts = {}) => {
    // y = feet
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    const hy = y - 78;
    ctx.beginPath(); ctx.arc(x, hy, 12, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, hy + 12); ctx.lineTo(x, y - 34); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - 34); ctx.lineTo(x - 10, y); ctx.moveTo(x, y - 34); ctx.lineTo(x + 10, y);
    ctx.stroke();
    if (opts.aim) {
      // arms both pointing toward aim
      const ang = Math.atan2(opts.aim.y - (hy + 20), opts.aim.x - x);
      ctx.beginPath();
      ctx.moveTo(x, hy + 18); ctx.lineTo(x + Math.cos(ang) * 30, hy + 18 + Math.sin(ang) * 30);
      ctx.moveTo(x, hy + 24); ctx.lineTo(x + Math.cos(ang) * 28, hy + 22 + Math.sin(ang) * 28);
      ctx.stroke();
      // laser pointer
      ctx.shadowBlur = 0;
      ctx.save(); ctx.translate(x + Math.cos(ang) * 30, hy + 18 + Math.sin(ang) * 30); ctx.rotate(ang);
      ctx.fillStyle = "#22263a"; ctx.fillRect(-4, -4, 16, 8);
      ctx.fillStyle = "#ff4d5a"; ctx.fillRect(10, -2.5, 4, 5);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.moveTo(x, hy + 18); ctx.lineTo(x - 12, hy + 36);
      ctx.moveTo(x, hy + 18); ctx.lineTo(x + 12, hy + 36);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }, []);

  const drawRunner = useCallback((ctx, t) => {
    const r = E.run, x = r.x, y = r.y;
    const cx = x, cy = y - 40;
    const sq = 1 + Math.max(0, r.squash) * 0.4;
    // giant inflatable sumo suit = the blocker hitbox, drawn to match BLOCK_R
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(1 / sq, sq);
    const grad = ctx.createRadialGradient(-12, -14, 8, 0, 0, BLOCK_R);
    grad.addColorStop(0, "rgba(255,120,130,0.95)");
    grad.addColorStop(0.75, "rgba(255,77,90,0.8)");
    grad.addColorStop(1, "rgba(255,77,90,0.55)");
    ctx.fillStyle = grad;
    ctx.strokeStyle = "#ff8a95"; ctx.lineWidth = 3;
    ctx.shadowColor = "#ff4d5a"; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(0, 0, BLOCK_R, 0, 7); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    // inflatable seams
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, BLOCK_R * 0.65, BLOCK_R, 0, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, BLOCK_R, BLOCK_R * 0.6, 0, 0, 7); ctx.stroke();
    // little valve
    ctx.fillStyle = "#ffcf3f"; ctx.beginPath(); ctx.arc(BLOCK_R * 0.7, BLOCK_R * 0.5, 5, 0, 7); ctx.fill();
    ctx.restore();
    // stickman inside (head pokes out the top)
    ctx.strokeStyle = "#ff4d5a"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.shadowColor = "#ff4d5a"; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(cx, cy - BLOCK_R - 8, 11, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - BLOCK_R + 3); ctx.lineTo(cx, cy - BLOCK_R - 0.5 + 3); ctx.stroke();
    // tiny arms & legs sticking out of the ball
    const wig = Math.sin(t * 10) * (r.onWall && (Math.abs(r.vx) > 10 || Math.abs(r.vy) > 10) ? 6 : 2);
    ctx.beginPath();
    ctx.moveTo(cx - BLOCK_R + 4, cy - 6); ctx.lineTo(cx - BLOCK_R - 12, cy - 12 + wig);
    ctx.moveTo(cx + BLOCK_R - 4, cy - 6); ctx.lineTo(cx + BLOCK_R + 12, cy - 12 - wig);
    ctx.moveTo(cx - BLOCK_R * 0.55, cy + BLOCK_R - 8); ctx.lineTo(cx - BLOCK_R * 0.55 - 6, cy + BLOCK_R + 12 + wig);
    ctx.moveTo(cx + BLOCK_R * 0.55, cy + BLOCK_R - 8); ctx.lineTo(cx + BLOCK_R * 0.55 + 6, cy + BLOCK_R + 12 - wig);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // wall-stick hands effect
    if (r.onWall) {
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath(); ctx.arc(cx - BLOCK_R - 12, cy - 12 + wig, 4, 0, 7); ctx.arc(cx + BLOCK_R + 12, cy - 12 - wig, 4, 0, 7); ctx.fill();
    }
  }, [E]);

  const draw = useCallback((t) => {
    const cvs = canvasRef.current; if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const map = MAPS[settingsRef.current.map];
    // sky
    const bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, map.sky[0]); bg.addColorStop(1, map.sky[1]);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH);
    ctx.save();
    ctx.translate(VW / 2, VH / 2); ctx.scale(E.cam.z, E.cam.z); ctx.translate(-E.cam.x, -E.cam.y);

    // twinkling stars (Space Dock)
    if (E.stars && E.stars.length) {
      for (const s of E.stars) {
        ctx.globalAlpha = 0.3 + 0.6 * Math.abs(Math.sin(t * 1.4 + s.ph));
        ctx.fillStyle = "#dfe6ff";
        ctx.fillRect(s.x, s.y, 2.4, 2.4);
      }
      ctx.globalAlpha = 1;
    }
    // ambient fx behind the wall
    for (const f of E.fxItems || []) {
      if (f.t === "snow") { ctx.fillStyle = "rgba(220,240,255,0.8)"; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill(); }
      else if (f.t === "ember") { ctx.fillStyle = "rgba(255,150,60," + Math.min(1, f.life) + ")"; ctx.shadowColor = "#ff7a2f"; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
      else if (f.t === "bubble") { ctx.strokeStyle = "rgba(255,150,200," + Math.min(0.6, f.life * 0.3) + ")"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.stroke(); }
      else if (f.t === "sparkle") { ctx.fillStyle = "rgba(120,220,255," + Math.min(0.8, f.life * 0.4) + ")"; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill(); }
      else if (f.t === "bolt") {
        ctx.strokeStyle = "rgba(210,180,255," + f.life * 4 + ")"; ctx.lineWidth = 4;
        ctx.shadowColor = "#a86bff"; ctx.shadowBlur = 18;
        ctx.beginPath(); f.segs.forEach(([sx, sy], i) => (i ? ctx.lineTo(f.x + sx, sy) : ctx.moveTo(f.x + sx, sy))); ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // ground
    ctx.fillStyle = "#0a0c16"; ctx.fillRect(0, WORLD.ground, WORLD.w, WORLD.h - WORLD.ground);
    ctx.shadowColor = map.ground; ctx.shadowBlur = 14;
    ctx.strokeStyle = map.ground; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, WORLD.ground); ctx.lineTo(WORLD.w, WORLD.ground); ctx.stroke();
    ctx.shadowBlur = 0;

    // THE WALL
    const wg = ctx.createLinearGradient(0, WALL.y1, 0, WALL.y2);
    wg.addColorStop(0, map.wall[0]); wg.addColorStop(1, map.wall[1]);
    ctx.fillStyle = wg;
    ctx.fillRect(WALL.x1, WALL.y1, WALL.x2 - WALL.x1, WALL.y2 - WALL.y1);
    ctx.strokeStyle = map.edge; ctx.lineWidth = 4;
    ctx.shadowColor = map.edge; ctx.shadowBlur = 14;
    ctx.strokeRect(WALL.x1, WALL.y1, WALL.x2 - WALL.x1, WALL.y2 - WALL.y1);
    ctx.shadowBlur = 0;
    // brick hints
    ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
    for (let y = WALL.y1 + 60; y < WALL.y2; y += 60) { ctx.beginPath(); ctx.moveTo(WALL.x1, y); ctx.lineTo(WALL.x2, y); ctx.stroke(); }

    // template outline (glowing dashed)
    if (E.tpl) {
      ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 30;
      ctx.strokeStyle = "rgba(255,207,63,0.75)"; ctx.lineWidth = 4;
      ctx.shadowColor = "#ffcf3f"; ctx.shadowBlur = 12;
      for (const line of E.tpl.lines) {
        ctx.beginPath();
        line.forEach(([nx, ny], i) => {
          const px = TBOX.x + nx * TBOX.s, py = TBOX.y + ny * TBOX.s;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        ctx.stroke();
      }
      ctx.setLineDash([]); ctx.shadowBlur = 0;
    }
    // player's trace
    if (E.trace) ctx.drawImage(E.trace, 0, 0);

    // laser beam
    if (E.beam) {
      const b = E.beam;
      const flick = E.blockedFlicker > 0 ? 0.35 + Math.random() * 0.5 : 0.9;
      ctx.strokeStyle = `rgba(255,60,80,${flick})`;
      ctx.lineWidth = 3; ctx.shadowColor = "#ff4d5a"; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(b.hx, b.hy); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "#ff4d5a"; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.blocked ? 4 : 6, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // players
    drawStickman(ctx, E.art.x, WORLD.ground, "#38c7ff", { aim: E.mouse });
    drawRunner(ctx, t);

    // particles
    for (const q of E.parts) {
      ctx.globalAlpha = Math.max(0, q.life * 2.4); ctx.fillStyle = q.color;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (E.flashA > 0) { ctx.fillStyle = "rgba(210,190,255," + E.flashA * 0.5 + ")"; ctx.fillRect(0, 0, VW, VH); }
  }, [E, drawStickman, drawRunner]);

  /* ---------- main loop ---------- */
  useEffect(() => {
    let raf, last = 0;
    const loop = (ts) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.033, (ts - last) / 1000 || 0.016); last = ts;
      const t = ts / 1000; E.now = t;
      if (pausedRef.current || E.state === "menu" || E.state === "done" || E.state === "roundEnd") return;
      if (E.blockedFlicker > 0) E.blockedFlicker -= dt;
      updateMapFX(dt);

      if (E.state === "intro") {
        E._introT -= dt;
        const n = Math.ceil(E._introT - 0.6);
        if (n > 0 && E._cn !== n) { E._cn = n; beep(440, 0.1, 0.05); setIntro((s) => s && { ...s, count: n }); }
        if (E._introT <= 0.6 && E._cn !== -1) { E._cn = -1; beep(880, 0.25, 0.06); setIntro((s) => s && { ...s, count: 0 }); }
        if (E._introT <= 0) { setIntro(null); E.state = "play"; }
        updateCam(dt); draw(t); return;
      }
      if (E.state === "play") {
        E.timer -= dt;
        if (E.timer <= 0) { E.timer = 0; finishRound(); }
        updateArtist(dt);
        updateRunner(dt);
        updateLaser(dt);
        const acc = E.tplPts.length ? Math.max(0, Math.round((E.covered / E.tplPts.length) * 100 - Math.min(20, E.offTime * 4))) : 0;
        setHud((h) => {
          const next = { timer: Math.max(0, E.timer).toFixed(1), acc, tpl: E.tpl.icon + " " + E.tpl.name, artist: E.artist, round: E.round };
          return JSON.stringify(h) === JSON.stringify(next) ? h : next;
        });
      }
      for (let i = E.parts.length - 1; i >= 0; i--) {
        const q = E.parts[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 500 * dt; q.life -= dt;
        if (q.life <= 0) E.parts.splice(i, 1);
      }
      updateCam(dt);
      draw(t);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [E, beep, draw, updateArtist, updateRunner, updateLaser, updateCam, updateMapFX, finishRound]);

  /* ---------- input ---------- */
  useEffect(() => {
    const dn = (e) => {
      E.keys[e.code] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "ShiftRight"].includes(e.code)) e.preventDefault();
      if (e.code === "Escape") setPaused((p) => (E.state === "play" || E.state === "intro" ? !p : p));
      if ((e.code === "ShiftRight" || e.code === "ShiftLeft") && !e.repeat) tryRunnerJump();
    };
    const up = (e) => (E.keys[e.code] = false);
    addEventListener("keydown", dn); addEventListener("keyup", up);
    return () => { removeEventListener("keydown", dn); removeEventListener("keyup", up); };
  }, [E, tryRunnerJump]);

  const toWorld = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * VW, sy = ((e.clientY - r.top) / r.height) * VH;
    return { x: (sx - VW / 2) / E.cam.z + E.cam.x, y: (sy - VH / 2) / E.cam.z + E.cam.y };
  };
  const onMove = (e) => { const w = toWorld(e); E.mouse.x = w.x; E.mouse.y = w.y; };
  const onDown = (e) => { e.preventDefault(); E.mouse.down = true; onMove(e); };
  const onUp = () => { E.mouse.down = false; };

  const startMatchUI = () => { setScreen("play"); initAudio(); startMatch(); };
  const backToMenu = () => {
    setScreen("menu"); setPaused(false); setRoundEnd(null); setFinalRes(null); setIntro(null);
    E.state = "menu"; if (audio.hum) audio.hum.gain.value = 0;
    const c = canvasRef.current; if (c) c.getContext("2d").clearRect(0, 0, VW, VH);
  };

  const dim = "#8b93ab", line = "#1c2236", card = "#0e111c";
  const cyan = "#38c7ff", red = "#ff4d5a";
  const pillStyle = (sel) => ({
    background: sel ? "#0e2231" : card, color: "#dfe6f5", fontFamily: "inherit",
    border: `1.5px solid ${sel ? cyan : line}`,
    boxShadow: sel ? "0 0 14px rgba(56,199,255,.45)" : "none",
  });
  const artistName = (i) => "PLAYER " + (i + 1);

  return (
    <div className="w-full h-screen overflow-hidden relative flex items-center justify-center" style={{ background: "#07080f", fontFamily: 'Consolas,"Courier New",monospace', color: "#dfe6f5" }}>
      <canvas ref={canvasRef} width={VW} height={VH}
        onMouseMove={onMove} onMouseDown={onDown} onMouseUp={onUp} onMouseLeave={onUp} onContextMenu={(e) => e.preventDefault()}
        className="block rounded-xl"
        style={{ width: "min(98vw, calc(98vh * " + VW / VH + "))", aspectRatio: VW + "/" + VH, cursor: screen === "play" ? "crosshair" : "default", boxShadow: screen === "play" ? "0 0 50px rgba(56,199,255,.12)" : "none" }} />

      {/* HUD */}
      {screen === "play" && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute top-3 left-3.5 rounded-2xl px-4 py-2" style={{ background: "#0a0d17d9", border: `1.5px solid ${line}` }}>
            <div className="text-[10px] tracking-widest font-bold" style={{ color: cyan }}>🔦 LASER ARTIST — {artistName(hud.artist)}</div>
            <div className="text-2xl font-bold">{hud.acc}%</div>
            <div className="text-[11px]" style={{ color: dim }}>target: {WIN_THRESHOLD}% · {hud.tpl}</div>
          </div>
          <div className="absolute top-3 right-3.5 rounded-2xl px-4 py-2 text-right" style={{ background: "#0a0d17d9", border: `1.5px solid ${line}` }}>
            <div className="text-[10px] tracking-widest font-bold" style={{ color: red }}>🎈 WALL RUNNER — {artistName(1 - hud.artist)}</div>
            <div className="text-[11px] mt-1" style={{ color: dim }}>block the laser<br />with your suit!</div>
          </div>
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 rounded-2xl px-6 font-bold text-center" style={{ fontSize: 38, letterSpacing: 2, background: "#0a0d17d9", border: `1.5px solid ${line}`, color: +hud.timer < 10 ? red : "#dfe6f5" }}>
            {hud.timer}
            <div className="text-[10px] font-normal tracking-widest -mt-1" style={{ color: dim }}>ROUND {hud.round}/2</div>
          </div>
          <div className="absolute top-3 flex gap-2 pointer-events-auto" style={{ right: "calc(50% - 160px)" }}>
            <button onClick={() => setPaused(true)} className="w-10 h-10 rounded-xl cursor-pointer" style={{ background: "#0a0d17d9", border: `1.5px solid ${line}`, color: "#dfe6f5" }}>⏸</button>
            <button onClick={() => setMuted((m) => !m)} className="w-10 h-10 rounded-xl cursor-pointer" style={{ background: "#0a0d17d9", border: `1.5px solid ${line}`, color: "#dfe6f5" }}>{muted ? "🔇" : "🔊"}</button>
          </div>
        </div>
      )}

      {/* ROLE INTRO */}
      {intro && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ background: "rgba(7,8,15,0.72)" }}>
          <div className="text-center">
            <div className="text-sm tracking-[6px] mb-3" style={{ color: dim }}>ROUND {intro.round} / 2</div>
            <div className="text-3xl font-bold mb-1" style={{ color: cyan, textShadow: `0 0 16px ${cyan}` }}>🔦 {artistName(intro.artist)} — LASER ARTIST</div>
            <div className="text-xl font-bold mb-4" style={{ color: red, textShadow: `0 0 14px ${red}` }}>🎈 {artistName(1 - intro.artist)} — WALL RUNNER</div>
            <div className="text-lg mb-1">trace: <b>{intro.tplIcon} {intro.tplName}</b> <span style={{ color: dim }}>({intro.diff})</span></div>
            <div style={{ fontSize: 90, color: "#ffcf3f", textShadow: "0 0 30px rgba(255,207,63,.8)", fontWeight: "bold" }}>
              {intro.count > 0 ? intro.count : "GO!"}
            </div>
          </div>
        </div>
      )}

      {/* MENU */}
      {screen === "menu" && (
        <div className="absolute inset-0 z-20 overflow-auto flex justify-center" style={{ background: "#07080fee" }}>
          <div className="w-full max-w-[860px] px-3 pt-7 pb-10 text-center">
            <h1 className="text-4xl font-bold mb-1" style={{ letterSpacing: 8 }}>
              <span style={{ color: cyan, textShadow: `0 0 14px ${cyan},0 0 40px rgba(56,199,255,.4)` }}>LASER</span>{" 🔦 "}
              <span style={{ color: red, textShadow: `0 0 14px ${red},0 0 40px rgba(255,77,90,.4)` }}>WALL DUEL</span>
            </h1>
            <div className="text-[13px] mb-4" style={{ color: dim, letterSpacing: 2 }}>
              one draws with a laser · one blocks with their body · 2 rounds, switch roles · best tracer wins
            </div>
            <div className="flex gap-3 justify-center items-center flex-wrap">
              <button onClick={startMatchUI} className="cursor-pointer rounded-2xl font-bold text-white transition-transform hover:scale-105"
                style={{ padding: "15px 58px", fontSize: 20, letterSpacing: 5, border: "none", background: "linear-gradient(90deg,#3a7bfd,#ff4d5a)", boxShadow: "0 0 26px rgba(90,120,255,.45)", fontFamily: "inherit" }}>
                START MATCH ▶
              </button>
              <button onClick={() => setCustomOpen(true)} className="cursor-pointer rounded-2xl px-6 py-4 text-sm font-bold transition-transform hover:-translate-y-0.5"
                style={{ background: card, color: "#dfe6f5", fontFamily: "inherit", letterSpacing: 2, border: "1.5px solid #a86bff", boxShadow: "0 0 14px rgba(168,107,255,.35)" }}>
                ✏️ CUSTOM MATCH
                <small className="block mt-0.5 font-normal" style={{ color: dim, fontSize: 10, letterSpacing: 1 }}>pick the drawings yourself</small>
              </button>
            </div>
            {customSet.length > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs" style={{ background: card, border: "1.5px solid #a86bff", letterSpacing: 1 }}>
                <span style={{ color: "#a86bff", fontWeight: "bold" }}>CUSTOM SET ACTIVE:</span>
                <span>{customSet.map((n) => TPL[n]?.icon).join(" ")}</span>
                <button onClick={() => setCustomSet([])} className="cursor-pointer rounded-md px-2 py-0.5 ml-1" style={{ background: "#060810", border: `1px solid ${line}`, color: dim, fontFamily: "inherit", fontSize: 11 }}>✕ clear</button>
              </div>
            )}

            <div className="text-sm font-bold mt-5 mb-2.5" style={{ letterSpacing: 2 }}>Round time:</div>
            <div className="flex gap-3 justify-center">
              {[45, 60].map((tt) => (
                <button key={tt} onClick={() => setSettings((s) => ({ ...s, time: tt }))} className="cursor-pointer rounded-xl px-6 py-3 text-sm" style={pillStyle(settings.time === tt)}>
                  <b>{tt} s</b><small className="block mt-0.5" style={{ color: dim, fontSize: 11 }}>{tt === 45 ? "fast & frantic" : "classic"}</small>
                </button>
              ))}
            </div>

            <div className="text-sm font-bold mt-5 mb-2.5" style={{ letterSpacing: 2 }}>Choose your map:</div>
            <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))" }}>
              {MAPS.map((_, i) => (
                <MapCard key={i} i={i} selected={settings.map === i} onSelect={(m) => setSettings((s) => ({ ...s, map: m }))} />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6 max-[640px]:grid-cols-1">
              <div className="rounded-2xl p-4 text-left" style={{ background: card, border: `1.5px solid ${cyan}44`, boxShadow: "inset 0 0 30px rgba(56,199,255,.05)" }}>
                <div className="font-bold tracking-widest mb-2" style={{ color: cyan }}>🔦 LASER ARTIST</div>
                <div className="text-xs leading-loose" style={{ color: dim }}>
                  <Key>A</Key>/<Key>D</Key> — walk on the ground<br />
                  <Key>MOUSE</Key> — aim the laser at the wall<br />
                  <Key>HOLD LEFT CLICK</Key> — fire &amp; draw<br />
                  Trace the glowing outline. Stay ON the line — sloppy drawing costs accuracy. Reach <b style={{ color: "#dfe6f5" }}>{WIN_THRESHOLD}%</b> to win your round.
                </div>
              </div>
              <div className="rounded-2xl p-4 text-left" style={{ background: card, border: `1.5px solid ${red}44`, boxShadow: "inset 0 0 30px rgba(255,77,90,.05)" }}>
                <div className="font-bold tracking-widest mb-2" style={{ color: red }}>🎈 WALL RUNNER</div>
                <div className="text-xs leading-loose" style={{ color: dim }}>
                  <Key>←</Key><Key>→</Key><Key>↑</Key><Key>↓</Key> — run anywhere on the wall<br />
                  <Key>SHIFT</Key> — leap off the wall / jump<br />
                  You wear a giant <b style={{ color: "#dfe6f5" }}>inflatable suit</b> — put it in the laser's path! Blocked laser = zero progress for the artist.
                </div>
              </div>
            </div>

            <div className="rounded-xl px-4 py-3 mt-4 text-xs" style={{ background: card, border: `1.5px solid ${line}`, color: dim, letterSpacing: 1, lineHeight: 1.9 }}>
              🏆 <b style={{ color: "#dfe6f5" }}>MATCH:</b> 2 rounds — you swap roles after round 1. Whoever scores the higher tracing accuracy as the artist wins the match.<br />
              📊 96%+ EXCELLENT · 84%+ GREAT · {WIN_THRESHOLD}%+ GOOD (artist wins the round) · below = the runner blocked it!
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MATCH — drawing picker */}
      {customOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center overflow-auto" style={{ background: "#07080fee" }}>
          <div className="rounded-3xl px-7 py-7 text-center w-[min(760px,95%)] my-5" style={{ background: "#0e111c", border: "1.5px solid #1c2236", boxShadow: "0 0 60px rgba(168,107,255,.15)" }}>
            <h2 className="text-xl font-bold mb-1" style={{ letterSpacing: 5, color: "#a86bff", textShadow: "0 0 12px rgba(168,107,255,.6)" }}>✏️ CUSTOM MATCH</h2>
            <div className="text-xs mb-4" style={{ color: dim, letterSpacing: 1 }}>
              choose the drawings you want to play with — mix easy warm-ups with complicated ones.<br />
              rounds will pick randomly from YOUR set (on any map).
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))" }}>
              {TEMPLATES.map((tp) => {
                const on = customSet.includes(tp.name);
                const diffColor = tp.diff === "easy" ? "#4dff9e" : tp.diff === "medium" ? "#ffcf3f" : "#ff4d5a";
                return (
                  <button key={tp.name}
                    onClick={() => setCustomSet((s) => (on ? s.filter((n) => n !== tp.name) : [...s, tp.name]))}
                    className="cursor-pointer rounded-xl p-2 transition-transform hover:-translate-y-0.5"
                    style={{ background: on ? "#191233" : "#0a0d17", fontFamily: "inherit", color: "#dfe6f5", border: `1.5px solid ${on ? "#a86bff" : line}`, boxShadow: on ? "0 0 12px rgba(168,107,255,.4)" : "none" }}>
                    <TplWallPreview tp={tp} map={MAPS[settings.map]} />
                    <span className="block text-[11px] font-bold" style={{ letterSpacing: 0.5 }}>{tp.icon} {tp.name}</span>
                    <span className="block text-[9px] mt-0.5 uppercase" style={{ color: diffColor, letterSpacing: 2 }}>{tp.diff}{on ? " · ✔" : ""}</span>
                  </button>
                );
              })}
            </div>
            <div className="text-xs mt-3" style={{ color: dim }}>
              {customSet.length ? customSet.length + " drawing" + (customSet.length > 1 ? "s" : "") + " selected" : "nothing selected — the map's own drawings will be used"}
            </div>
            <div className="flex gap-3 justify-center mt-4 flex-wrap">
              <GradBtn onClick={() => { setCustomOpen(false); if (customSet.length) { setScreen("play"); initAudio(); startMatch(); } }}>
                {customSet.length ? "START CUSTOM MATCH ▶" : "CLOSE"}
              </GradBtn>
              {customSet.length > 0 && <GhostBtn onClick={() => setCustomSet([])}>CLEAR ALL</GhostBtn>}
              <GhostBtn onClick={() => setCustomOpen(false)}>BACK</GhostBtn>
            </div>
          </div>
        </div>
      )}

      {/* PAUSE */}
      {paused && screen === "play" && (
        <Modal>
          <h2 className="text-2xl font-bold mb-4" style={{ letterSpacing: 6 }}>PAUSED</h2>
          <div className="flex flex-col gap-3 min-w-[260px]">
            <GradBtn onClick={() => setPaused(false)}>RESUME ▶</GradBtn>
            <GhostBtn onClick={() => setMuted((m) => !m)}>SOUND: {muted ? "OFF" : "ON"}</GhostBtn>
            <GhostBtn onClick={backToMenu}>BACK TO MENU</GhostBtn>
          </div>
        </Modal>
      )}

      {/* ROUND END */}
      {roundEnd && (
        <Modal>
          <div className="text-sm tracking-[5px] mb-2" style={{ color: dim }}>ROUND {hud.round} RESULT</div>
          <div className="text-4xl font-bold mb-1" style={{ color: roundEnd.color, textShadow: `0 0 18px ${roundEnd.color}` }}>{roundEnd.acc}%</div>
          <div className="text-xl font-bold mb-2" style={{ color: roundEnd.color, letterSpacing: 4 }}>{roundEnd.ratingTxt}</div>
          <div className="text-sm mb-5" style={{ color: dim }}>
            {roundEnd.blocked
              ? <>🎈 {artistName(1 - roundEnd.artist)} blocked the art — round to the <b style={{ color: red }}>Wall Runner!</b></>
              : <>🔦 {artistName(roundEnd.artist)} traced it — round to the <b style={{ color: cyan }}>Laser Artist!</b></>}
          </div>
          <GradBtn onClick={nextAfterRound}>{roundEnd.last ? "SEE FINAL RESULT ▶" : "ROUND 2 — SWITCH ROLES ▶"}</GradBtn>
        </Modal>
      )}

      {/* FINAL RESULTS */}
      {finalRes && (
        <Modal>
          <div className="text-6xl mb-1.5">🏆</div>
          <div className="text-[26px] font-bold mb-3" style={{ letterSpacing: 3, color: finalRes.winner === -1 ? "#ffcf3f" : finalRes.winner === 0 ? cyan : red, textShadow: "0 0 16px currentColor" }}>
            {finalRes.winner === -1 ? "IT'S A TIE!" : "PLAYER " + (finalRes.winner + 1) + " WINS!"}
          </div>
          <table className="mx-auto mb-5 text-sm"><tbody>
            <tr>
              <td className="px-4 py-1.5" style={{ color: cyan, borderBottom: `1px solid ${line}` }}>Player 1 accuracy</td>
              <td className="px-4 py-1.5" style={{ borderBottom: `1px solid ${line}` }}>{finalRes.accs[0]}% — {rating(finalRes.accs[0])[0]}</td>
            </tr>
            <tr>
              <td className="px-4 py-1.5" style={{ color: red, borderBottom: `1px solid ${line}` }}>Player 2 accuracy</td>
              <td className="px-4 py-1.5" style={{ borderBottom: `1px solid ${line}` }}>{finalRes.accs[1]}% — {rating(finalRes.accs[1])[0]}</td>
            </tr>
          </tbody></table>
          <div className="flex flex-col gap-3 min-w-[260px]">
            <GradBtn onClick={() => { setFinalRes(null); startMatch(); }}>REMATCH ▶</GradBtn>
            <GhostBtn onClick={backToMenu}>BACK TO MENU</GhostBtn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── small UI helpers ── */
function Modal({ children }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-30" style={{ background: "#07080fee" }}>
      <div className="rounded-3xl px-11 py-8 text-center" style={{ background: "#0e111c", border: "1.5px solid #1c2236", boxShadow: "0 0 60px rgba(56,199,255,.12)" }}>{children}</div>
    </div>
  );
}
function GradBtn({ children, onClick }) {
  return <button onClick={onClick} className="cursor-pointer rounded-2xl font-bold text-white transition-transform hover:scale-105"
    style={{ padding: "13px 30px", fontSize: 16, letterSpacing: 3, border: "none", background: "linear-gradient(90deg,#3a7bfd,#ff4d5a)", boxShadow: "0 0 20px rgba(90,120,255,.4)", fontFamily: "inherit" }}>{children}</button>;
}
function GhostBtn({ children, onClick }) {
  return <button onClick={onClick} className="cursor-pointer rounded-xl"
    style={{ padding: "12px 30px", fontSize: 15, letterSpacing: 2, background: "#0e111c", border: "1.5px solid #1c2236", color: "#dfe6f5", fontFamily: "inherit" }}>{children}</button>;
}
function Key({ children }) {
  return <span className="inline-block rounded px-1.5 mx-px" style={{ background: "#060810", border: "1px solid #1c2236", color: "#dfe6f5", fontFamily: "monospace" }}>{children}</span>;
}
