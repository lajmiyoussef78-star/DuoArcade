import { useState, useEffect, useRef, useCallback } from "react";

/* ═══════════════════ CONSTANTS ═══════════════════ */
const W = 1000, H = 600, GROUND = 520;

const ARENAS = [
  { name: "Thunder Grid", desc: "storm clouds · ⚡ lightning flashes", glow: "rgba(168,107,255,.55)", sky: ["#0d0a1e", "#1a1033"], floor: "#a86bff", fx: "lightning", plats: [[180, 400, 180], [640, 400, 180], [410, 290, 180]] },
  { name: "Cryo Circuit", desc: "falling snow · ❄ frozen platforms", glow: "rgba(56,199,255,.55)", sky: ["#081018", "#0e2233"], floor: "#38c7ff", fx: "snow", plats: [[120, 410, 160], [720, 410, 160], [420, 300, 160]] },
  { name: "Meteor Bay", desc: "asteroid dome · ☄ meteor showers", glow: "rgba(255,138,60,.55)", sky: ["#160b06", "#33150a"], floor: "#ff8a3c", fx: "meteor", plats: [[250, 395, 140], [610, 395, 140], [80, 285, 130], [790, 285, 130]] },
  { name: "Blackout Sector", desc: "sweeping searchlights · 🔦 dark ops", glow: "rgba(190,190,220,.4)", sky: ["#05060a", "#0b0d16"], floor: "#cfd6ff", fx: "search", plats: [[190, 400, 170], [640, 400, 170], [415, 285, 170]] },
  { name: "Laser Lab", desc: "neon beams · 🔬 experimental zone", glow: "rgba(77,255,158,.55)", sky: ["#06120c", "#0b2417"], floor: "#4dff9e", fx: "laser", plats: [[140, 415, 150], [710, 415, 150], [300, 305, 140], [560, 305, 140]] },
  { name: "Fault Line", desc: "cracked floor · 🌍 quakes every 15 s", glow: "rgba(255,207,63,.5)", sky: ["#120e06", "#2b2008"], floor: "#ffcf3f", fx: "quake", plats: [[180, 405, 170], [650, 405, 170], [415, 295, 170]] },
];

/* ═══════════════════ ANIMATED ARENA CARD ═══════════════════ */
function miniMan(g, x, y, col, ph, face, hasBomb, t) {
  g.strokeStyle = col; g.lineWidth = 2; g.lineCap = "round";
  g.shadowColor = col; g.shadowBlur = 6;
  const bob = Math.abs(Math.sin(ph)) * 1.4;
  const hy = y - 24 - bob, hip = y - 9 - bob, lp = Math.sin(ph) * 5;
  g.beginPath(); g.arc(x, hy, 4, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(x, hy + 4); g.lineTo(x, hip); g.stroke();
  g.beginPath(); g.moveTo(x, hip); g.lineTo(x + lp, y); g.moveTo(x, hip); g.lineTo(x - lp, y); g.stroke();
  g.beginPath();
  if (hasBomb) {
    const bx = x + 8 * face, by = hy + 7;
    g.moveTo(x, hy + 6); g.lineTo(bx, by);
    g.moveTo(x, hy + 8); g.lineTo(bx, by + 2);
    g.stroke(); g.shadowBlur = 0;
    g.fillStyle = "#14161f"; g.strokeStyle = Math.floor(t * 6) % 2 ? "#ff4d5a" : "#3a4258"; g.lineWidth = 1.4;
    g.beginPath(); g.arc(bx + 3 * face, by, 4, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = "#c9a055"; g.beginPath(); g.moveTo(bx + 4 * face, by - 3); g.lineTo(bx + 6 * face, by - 6); g.stroke();
    g.fillStyle = Math.floor(t * 8) % 2 ? "#ffcf3f" : "#ff8a3c";
    g.beginPath(); g.arc(bx + 6 * face, by - 7, 1.4, 0, 7); g.fill();
  } else {
    const ap = Math.sin(ph) * 4;
    g.moveTo(x, hy + 6); g.lineTo(x + 3 + ap * 0.6, hy + 12);
    g.moveTo(x, hy + 6); g.lineTo(x - 3 - ap * 0.6, hy + 12);
    g.stroke(); g.shadowBlur = 0;
  }
}

function ArenaCard({ i, selected, onSelect }) {
  const ref = useRef(null);
  useEffect(() => {
    const cvs = ref.current; if (!cvs) return;
    const A = ARENAS[i];
    const items = []; let boltT = Math.random() * 3, flash = 0, raf;
    const tick = (ts) => {
      raf = requestAnimationFrame(tick);
      const t = ts / 1000, g = cvs.getContext("2d"), w = 230, h = 120, gr = 96;
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, A.sky[0]); bg.addColorStop(1, A.sky[1]);
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      if (A.fx === "snow" && Math.random() < 0.3) items.push({ x: Math.random() * w, y: 0, vy: 0.5 + Math.random() * 0.5, type: "s" });
      if (A.fx === "meteor" && Math.random() < 0.04) items.push({ x: Math.random() * w + 40, y: 0, vx: -1.6, vy: 1.6, type: "m" });
      if (A.fx === "lightning") { boltT -= 0.016; if (boltT <= 0) { boltT = 2 + Math.random() * 3; flash = 0.5; } }
      for (let k = items.length - 1; k >= 0; k--) {
        const f = items[k];
        if (f.type === "s") { f.y += f.vy; g.fillStyle = "rgba(220,240,255,.8)"; g.fillRect(f.x, f.y, 1.6, 1.6); if (f.y > h) items.splice(k, 1); }
        if (f.type === "m") { f.x += f.vx; f.y += f.vy; g.strokeStyle = "rgba(255,150,60,.7)"; g.beginPath(); g.moveTo(f.x + 6, f.y - 6); g.lineTo(f.x, f.y); g.stroke(); if (f.y > h) items.splice(k, 1); }
      }
      if (flash > 0) { g.fillStyle = "rgba(190,160,255," + flash * 0.35 + ")"; g.fillRect(0, 0, w, h); flash -= 0.05; }
      if (A.fx === "search") {
        const sx = w / 2 + Math.sin(t * 0.6 + i) * 70;
        g.fillStyle = "rgba(200,210,255,0.09)";
        g.beginPath(); g.moveTo(sx - 8, 0); g.lineTo(sx + 8, 0); g.lineTo(sx + 30, gr); g.lineTo(sx - 30, gr); g.closePath(); g.fill();
      }
      if (A.fx === "laser") for (let k = 0; k < 2; k++) { const ly = 30 + k * 35 + Math.sin(t + k) * 8; g.strokeStyle = "rgba(77,255,158,.25)"; g.beginPath(); g.moveTo(0, ly); g.lineTo(w, ly); g.stroke(); }
      g.shadowColor = A.floor; g.shadowBlur = 8;
      g.strokeStyle = A.floor; g.lineWidth = 3;
      g.beginPath(); g.moveTo(6, gr); g.lineTo(w - 6, gr); g.stroke();
      g.lineWidth = 2;
      for (const [px, py, pw] of A.plats) { g.beginPath(); g.moveTo(px * 0.23, py * 0.2); g.lineTo((px + pw) * 0.23, py * 0.2); g.stroke(); }
      g.shadowBlur = 0;
      const x1 = 115 + Math.sin(t * 0.9 + i) * 62, x2 = 115 + Math.sin(t * 0.9 + i + 0.7) * 62;
      const f1 = Math.cos(t * 0.9 + i) >= 0 ? 1 : -1, f2 = Math.cos(t * 0.9 + i + 0.7) >= 0 ? 1 : -1;
      miniMan(g, x1, gr, "#38c7ff", t * 7 + i, f1, true, t);
      miniMan(g, x2, gr, "#ff4d5a", t * 7 + i + 2, f2, false, t);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [i]);
  const A = ARENAS[i];
  return (
    <div onClick={() => onSelect(i)}
      className="cursor-pointer rounded-2xl p-2.5 pb-3 transition-transform hover:-translate-y-1"
      style={{ background: "#0e111c", border: "1.5px solid #1c2236", boxShadow: selected ? `0 0 18px ${A.glow}` : "none" }}>
      <canvas ref={ref} width={230} height={120} className="w-full rounded-xl block bg-black" />
      <div className="font-bold tracking-widest mt-2 mb-1 text-sm">{A.name}</div>
      <div className="text-[11px] leading-relaxed" style={{ color: "#8b93ab" }}>{A.desc}</div>
    </div>
  );
}

/* ═══════════════════ MAIN GAME ═══════════════════ */
export default function StickmanBombTag() {
  const canvasRef = useRef(null);
  const [screen, setScreen] = useState("menu"); // menu | play
  const [settings, setSettings] = useState({ rounds: 3, fuse: 45, arena: 0 });
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [scores, setScores] = useState([0, 0]);
  const [round, setRound] = useState(1);
  const [timerTxt, setTimerTxt] = useState("45.0");
  const [danger, setDanger] = useState(false);
  const [centerHtml, setCenterHtml] = useState(null);
  const [banner, setBanner] = useState(null);
  const [results, setResults] = useState(null);
  const [isTouch] = useState(() => typeof window !== "undefined" && "ontouchstart" in window);

  const settingsRef = useRef(settings); settingsRef.current = settings;
  const mutedRef = useRef(muted); mutedRef.current = muted;
  const pausedRef = useRef(paused); pausedRef.current = paused;

  const E = useRef({
    state: "menu", players: [], bombHolder: 0, bombT: 45, round: 1, scores: [0, 0], startHolder: 0,
    parts: [], debris: [], shock: [], flashA: 0, shakeT: 0, shakeAmp: 0, slowMo: 1,
    fxItems: [], lightT: 0, quakeT: 0, countT: 0, bannerT: 0, lastCn: 0,
    passLockUntil: 0, now: 0, keys: {}, tickAt: 0,
  }).current;
  const audio = useRef({ AC: null, master: null }).current;

  /* ---------- audio ---------- */
  const initAudio = useCallback(() => {
    if (!audio.AC) {
      audio.AC = new (window.AudioContext || window.webkitAudioContext)();
      audio.master = audio.AC.createGain();
      audio.master.gain.value = mutedRef.current ? 0 : 1;
      audio.master.connect(audio.AC.destination);
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
  const boom = useCallback(() => {
    if (!audio.AC || mutedRef.current) return;
    const N = audio.AC.sampleRate * 0.6, buf = audio.AC.createBuffer(1, N, audio.AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < N; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / N, 2.2);
    const s = audio.AC.createBufferSource(), g = audio.AC.createGain(), f = audio.AC.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 500;
    s.buffer = buf; g.gain.value = 0.25;
    s.connect(f); f.connect(g); g.connect(audio.master); s.start();
  }, [audio]);

  /* ---------- game helpers ---------- */
  const makePlayer = (i) => ({ i, x: i === 0 ? 260 : 740, y: GROUND, vx: 0, vy: 0, onGround: true, jumps: 0, face: i === 0 ? 1 : -1, run: 0, color: i === 0 ? "#38c7ff" : "#ff4d5a", dead: false });
  const needWins = () => Math.ceil(settingsRef.current.rounds / 2);

  const tryJump = useCallback((p) => {
    if (!p || p.dead) return;
    if (p.onGround || p.jumps < 2) { p.vy = -620; p.onGround = false; p.jumps++; beep(300 + p.jumps * 80, 0.07, 0.03, "triangle"); }
  }, [beep]);

  const tryPass = useCallback((who) => {
    if (E.state !== "play" || who !== E.bombHolder) return;
    if (E.now < E.passLockUntil) return;
    const a = E.players[E.bombHolder], b = E.players[1 - E.bombHolder];
    const d = Math.hypot(a.x - b.x, (a.y - 34) - (b.y - 34));
    if (d < 75) {
      E.bombHolder = 1 - E.bombHolder;
      E.passLockUntil = E.now + 0.8;
      beep(900, 0.08, 0.06); beep(1300, 0.06, 0.05);
      for (let i = 0; i < 10; i++) E.parts.push({ x: b.x, y: b.y - 40, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0.4, color: "#ffcf3f", size: 3 });
    } else beep(180, 0.08, 0.03, "triangle");
  }, [E, beep]);

  const startRound = useCallback(() => {
    E.players = [makePlayer(0), makePlayer(1)];
    E.bombHolder = E.startHolder;
    E.bombT = settingsRef.current.fuse;
    E.parts = []; E.debris = []; E.shock = []; E.flashA = 0; E.shakeAmp = 0; E.slowMo = 1;
    E.fxItems = []; E.quakeT = 0; E.passLockUntil = 0; E.lastCn = 0;
    setRound(E.round); setBanner(null);
    E.state = "countdown"; E.countT = 3;
  }, [E]);

  const startMatch = useCallback(() => {
    E.scores = [0, 0]; E.round = 1; E.startHolder = Math.random() < 0.5 ? 0 : 1;
    setScores([0, 0]); setResults(null);
    startRound();
  }, [E, startRound]);

  const afterBanner = useCallback(() => {
    if (E.scores[0] >= needWins() || E.scores[1] >= needWins()) {
      const w = E.scores[0] > E.scores[1] ? 0 : 1;
      setResults({ winner: w, color: w === 0 ? "#38c7ff" : "#ff4d5a", score: E.scores[0] + " — " + E.scores[1] });
      E.state = "done";
    } else { E.round++; E.startHolder = 1 - E.startHolder; startRound(); }
  }, [E, startRound]);

  const endRound = useCallback(() => {
    const survivor = 1 - E.bombHolder;
    E.scores[survivor]++;
    setScores([...E.scores]);
    E.state = "banner"; E.bannerT = 2.2;
    setBanner({ text: "PLAYER " + (survivor + 1) + " SURVIVES!", color: survivor === 0 ? "#38c7ff" : "#ff4d5a" });
  }, [E]);

  const explode = useCallback(() => {
    const p = E.players[E.bombHolder];
    p.dead = true;
    E.state = "explode"; E.slowMo = 0.35; setTimeout(() => (E.slowMo = 1), 700);
    boom();
    E.shakeT = 0.9; E.shakeAmp = 22; E.flashA = 1;
    E.shock.push({ x: p.x, y: p.y - 34, r: 6, v: 900, life: 0.7 });
    E.shock.push({ x: p.x, y: p.y - 34, r: 2, v: 520, life: 0.9 });
    const cx = p.x, cy = p.y - 40;
    for (const s of [{ len: 0, head: true }, { len: 26 }, { len: 20 }, { len: 20 }, { len: 24 }, { len: 24 }]) {
      const a = Math.random() * 6.28, sp = 260 + Math.random() * 420;
      E.debris.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 260, ang: Math.random() * 6.28, vang: (Math.random() - 0.5) * 16, len: s.len, head: !!s.head, color: p.color, life: 2.4 });
    }
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * 6.28, sp = Math.random() * 560;
      E.parts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 160, life: 0.5 + Math.random() * 0.9, color: ["#ffcf3f", "#ff8a3c", "#ff4d5a", "#fff"][i % 4], size: 2 + Math.random() * 4 });
    }
    setTimeout(endRound, 1600);
  }, [E, boom, endRound]);

  /* ---------- physics ---------- */
  const updatePlayer = useCallback((p, dt) => {
    if (p.dead) return;
    const k = E.keys;
    const left = p.i === 0 ? k["KeyA"] : k["ArrowLeft"];
    const right = p.i === 0 ? k["KeyD"] : k["ArrowRight"];
    const SPD = 300;
    if (left) { p.vx = -SPD; p.face = -1; }
    else if (right) { p.vx = SPD; p.face = 1; }
    else p.vx *= Math.pow(0.0001, dt);
    p.vy += 1700 * dt;
    const oldY = p.y;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.x = Math.max(24, Math.min(W - 24, p.x));
    p.onGround = false;
    if (p.y >= GROUND) { p.y = GROUND; p.vy = 0; p.onGround = true; p.jumps = 0; }
    else if (p.vy > 0) {
      for (const [px, py, pw] of ARENAS[settingsRef.current.arena].plats) {
        if (p.x > px - 8 && p.x < px + pw + 8 && oldY <= py + 2 && p.y >= py && p.y <= py + 26) {
          p.y = py; p.vy = 0; p.onGround = true; p.jumps = 0; break;
        }
      }
    }
    p.run += Math.abs(p.vx) * dt * 0.05;
  }, [E]);

  /* ---------- arena fx ---------- */
  const makeBolt = () => {
    const s = []; let x = 0, y = 0;
    while (y < GROUND - 60) { s.push([x, y]); y += 30 + Math.random() * 40; x += (Math.random() - 0.5) * 70; }
    s.push([x, GROUND - 40]); return s;
  };
  const updateFX = useCallback((dt) => {
    const A = ARENAS[settingsRef.current.arena];
    if (A.fx === "snow" && Math.random() < 0.35) E.fxItems.push({ x: Math.random() * W, y: -8, vx: 20 + Math.random() * 20, vy: 50 + Math.random() * 60, r: 1.5 + Math.random() * 2.5, type: "snow" });
    if (A.fx === "meteor" && Math.random() < 0.05) E.fxItems.push({ x: Math.random() * W + 200, y: -20, vx: -220 - Math.random() * 160, vy: 220 + Math.random() * 160, r: 2 + Math.random() * 3, type: "meteor", trail: [] });
    if (A.fx === "lightning") { E.lightT -= dt; if (E.lightT <= 0) { E.lightT = 2.5 + Math.random() * 4; E.fxItems.push({ type: "bolt", x: 80 + Math.random() * (W - 160), life: 0.22, segs: makeBolt() }); if (E.state === "play") beep(90, 0.2, 0.03, "sawtooth"); } }
    if (A.fx === "quake") { E.quakeT += dt; if (E.quakeT > 15) { E.quakeT = 0; E.shakeT = 0.8; E.shakeAmp = 10; } }
    for (let i = E.fxItems.length - 1; i >= 0; i--) {
      const f = E.fxItems[i];
      if (f.type === "snow") { f.x += f.vx * dt; f.y += f.vy * dt; if (f.y > H) E.fxItems.splice(i, 1); }
      else if (f.type === "meteor") { f.trail.push([f.x, f.y]); if (f.trail.length > 8) f.trail.shift(); f.x += f.vx * dt; f.y += f.vy * dt; if (f.y > H || f.x < -40) E.fxItems.splice(i, 1); }
      else if (f.type === "bolt") { f.life -= dt; if (f.life <= 0) E.fxItems.splice(i, 1); }
    }
  }, [E, beep]);

  /* ---------- drawing ---------- */
  const drawBomb = useCallback((ctx, x, y, t) => {
    const dangerNow = E.bombT < 10;
    const pulse = dangerNow ? 1 + Math.sin(t * 18) * 0.12 : 1 + Math.sin(t * 5) * 0.04;
    ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse);
    ctx.fillStyle = dangerNow && Math.floor(t * 10) % 2 ? "#5a1620" : "#14161f";
    ctx.strokeStyle = dangerNow ? "#ff4d5a" : "#3a4258";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.arc(-4, -4, 3, 0, 7); ctx.fill();
    ctx.strokeStyle = "#c9a055"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(3, -10); ctx.quadraticCurveTo(8, -16, 12, -14); ctx.stroke();
    ctx.restore();
    E.parts.push({ x: x + 12, y: y - 14, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 40, life: 0.25, color: Math.random() < 0.5 ? "#ffcf3f" : "#ff8a3c", size: 1.5 + Math.random() * 1.5 });
  }, [E]);

  const drawStickman = useCallback((ctx, p, t) => {
    if (p.dead) return;
    const holding = E.bombHolder === p.i && (E.state === "play" || E.state === "countdown");
    const x = p.x, y = p.y;
    ctx.strokeStyle = p.color; ctx.lineWidth = 3.4; ctx.lineCap = "round";
    ctx.shadowColor = p.color; ctx.shadowBlur = 10;
    const bob = p.onGround ? Math.sin(p.run * 2) * 1.5 : 0;
    const hy = y - 58 + bob;
    ctx.beginPath(); ctx.arc(x, hy, 10, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, hy + 10); ctx.lineTo(x, y - 26 + bob); ctx.stroke();
    const lp = Math.sin(p.run * 4), moving = Math.abs(p.vx) > 40;
    ctx.beginPath();
    if (!p.onGround) { ctx.moveTo(x, y - 26 + bob); ctx.lineTo(x - 9 * p.face, y - 8); ctx.moveTo(x, y - 26 + bob); ctx.lineTo(x + 13 * p.face, y - 12); }
    else if (moving) { ctx.moveTo(x, y - 26 + bob); ctx.lineTo(x + lp * 13, y); ctx.moveTo(x, y - 26 + bob); ctx.lineTo(x - lp * 13, y); }
    else { ctx.moveTo(x, y - 26 + bob); ctx.lineTo(x - 7, y); ctx.moveTo(x, y - 26 + bob); ctx.lineTo(x + 7, y); }
    ctx.stroke();
    ctx.beginPath();
    if (holding) {
      const bx = x + 16 * p.face, by = hy + 18;
      ctx.moveTo(x, hy + 16); ctx.lineTo(bx, by);
      ctx.moveTo(x, hy + 20); ctx.lineTo(bx, by + 3);
      ctx.stroke();
      drawBomb(ctx, bx + 4 * p.face, by - 2, t);
    } else {
      const ap = moving ? Math.sin(p.run * 4) * 10 : 3;
      ctx.moveTo(x, hy + 16); ctx.lineTo(x - 8 + ap * 0.5, hy + 30);
      ctx.moveTo(x, hy + 16); ctx.lineTo(x + 8 - ap * 0.5, hy + 30);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    if (holding && E.state === "play") {
      const other = E.players[1 - p.i];
      const d = Math.hypot(p.x - other.x, (p.y - 34) - (other.y - 34));
      if (d < 75) {
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y - 34, 44, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }, [E, drawBomb]);

  const draw = useCallback((t) => {
    const cvs = canvasRef.current; if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const A = ARENAS[settingsRef.current.arena];
    ctx.save();
    if (E.shakeT > 0) ctx.translate((Math.random() - 0.5) * E.shakeAmp, (Math.random() - 0.5) * E.shakeAmp);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, A.sky[0]); g.addColorStop(1, A.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (const f of E.fxItems) {
      if (f.type === "snow") { ctx.fillStyle = "rgba(220,240,255,0.8)"; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill(); }
      if (f.type === "meteor") {
        ctx.strokeStyle = "rgba(255,150,60,0.6)"; ctx.lineWidth = 2;
        ctx.beginPath(); for (let i = 0; i < f.trail.length; i++) { const [tx, ty] = f.trail[i]; i ? ctx.lineTo(tx, ty) : ctx.moveTo(tx, ty); } ctx.stroke();
        ctx.fillStyle = "#ffb066"; ctx.shadowColor = "#ff8a3c"; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      }
      if (f.type === "bolt") {
        ctx.strokeStyle = "rgba(210,180,255," + f.life * 4 + ")"; ctx.lineWidth = 3;
        ctx.shadowColor = "#a86bff"; ctx.shadowBlur = 16;
        ctx.beginPath(); for (let i = 0; i < f.segs.length; i++) { const [sx, sy] = f.segs[i]; i ? ctx.lineTo(f.x + sx, sy) : ctx.moveTo(f.x + sx, sy); } ctx.stroke();
        ctx.shadowBlur = 0;
        E.flashA = Math.max(E.flashA, f.life * 0.7);
      }
    }
    if (A.fx === "search") {
      const sx = W / 2 + Math.sin(t * 0.5) * 380;
      const grad = ctx.createLinearGradient(sx - 90, 0, sx + 90, 0);
      grad.addColorStop(0, "rgba(200,210,255,0)"); grad.addColorStop(0.5, "rgba(200,210,255,0.08)"); grad.addColorStop(1, "rgba(200,210,255,0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(sx - 30, 0); ctx.lineTo(sx + 30, 0); ctx.lineTo(sx + 130, GROUND); ctx.lineTo(sx - 130, GROUND); ctx.closePath(); ctx.fill();
    }
    if (A.fx === "laser") {
      for (let i = 0; i < 3; i++) {
        const ly = 140 + i * 120 + Math.sin(t * 0.8 + i * 2) * 30;
        ctx.strokeStyle = "rgba(77,255,158," + (0.10 + 0.06 * Math.sin(t * 3 + i)) + ")";
        ctx.lineWidth = 2; ctx.shadowColor = "#4dff9e"; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke(); ctx.shadowBlur = 0;
      }
    }
    ctx.shadowColor = A.floor; ctx.shadowBlur = 18;
    ctx.strokeStyle = A.floor; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(20, GROUND + 8); ctx.lineTo(W - 20, GROUND + 8); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(20, GROUND + 4); ctx.lineTo(W - 20, GROUND + 4); ctx.stroke();
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 10; i++) {
      const dx = 20 + ((t * 120 + i * 100) % (W - 40));
      ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(dx, GROUND + 8, 2.2, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const [px, py, pw] of A.plats) {
      ctx.shadowColor = A.floor; ctx.shadowBlur = 12;
      ctx.strokeStyle = A.floor; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(px, py + 6); ctx.lineTo(px + pw, py + 6); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(px, py + 2); ctx.lineTo(px + pw, py + 2); ctx.stroke();
    }
    for (const p of E.players) drawStickman(ctx, p, t);
    for (const d of E.debris) {
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.ang);
      ctx.strokeStyle = d.color; ctx.shadowColor = d.color; ctx.shadowBlur = 8;
      ctx.globalAlpha = Math.min(1, d.life);
      if (d.head) { ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.stroke(); }
      else { ctx.lineWidth = 3.4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-d.len / 2, 0); ctx.lineTo(d.len / 2, 0); ctx.stroke(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    for (const s of E.shock) {
      ctx.strokeStyle = "rgba(255,207,63," + Math.max(0, s.life) + ")";
      ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.stroke();
    }
    for (const q of E.parts) {
      ctx.globalAlpha = Math.max(0, q.life * 2); ctx.fillStyle = q.color;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (E.flashA > 0) { ctx.fillStyle = "rgba(255,240,220," + E.flashA + ")"; ctx.fillRect(0, 0, W, H); }
  }, [E, drawStickman]);

  /* ---------- main loop ---------- */
  useEffect(() => {
    let raf, last = 0;
    const loop = (ts) => {
      raf = requestAnimationFrame(loop);
      const rdt = Math.min(0.033, (ts - last) / 1000 || 0.016); last = ts;
      const t = ts / 1000; E.now = t;
      if (pausedRef.current || E.state === "menu" || E.state === "done") return;
      const dt = rdt * E.slowMo;
      if (E.shakeT > 0) { E.shakeT -= rdt; E.shakeAmp *= 0.94; }
      if (E.flashA > 0) E.flashA -= rdt * 2.4;
      updateFX(dt);
      if (E.state === "countdown") {
        E.countT -= rdt;
        if (E.countT > 0) {
          const n = Math.ceil(E.countT);
          if (E.lastCn !== n) { E.lastCn = n; beep(440, 0.1, 0.05); setCenterHtml({ big: String(n) }); }
        } else {
          setCenterHtml({ big: "GO!", small: "💣 PLAYER " + (E.bombHolder + 1) + " HAS THE BOMB" });
          beep(880, 0.25, 0.06);
          setTimeout(() => setCenterHtml(null), 900);
          E.state = "play";
        }
      }
      if (E.state === "play") {
        E.bombT -= dt;
        setTimerTxt(Math.max(0, E.bombT).toFixed(1));
        setDanger(E.bombT < 10);
        const rate = E.bombT > 15 ? 1 : E.bombT > 7 ? 0.5 : E.bombT > 3 ? 0.25 : 0.12;
        if (t - E.tickAt > rate) { E.tickAt = t; beep(E.bombT < 7 ? 1100 : 800, 0.04, 0.04, "square"); }
        if (E.bombT <= 0) { E.bombT = 0; explode(); }
        for (const p of E.players) updatePlayer(p, dt);
      }
      if (E.state === "explode") for (const p of E.players) updatePlayer(p, dt);
      if (E.state === "banner") {
        E.bannerT -= rdt;
        for (const p of E.players) updatePlayer(p, dt);
        if (E.bannerT <= 0) afterBanner();
      }
      for (let i = E.debris.length - 1; i >= 0; i--) {
        const d = E.debris[i];
        d.vy += 1500 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.ang += d.vang * dt; d.life -= dt * 0.6;
        if (d.y > GROUND) { d.y = GROUND; d.vy *= -0.4; d.vx *= 0.7; d.vang *= 0.7; }
        if (d.life <= 0) E.debris.splice(i, 1);
      }
      for (const s of E.shock) { s.r += s.v * rdt; s.life -= rdt * 1.3; }
      E.shock = E.shock.filter((s) => s.life > 0);
      for (let i = E.parts.length - 1; i >= 0; i--) {
        const q = E.parts[i]; q.x += q.vx * rdt; q.y += q.vy * rdt; q.vy += 300 * rdt; q.life -= rdt;
        if (q.life <= 0) E.parts.splice(i, 1);
      }
      draw(t);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [E, beep, draw, explode, afterBanner, updateFX, updatePlayer]);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const dn = (e) => {
      E.keys[e.code] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
      if (e.code === "Escape") setPaused((p) => (E.state === "play" || E.state === "countdown" ? !p : p));
      if (E.state === "play" && !pausedRef.current) {
        if (e.code === "KeyW") tryJump(E.players[0]);
        if (e.code === "ArrowUp") tryJump(E.players[1]);
        if (e.code === "KeyE") tryPass(0);
        if (e.code === "KeyM") tryPass(1);
      }
    };
    const up = (e) => (E.keys[e.code] = false);
    addEventListener("keydown", dn); addEventListener("keyup", up);
    return () => { removeEventListener("keydown", dn); removeEventListener("keyup", up); };
  }, [E, tryJump, tryPass]);

  /* ---------- canvas tap-to-pass (phones) ---------- */
  const onCanvasTouch = (e) => {
    if (E.state !== "play") return;
    const r = canvasRef.current.getBoundingClientRect();
    for (const t of e.changedTouches) {
      const x = ((t.clientX - r.left) / r.width) * W, y = ((t.clientY - r.top) / r.height) * H;
      const other = E.players[1 - E.bombHolder];
      if (Math.abs(x - other.x) < 45 && Math.abs(y - (other.y - 34)) < 55) tryPass(E.bombHolder);
    }
  };

  /* ---------- touch button helper ---------- */
  const touchBtn = (k, label, style = {}) => {
    const press = (e) => {
      e.preventDefault(); E.keys[k] = true;
      if (E.state === "play") {
        if (k === "KeyW") tryJump(E.players[0]);
        if (k === "ArrowUp") tryJump(E.players[1]);
        if (k === "KeyE") tryPass(0);
        if (k === "KeyM") tryPass(1);
      }
    };
    const release = (e) => { e.preventDefault(); E.keys[k] = false; };
    return (
      <div key={k}
        onTouchStart={press} onTouchEnd={release} onTouchCancel={release}
        onMouseDown={press} onMouseUp={release}
        className="flex items-center justify-center rounded-2xl select-none"
        style={{ width: 62, height: 62, background: "#0a0d17cc", border: "2px solid #1c2236", color: "#dfe6f5", fontSize: label.length > 2 ? 13 : 24, fontWeight: label.length > 2 ? "bold" : "normal", touchAction: "none", ...style }}>
        {label}
      </div>
    );
  };

  const startMatchUI = () => { setScreen("play"); initAudio(); startMatch(); };
  const backToMenu = () => {
    setScreen("menu"); setPaused(false); setResults(null); setBanner(null); setCenterHtml(null);
    E.state = "menu";
    const c = canvasRef.current; if (c) c.getContext("2d").clearRect(0, 0, W, H);
  };

  const dim = "#8b93ab", line = "#1c2236", card = "#0e111c";
  const pillStyle = (sel) => ({
    background: sel ? "#0e2231" : card, color: "#dfe6f5", fontFamily: "inherit",
    border: `1.5px solid ${sel ? "#38c7ff" : line}`,
    boxShadow: sel ? "0 0 14px rgba(56,199,255,.45)" : "none",
  });

  return (
    <div className="w-full h-screen overflow-hidden relative flex items-center justify-center" style={{ background: "#07080f", fontFamily: 'Consolas,"Courier New",monospace', color: "#dfe6f5" }}>
      <canvas ref={canvasRef} width={W} height={H} onTouchStart={onCanvasTouch}
        className="block rounded-xl"
        style={{ width: "min(98vw, calc(98vh * " + (W / H) + "))", aspectRatio: W + "/" + H, touchAction: "none", boxShadow: screen === "play" ? "0 0 50px rgba(56,199,255,.12)" : "none" }} />

      {/* HUD */}
      {screen === "play" && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute top-3 left-3.5 rounded-2xl px-4 py-2 font-bold" style={{ background: "#0a0d17d9", border: `1.5px solid ${line}`, color: "#38c7ff", boxShadow: "0 0 16px rgba(56,199,255,.25)" }}>
            <div className="text-[10px] tracking-widest" style={{ color: dim }}>PLAYER 1</div>
            <div className="text-2xl">{scores[0]}</div>
          </div>
          <div className="absolute top-3 right-3.5 rounded-2xl px-4 py-2 font-bold text-right" style={{ background: "#0a0d17d9", border: `1.5px solid ${line}`, color: "#ff4d5a", boxShadow: "0 0 16px rgba(255,77,90,.25)" }}>
            <div className="text-[10px] tracking-widest" style={{ color: dim }}>PLAYER 2</div>
            <div className="text-2xl">{scores[1]}</div>
          </div>
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 rounded-2xl px-6 font-bold"
            style={{ fontSize: 44, letterSpacing: 3, background: "#0a0d17d9", border: `1.5px solid ${line}`, color: danger ? "#ff4d5a" : "#dfe6f5", textShadow: danger ? "0 0 18px #ff4d5a" : "none", animation: danger ? "sbtPulse .5s infinite" : "none" }}>
            {timerTxt}
          </div>
          <div className="absolute top-[72px] left-1/2 -translate-x-1/2 text-xs" style={{ letterSpacing: 3, color: dim }}>ROUND {round}</div>
          <div className="absolute top-3 flex gap-2 pointer-events-auto" style={{ left: "calc(50% + 150px)" }}>
            <button onClick={() => setPaused(true)} className="w-10 h-10 rounded-xl cursor-pointer text-base" style={{ background: "#0a0d17d9", border: `1.5px solid ${line}`, color: "#dfe6f5" }}>⏸</button>
            <button onClick={() => setMuted((m) => !m)} className="w-10 h-10 rounded-xl cursor-pointer text-base" style={{ background: "#0a0d17d9", border: `1.5px solid ${line}`, color: "#dfe6f5" }}>{muted ? "🔇" : "🔊"}</button>
          </div>
          <style>{`@keyframes sbtPulse{50%{transform:translateX(-50%) scale(1.12)}}`}</style>
        </div>
      )}

      {/* countdown / GO */}
      {centerHtml && (
        <div className="absolute pointer-events-none z-[15] font-bold text-center" style={{ top: "34%", left: "50%", transform: "translate(-50%,-50%)", color: "#ffcf3f", textShadow: "0 0 30px rgba(255,207,63,.8)", letterSpacing: 5 }}>
          <div style={{ fontSize: 92 }}>{centerHtml.big}</div>
          {centerHtml.small && <div style={{ fontSize: 26 }}>{centerHtml.small}</div>}
        </div>
      )}
      {/* round banner */}
      {banner && (
        <div className="absolute pointer-events-none z-[15] font-bold text-center" style={{ top: "30%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 40, letterSpacing: 4, color: banner.color, textShadow: `0 0 20px ${banner.color}` }}>
          {banner.text}
        </div>
      )}

      {/* touch controls */}
      {isTouch && screen === "play" && (
        <>
          <div className="absolute bottom-3 left-3 flex gap-2.5 z-[12]">
            {touchBtn("KeyA", "◀")}{touchBtn("KeyD", "▶")}{touchBtn("KeyW", "⤒")}{touchBtn("KeyE", "PASS", { borderColor: "#38c7ff" })}
          </div>
          <div className="absolute bottom-3 right-3 flex gap-2.5 z-[12]">
            {touchBtn("KeyM", "PASS", { borderColor: "#ff4d5a" })}{touchBtn("ArrowUp", "⤒")}{touchBtn("ArrowLeft", "◀")}{touchBtn("ArrowRight", "▶")}
          </div>
        </>
      )}

      {/* MENU */}
      {screen === "menu" && (
        <div className="absolute inset-0 z-20 overflow-auto flex justify-center" style={{ background: "#07080fee" }}>
          <div className="w-full max-w-[880px] px-3 pt-6 pb-10 text-center">
            <h1 className="text-4xl font-bold mb-1" style={{ letterSpacing: 9 }}>
              <span style={{ color: "#38c7ff", textShadow: "0 0 14px #38c7ff,0 0 40px rgba(56,199,255,.4)" }}>STICKMAN</span>{" 💣 "}
              <span style={{ color: "#ff4d5a", textShadow: "0 0 14px #ff4d5a,0 0 40px rgba(255,77,90,.4)" }}>BOMB TAG</span>
            </h1>
            <div className="text-[13px] mb-3.5" style={{ color: dim, letterSpacing: 2 }}>pass the bomb before it blows · survivor wins the round</div>
            <button onClick={startMatchUI} className="cursor-pointer rounded-2xl font-bold text-white transition-transform hover:scale-105"
              style={{ padding: "15px 58px", fontSize: 20, letterSpacing: 5, border: "none", background: "linear-gradient(90deg,#3a7bfd,#ff4d5a)", boxShadow: "0 0 26px rgba(90,120,255,.45)", fontFamily: "inherit" }}>
              START MATCH ▶
            </button>

            <div className="text-sm font-bold mt-4 mb-2.5" style={{ letterSpacing: 2 }}>Match length:</div>
            <div className="flex gap-3 justify-center flex-wrap">
              {[{ r: 1, n: "Quick Match", s: "1 round" }, { r: 3, n: "Best of 3", s: "first to 2" }, { r: 5, n: "Best of 5", s: "first to 3" }].map((o) => (
                <button key={o.r} onClick={() => setSettings((s) => ({ ...s, rounds: o.r }))} className="cursor-pointer rounded-xl px-5 py-3 text-sm transition-transform hover:-translate-y-0.5" style={pillStyle(settings.rounds === o.r)}>
                  <b style={{ letterSpacing: 1 }}>{o.n}</b><small className="block mt-0.5" style={{ color: dim, fontSize: 11 }}>{o.s}</small>
                </button>
              ))}
            </div>

            <div className="text-sm font-bold mt-4 mb-2.5" style={{ letterSpacing: 2 }}>Bomb timer:</div>
            <div className="flex gap-3 justify-center flex-wrap">
              {[{ f: 30, s: "frantic" }, { f: 45, s: "classic" }, { f: 60, s: "long fuse" }].map((o) => (
                <button key={o.f} onClick={() => setSettings((s) => ({ ...s, fuse: o.f }))} className="cursor-pointer rounded-xl px-5 py-3 text-sm transition-transform hover:-translate-y-0.5" style={pillStyle(settings.fuse === o.f)}>
                  <b>{o.f} s</b><small className="block mt-0.5" style={{ color: dim, fontSize: 11 }}>{o.s}</small>
                </button>
              ))}
            </div>

            <div className="text-sm font-bold mt-4 mb-2.5" style={{ letterSpacing: 2 }}>Choose your arena:</div>
            <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))" }}>
              {ARENAS.map((_, i) => (
                <ArenaCard key={i} i={i} selected={settings.arena === i} onSelect={(a) => setSettings((s) => ({ ...s, arena: a }))} />
              ))}
            </div>

            <div className="flex gap-3.5 justify-center flex-wrap mt-6">
              <div className="flex-1 min-w-[280px] rounded-xl px-4 py-3 text-left text-xs leading-loose" style={{ background: card, border: `1.5px solid ${line}`, color: dim }}>
                <b style={{ color: "#38c7ff", letterSpacing: 2 }}>PLAYER 1</b><br />
                <Key>A</Key>/<Key>D</Key> — move · <Key>W</Key> — jump (again = double) · <Key>E</Key> — pass bomb
              </div>
              <div className="flex-1 min-w-[280px] rounded-xl px-4 py-3 text-left text-xs leading-loose" style={{ background: card, border: `1.5px solid ${line}`, color: dim }}>
                <b style={{ color: "#ff4d5a", letterSpacing: 2 }}>PLAYER 2</b><br />
                <Key>←</Key>/<Key>→</Key> — move · <Key>↑</Key> — jump (again = double) · <Key>M</Key> — pass bomb
              </div>
            </div>
            <div className="text-[13px] mt-3" style={{ color: dim, letterSpacing: 2 }}>
              📱 on phones: touch buttons appear · you can also tap the other stickman to pass<br />you must be CLOSE to the other player to pass the bomb!
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

      {/* RESULTS */}
      {results && (
        <Modal>
          <div className="text-6xl mb-1.5">🏆</div>
          <div className="text-[28px] font-bold mb-1.5" style={{ letterSpacing: 3, color: results.color, textShadow: `0 0 16px ${results.color}` }}>
            PLAYER {results.winner + 1} WINS!
          </div>
          <div className="mb-4" style={{ color: dim, letterSpacing: 2 }}>{results.score}</div>
          <div className="flex flex-col gap-3 min-w-[260px]">
            <GradBtn onClick={() => { setResults(null); startMatch(); }}>REMATCH ▶</GradBtn>
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
