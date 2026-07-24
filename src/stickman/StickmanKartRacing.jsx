import { useState, useEffect, useRef, useCallback } from "react";

/* ═══════════════════ GAME DATA ═══════════════════ */
const KART_TYPES = [
  { id: "classic", name: "Classic", ic: "🏎️" },
  { id: "formula", name: "Formula", ic: "🏁" },
  { id: "cyber", name: "Cyber", ic: "🤖" },
  { id: "buggy", name: "Buggy", ic: "🚙" },
  { id: "police", name: "Police", ic: "🚓" },
  { id: "fire", name: "Fire", ic: "🔥" },
  { id: "hover", name: "Hover", ic: "🛸" },
  { id: "rocket", name: "Rocket", ic: "🚀" },
];
const COLORS = ["#38c7ff", "#ff4d5a", "#4dff9e", "#ffcf3f", "#a86bff", "#ff2fd6", "#00e5c4", "#f5f5f5"];
const DARKS = ["#1273a3", "#a3202b", "#1f9e58", "#b08a10", "#6a30b8", "#a3128a", "#008a76", "#8a8a8a"];

const THEMES = [
  { name: "Hot Race", desc: "technical circuit · the original map", glow: "rgba(77,255,158,.5)", grass: "#3a8f4a", grass2: "#2e7a3c", deco: "#1f6330", road: "#33383d", border: "#f4a72c", dash: "#ffffff", grip: 1, label: "Hot Race" },
  { name: "Neon City", desc: "narrow street grid · sharp 90° corners", glow: "rgba(56,199,255,.55)", grass: "#12142b", grass2: "#0d0f22", deco: "#232659", road: "#1c1f2e", border: "#00e5ff", dash: "#ff2fd6", grip: 1, label: "Neon City", neon: true },
  { name: "Snow Mountain", desc: "huge wide curves · icy low grip", glow: "rgba(210,235,255,.55)", grass: "#dfeef7", grass2: "#cfe2ef", deco: "#b7d2e4", road: "#5d676f", border: "#ff5d3a", dash: "#ffffff", grip: 0.6, label: "Snow Run" },
  { name: "Volcano", desc: "wavy ring around the crater", glow: "rgba(255,90,31,.55)", grass: "#2a1614", grass2: "#1e0f0d", deco: "#4a201a", road: "#26221f", border: "#ff5a1f", dash: "#ffd23f", grip: 1, label: "Volcano", neon: true, lava: true },
  { name: "Desert Canyon", desc: "tight serpentine switchbacks", glow: "rgba(255,207,63,.5)", grass: "#d9b36c", grass2: "#c9a055", deco: "#a97e3d", road: "#5a4a3a", border: "#e2583a", dash: "#fff3d6", grip: 0.85, label: "Canyon" },
  { name: "Candy Kingdom", desc: "giant lollipop loop · sweet & wide", glow: "rgba(255,79,158,.55)", grass: "#ffd9ec", grass2: "#ffc6e2", deco: "#ff9ecb", road: "#6b3f2a", border: "#ff4f9e", dash: "#fff", grip: 0.95, label: "Candy Land" },
];
const LAYOUTS = [
  [[350,880],[560,880],[700,865],[790,800],[810,700],[810,260],[770,155],[660,110],[300,110],[160,125],[95,200],[95,310],[160,375],[250,330],[320,415],[395,320],[470,415],[545,330],[615,390],[625,480],[545,540],[240,540],[150,600],[145,760],[195,850]],
  [[320,880],[740,880],[762,878],[764,858],[764,670],[762,652],[742,650],[570,650],[552,648],[550,630],[550,490],[552,472],[570,470],[840,470],[862,468],[864,448],[864,160],[862,142],[842,140],[160,140],[142,142],[140,160],[140,310],[142,328],[160,330],[410,330],[428,332],[430,350],[430,480],[428,498],[410,500],[160,500],[142,502],[140,520],[140,858],[144,878],[164,880]],
  [[500,900],[820,830],[900,600],[830,380],[650,300],[500,360],[350,300],[170,380],[100,600],[180,830]],
  [[890,520],[768,675],[695,858],[500,830],[305,858],[232,675],[110,520],[232,365],[305,182],[500,210],[695,182],[768,365]],
  [[820,860],[500,870],[180,860],[110,780],[130,710],[300,700],[660,700],[740,640],[660,580],[300,580],[210,520],[300,460],[660,460],[740,400],[660,340],[300,340],[210,280],[300,210],[660,200],[770,150],[860,240],[860,760]],
  [[420,900],[580,900],[600,700],[700,620],[830,520],[850,330],[740,160],[500,100],[260,160],[150,330],[170,520],[300,620],[400,700]],
];
const TRACK_HALF = [46, 34, 58, 46, 38, 50];
const ITEMS = [
  { id: "boost", icon: "🚀", w: 3 }, { id: "missile", icon: "🎯", w: 3 }, { id: "banana", icon: "🍌", w: 3 },
  { id: "oil", icon: "🛢️", w: 2 }, { id: "shield", icon: "🛡️", w: 2 }, { id: "lightning", icon: "⚡", w: 2 },
];
const W = 1000, H = 1000;
const MAX_SPEED = 3.3, BOOST_SPEED = 4.8, ACCEL = 6.5, BRAKE = 9, REVERSE = -1.5, STEER = 2.2;

/* ═══════════════════ GEOMETRY ═══════════════════ */
function buildPath(pts, seg) {
  const P = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let t = 0; t < seg; t++) {
      const u = t / seg, u2 = u * u, u3 = u2 * u;
      P.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3),
      ]);
    }
  }
  return P;
}
function resample(P, step) {
  const out = []; let prev = P[0].slice(); out.push(prev.slice()); let acc = 0;
  for (let i = 1; i <= P.length; i++) {
    const cur = P[i % P.length];
    let dx = cur[0] - prev[0], dy = cur[1] - prev[1], d = Math.hypot(dx, dy);
    while (acc + d >= step) {
      const t = (step - acc) / d;
      prev = [prev[0] + dx * t, prev[1] + dy * t];
      out.push(prev.slice());
      dx = cur[0] - prev[0]; dy = cur[1] - prev[1]; d = Math.hypot(dx, dy); acc = 0;
    }
    acc += d; prev = cur.slice();
  }
  return out;
}

/* ═══════════════════ KART RENDERING (shared by game + previews) ═══════════════════ */
function drawKartShape(g, kart, color, dark, t) {
  if (kart !== "hover") {
    g.fillStyle = "#111";
    const bw = kart === "buggy" ? 9 : 7, bh = kart === "buggy" ? 7 : 5;
    g.fillRect(-13, -12, bw, bh); g.fillRect(-13, 12 - bh, bw, bh); g.fillRect(7, -12, bw, bh); g.fillRect(7, 12 - bh, bw, bh);
  } else {
    g.fillStyle = "rgba(0,229,255,0.55)";
    g.beginPath(); g.ellipse(-8, 0, 7, 10, 0, 0, 7); g.ellipse(8, 0, 7, 10, 0, 0, 7); g.fill();
  }
  g.fillStyle = color; g.strokeStyle = dark; g.lineWidth = 1.5;
  g.beginPath();
  if (kart === "formula") {
    g.moveTo(17, 0); g.lineTo(8, -5); g.lineTo(-2, -8); g.lineTo(-11, -6); g.lineTo(-13, 0); g.lineTo(-11, 6); g.lineTo(-2, 8); g.lineTo(8, 5);
  } else if (kart === "rocket") {
    g.moveTo(16, 0); g.lineTo(9, -7); g.lineTo(-12, -7); g.lineTo(-16, 0); g.lineTo(-12, 7); g.lineTo(9, 7);
  } else {
    g.moveTo(14, 0); g.lineTo(9, -8); g.lineTo(-11, -8); g.lineTo(-13, 0); g.lineTo(-11, 8); g.lineTo(9, 8);
  }
  g.closePath(); g.fill(); g.stroke();
  if (kart === "formula") { g.fillStyle = dark; g.fillRect(14, -9, 3, 18); g.fillRect(-15, -8, 3, 16); }
  else if (kart === "police") {
    g.fillStyle = "#fff"; g.fillRect(-4, -6, 8, 12);
    g.fillStyle = Math.floor(t * 6) % 2 ? "#ff3030" : "#3060ff"; g.fillRect(-1, -6, 3, 12);
  } else if (kart === "fire") {
    g.fillStyle = "#ffd23f"; g.beginPath(); g.moveTo(10, 0); g.lineTo(0, -4); g.lineTo(4, 0); g.lineTo(0, 4); g.closePath(); g.fill();
  } else if (kart === "cyber") { g.strokeStyle = "#00e5ff"; g.lineWidth = 1.4; g.strokeRect(-10, -6, 18, 12); }
  else if (kart === "rocket") {
    g.fillStyle = "#ccc"; g.fillRect(-18, -4, 6, 8);
    g.fillStyle = "#ff8c00"; g.beginPath(); g.moveTo(-18, 0); g.lineTo(-24, -3); g.lineTo(-22, 0); g.lineTo(-24, 3); g.closePath(); g.fill();
  } else if (kart === "buggy") { g.fillStyle = dark; g.fillRect(-12, -3, 22, 6); }
  else { g.fillStyle = dark; g.fillRect(-14, -9, 3, 18); }
  // stickman driver
  g.strokeStyle = "#111"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-2, -5); g.lineTo(7, -3); g.moveTo(-2, 5); g.lineTo(7, 3); g.stroke();
  g.fillStyle = "#222"; g.fillRect(6, -4, 2.5, 8);
  g.fillStyle = "#fff"; g.beginPath(); g.arc(-2, 0, 5, 0, 7); g.fill();
  g.strokeStyle = "#111"; g.lineWidth = 1.2; g.stroke();
  g.fillStyle = "#111"; g.beginPath(); g.arc(-0.5, -1.6, 0.9, 0, 7); g.arc(-0.5, 1.6, 0.9, 0, 7); g.fill();
}

/* ═══════════════════ NETWORK (lobby sync) ═══════════════════
   Transport: BroadcastChannel — syncs two tabs on the same device (testing).
   For two devices on your website, swap in a WebSocket:
     const ws = new WebSocket("wss://yoursite.com/lobby/ROOM");
     net.sendRaw = m => ws.send(JSON.stringify(m));
     ws.onmessage = e => net.receive(JSON.parse(e.data));
*/
function createNet(onMessage, onPeer) {
  const id = Math.random().toString(36).slice(2);
  const ch = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("skr-lobby") : null;
  let peer = false;
  const net = {
    get peer() { return peer; },
    sendRaw(m) { ch && ch.postMessage(m); },
    send(m) { net.sendRaw({ from: id, ...m }); },
    receive(m) {
      if (!m || m.from === id) return;
      if (!peer) { peer = true; onPeer(); }
      onMessage(m);
    },
    close() { ch && ch.close(); },
  };
  if (ch) ch.onmessage = (e) => net.receive(e.data);
  net.send({ type: "hello" });
  return net;
}

/* ═══════════════════ MINI TRACK CARD ═══════════════════ */
function TrackCard({ i, selected, onSelect, flash }) {
  const ref = useRef(null);
  useEffect(() => {
    const cvs = ref.current; if (!cvs) return;
    const th = THEMES[i];
    const P = buildPath(LAYOUTS[i], 6), sx = 220 / 1000, sy = 120 / 1000;
    const base = document.createElement("canvas"); base.width = 220; base.height = 120;
    const b = base.getContext("2d");
    b.fillStyle = th.grass; b.fillRect(0, 0, 220, 120);
    b.lineCap = "round"; b.lineJoin = "round";
    const wScale = TRACK_HALF[i] / 46;
    const trace = (g, wd, st) => { g.beginPath(); g.moveTo(P[0][0] * sx, P[0][1] * sy); for (let j = 1; j < P.length; j++) g.lineTo(P[j][0] * sx, P[j][1] * sy); g.closePath(); g.strokeStyle = st; g.lineWidth = wd; g.stroke(); };
    trace(b, 13 * wScale, th.border); trace(b, 9 * wScale, th.road);
    const off = Math.random();
    let t = 0, raf;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      t += 0.016;
      const g = cvs.getContext("2d");
      g.drawImage(base, 0, 0);
      g.lineCap = "round"; g.lineJoin = "round";
      g.setLineDash([3, 4]); g.lineDashOffset = -t * 14;
      trace(g, 1, th.dash);
      g.setLineDash([]); g.lineDashOffset = 0;
      const L = P.length;
      const dot = (frac, col) => {
        const idx = Math.floor(((frac % 1) + 1) % 1 * L), pt = P[idx], nx = P[(idx + 2) % L];
        const x = pt[0] * sx, y = pt[1] * sy, a = Math.atan2(nx[1] - pt[1], nx[0] - pt[0]);
        g.save(); g.translate(x, y); g.rotate(a);
        g.shadowColor = col; g.shadowBlur = 6;
        g.fillStyle = col; g.fillRect(-3.5, -2, 7, 4);
        g.restore();
      };
      dot(t * 0.055 + off, "#38c7ff");
      dot(t * 0.052 + off + 0.03, "#ff4d5a");
      g.shadowBlur = 0;
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [i]);
  const th = THEMES[i];
  return (
    <div
      onClick={() => onSelect(i)}
      className="cursor-pointer rounded-2xl p-2.5 pb-3 transition-transform hover:-translate-y-1"
      style={{
        background: "#0e111c", border: "1.5px solid #1c2236",
        boxShadow: selected ? `0 0 18px ${th.glow}, inset 0 0 24px rgba(56,199,255,.05)` : flash ? `0 0 30px ${th.glow}` : "none",
      }}
    >
      <canvas ref={ref} width={220} height={120} className="w-full rounded-xl block bg-black" />
      <div className="font-bold tracking-widest mt-2 mb-1 text-sm">{th.name}</div>
      <div className="text-[11px] leading-relaxed tracking-wide" style={{ color: "#8b93ab" }}>{th.desc}</div>
    </div>
  );
}

/* ═══════════════════ GARAGE PANEL ═══════════════════ */
function GaragePanel({ slot, pick, onPick, animT }) {
  const prevRef = useRef(null);
  useEffect(() => {
    const c = prevRef.current; if (!c) return;
    const g = c.getContext("2d");
    g.clearRect(0, 0, 130, 74);
    g.fillStyle = "#232733"; g.fillRect(0, 22, 130, 32);
    g.strokeStyle = slot === 0 ? "#38c7ff" : "#ff4d5a"; g.lineWidth = 2.5;
    g.shadowColor = g.strokeStyle; g.shadowBlur = 8;
    g.beginPath(); g.moveTo(0, 22); g.lineTo(130, 22); g.moveTo(0, 54); g.lineTo(130, 54); g.stroke();
    g.shadowBlur = 0;
    g.save(); g.translate(65, 38); g.scale(1.7, 1.7);
    drawKartShape(g, KART_TYPES[pick.type].id, COLORS[pick.col], DARKS[pick.col], animT);
    g.restore();
  }, [pick, slot, animT]);
  const accent = slot === 0 ? "#38c7ff" : "#ff4d5a";
  return (
    <div className="rounded-2xl p-2.5 min-w-0" style={{ background: "#0e111c", border: "1.5px solid #1c2236", boxShadow: `inset 0 0 30px ${slot === 0 ? "rgba(56,199,255,.05)" : "rgba(255,77,90,.05)"}` }}>
      <h3 className="text-xs font-bold mb-1.5" style={{ color: accent, letterSpacing: 3, textShadow: `0 0 8px ${accent}99` }}>PLAYER {slot + 1}</h3>
      <canvas ref={prevRef} width={130} height={74} className="block mx-auto rounded-xl" style={{ width: 110, height: 62, background: "#0a0d17" }} />
      <div className="text-[10px] tracking-widest mt-2 mb-1" style={{ color: "#8b93ab" }}>KART TYPE</div>
      <div className="grid grid-cols-4 gap-1">
        {KART_TYPES.map((k, i) => (
          <button key={k.id} onClick={() => onPick(slot, { ...pick, type: i })}
            className="rounded-lg py-1 px-0.5 text-[9.5px] leading-tight cursor-pointer transition-transform hover:-translate-y-0.5"
            style={{
              background: i === pick.type ? "#0e2231" : "#0e111c", color: "#dfe6f5", fontFamily: "inherit",
              border: `1.5px solid ${i === pick.type ? "#38c7ff" : "#1c2236"}`,
              boxShadow: i === pick.type ? "0 0 10px rgba(56,199,255,.4)" : "none",
            }}>
            <span className="block text-[15px]">{k.ic}</span>{k.name}
          </button>
        ))}
      </div>
      <div className="text-[10px] tracking-widest mt-2 mb-1" style={{ color: "#8b93ab" }}>COLOR</div>
      <div className="flex gap-1.5 justify-center flex-wrap">
        {COLORS.map((c, i) => (
          <div key={c} onClick={() => onPick(slot, { ...pick, col: i })}
            className="rounded-full cursor-pointer transition-transform hover:scale-110"
            style={{ width: 22, height: 22, background: c, border: `2.5px solid ${i === pick.col ? "#fff" : "transparent"}`, boxShadow: i === pick.col ? "0 0 10px #fff" : "none" }} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════ MAIN APP ═══════════════════ */
export default function StickmanKartRacing() {
  const canvasRef = useRef(null);
  const [screen, setScreen] = useState("menu"); // menu | race
  const [settings, setSettings] = useState({ track: 0, laps: 3, pu: false });
  const [picks, setPicks] = useState([{ type: 0, col: 0 }, { type: 1, col: 1 }]);
  const [hud, setHud] = useState({ pos1: "1st", pos2: "2nd", lap1: "", lap2: "", item1: "", item2: "", timer: "0:00.0", n1: "PLAYER 1", n2: "PLAYER 2", c1: COLORS[0], c2: COLORS[1] });
  const [centerText, setCenterText] = useState("");
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [results, setResults] = useState(null);
  const [rndModal, setRndModal] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [peer, setPeer] = useState(false);
  const [flashTrack, setFlashTrack] = useState(-1);
  const [animT, setAnimT] = useState(0);

  const settingsRef = useRef(settings); settingsRef.current = settings;
  const picksRef = useRef(picks); picksRef.current = picks;
  const mutedRef = useRef(muted); mutedRef.current = muted;
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const E = useRef({ state: "menu", path: [], N: 0, players: [], boxes: [], items: [], parts: [], confetti: [], missiles: [], raceT: 0, countT: 0, slowMo: 1, winner: null, fastLap: Infinity, curTrack: 0, ROAD_HALF: 46, WALL: 37, decoSeed: 1, keys: {}, marks: null, bg: null }).current;
  const audio = useRef({ AC: null, master: null, eng: [] }).current;
  const netRef = useRef(null);
  const toastTimer = useRef(null);
  const pendingRnd = useRef(null);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2600);
  }, []);

  /* ---------- audio ---------- */
  const initAudio = useCallback(() => {
    if (!audio.AC) {
      audio.AC = new (window.AudioContext || window.webkitAudioContext)();
      audio.master = audio.AC.createGain();
      audio.master.gain.value = mutedRef.current ? 0 : 1;
      audio.master.connect(audio.AC.destination);
    }
    if (audio.AC.state === "suspended") audio.AC.resume();
    if (!audio.eng.length) {
      audio.eng = [0, 1].map(() => {
        const o = audio.AC.createOscillator(), g = audio.AC.createGain(), f = audio.AC.createBiquadFilter();
        o.type = "triangle"; o.frequency.value = 50; g.gain.value = 0;
        f.type = "lowpass"; f.frequency.value = 320;
        o.connect(f); f.connect(g); g.connect(audio.master); o.start();
        return { o, g };
      });
    }
  }, [audio]);
  const beep = useCallback((f, d = 0.09, v = 0.05, type = "sine") => {
    if (!audio.AC || mutedRef.current) return;
    const o = audio.AC.createOscillator(), g = audio.AC.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = v;
    o.connect(g); g.connect(audio.master); o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audio.AC.currentTime + d);
    o.stop(audio.AC.currentTime + d);
  }, [audio]);
  useEffect(() => { if (audio.master) audio.master.gain.value = muted ? 0 : 1; }, [muted, audio]);
  const engineGain = useCallback((v) => audio.eng.forEach((e) => e && (e.g.gain.value = v)), [audio]);

  /* ---------- engine helpers ---------- */
  const rand = useCallback(() => { E.decoSeed = (E.decoSeed * 16807) % 2147483647; return E.decoSeed / 2147483647; }, [E]);
  const heading = useCallback((i) => { const a = E.path[i], b = E.path[(i + 3) % E.N]; return Math.atan2(b[1] - a[1], b[0] - a[0]); }, [E]);

  const buildBackground = useCallback(() => {
    const th = THEMES[E.curTrack];
    const bg = document.createElement("canvas"); bg.width = W; bg.height = H;
    const g = bg.getContext("2d");
    g.fillStyle = th.grass; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 130; i++) {
      const x = rand() * W, y = rand() * H, tpe = rand();
      let near = false;
      for (let j = 0; j < E.N; j += 6) { const dx = E.path[j][0] - x, dy = E.path[j][1] - y; if (dx * dx + dy * dy < (E.ROAD_HALF + 42) ** 2) { near = true; break; } }
      if (near) continue;
      g.fillStyle = th.deco;
      if (th.lava && tpe < 0.25) {
        g.fillStyle = "#ff5a1f"; g.beginPath(); g.ellipse(x, y, 14 + rand() * 18, 8 + rand() * 10, rand() * 3, 0, 7); g.fill();
        g.fillStyle = "#ffd23f"; g.beginPath(); g.ellipse(x, y, 6 + rand() * 7, 4 + rand() * 4, rand() * 3, 0, 7); g.fill();
      } else if (tpe < 0.45) {
        const w = 25 + rand() * 70, h = 10 + rand() * 10;
        g.fillRect(x, y, w, h); g.fillStyle = th.grass2; g.fillRect(x + 3, y + 3, w - 6, h - 6);
      } else if (tpe < 0.85) {
        const s = 14 + rand() * 20;
        g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y + s * 0.7); g.lineTo(x - s, y + s * 0.7); g.closePath(); g.fill();
        g.fillStyle = th.grass2; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y + s * 0.7); g.lineTo(x, y + s * 0.5); g.closePath(); g.fill();
      } else { g.beginPath(); g.arc(x, y, 4 + rand() * 5, 0, 7); g.fill(); }
    }
    g.lineCap = "round"; g.lineJoin = "round";
    const trace = () => { g.beginPath(); g.moveTo(E.path[0][0], E.path[0][1]); for (let i = 1; i < E.N; i++) g.lineTo(E.path[i][0], E.path[i][1]); g.closePath(); };
    trace(); g.strokeStyle = th.border; g.lineWidth = E.ROAD_HALF * 2 + 12;
    if (th.neon) { g.shadowColor = th.border; g.shadowBlur = 22; }
    g.stroke(); g.shadowBlur = 0;
    trace(); g.strokeStyle = th.road; g.lineWidth = E.ROAD_HALF * 2; g.stroke();
    trace(); g.strokeStyle = th.dash; g.lineWidth = 2.5; g.setLineDash([14, 18]); g.stroke(); g.setLineDash([]);
    const a = heading(0), ca = Math.cos(a), sa = Math.sin(a), cp = Math.cos(a + Math.PI / 2), sp = Math.sin(a + Math.PI / 2);
    const fx = E.path[0][0], fy = E.path[0][1], sq = (E.ROAD_HALF * 2) / 8;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
      g.fillStyle = (r + c) % 2 ? "#111" : "#fff";
      const bx = fx + ca * (r * sq - sq * 1.5) + cp * (c * sq - E.ROAD_HALF);
      const by = fy + sa * (r * sq - sq * 1.5) + sp * (c * sq - E.ROAD_HALF);
      g.save(); g.translate(bx, by); g.rotate(a); g.fillRect(0, 0, sq + 0.5, sq + 0.5); g.restore();
    }
    g.save(); g.font = "italic bold 30px Consolas"; g.fillStyle = "rgba(255,255,255,.9)";
    g.translate(E.path[Math.floor(E.N * 0.965)][0] - 10, E.path[Math.floor(E.N * 0.965)][1] - 58);
    g.fillText(th.label, 0, 0); g.restore();
    E.bg = bg;
  }, [E, rand, heading]);

  const setupRace = useCallback(() => {
    E.curTrack = settingsRef.current.track;
    E.ROAD_HALF = TRACK_HALF[E.curTrack]; E.WALL = E.ROAD_HALF - 9;
    E.path = resample(buildPath(LAYOUTS[E.curTrack], 10), 5); E.N = E.path.length;
    E.decoSeed = 42 + E.curTrack * 7;
    E.marks = document.createElement("canvas"); E.marks.width = W; E.marks.height = H;
    const a = heading(0);
    E.players = [0, 1].map((i) => ({
      i,
      x: E.path[0][0] + Math.cos(a + Math.PI / 2) * (i === 0 ? -1 : 1) * E.ROAD_HALF * 0.42 - Math.cos(a) * (30 + i * 26),
      y: E.path[0][1] + Math.sin(a + Math.PI / 2) * (i === 0 ? -1 : 1) * E.ROAD_HALF * 0.42 - Math.sin(a) * (30 + i * 26),
      angle: a, speed: 0, idx: 0, lap: 1, done: false, item: null,
      boost: 0, spin: 0, freeze: 0, shield: false, lapStart: 0, finishT: 0, halfway: false, prevIdx: 0,
      kart: KART_TYPES[picksRef.current[i].type].id,
      color: COLORS[picksRef.current[i].col], dark: DARKS[picksRef.current[i].col],
    }));
    E.boxes = [];
    if (settingsRef.current.pu) {
      for (let s = 0; s < 6; s++) {
        const idx = Math.floor(E.N * (0.14 + (s * 0.83) / 6));
        for (let k = -1; k <= 1; k++) {
          const ang = heading(idx);
          E.boxes.push({ idx, x: E.path[idx][0] + Math.cos(ang + Math.PI / 2) * k * E.ROAD_HALF * 0.5, y: E.path[idx][1] + Math.sin(ang + Math.PI / 2) * k * E.ROAD_HALF * 0.5, t: 0, alive: true, spin: Math.random() * 6 });
        }
      }
    }
    E.items = []; E.parts = []; E.confetti = []; E.missiles = [];
    E.raceT = 0; E.slowMo = 1; E.winner = null; E.fastLap = Infinity;
    buildBackground();
  }, [E, heading, buildBackground]);

  const spawnParts = useCallback((x, y, color, n, sp = 3) => {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = Math.random() * sp; E.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, color, size: 2 + Math.random() * 3 }); }
  }, [E]);
  const pickItem = useCallback(() => { const tot = ITEMS.reduce((s, i) => s + i.w, 0); let r = Math.random() * tot; for (const it of ITEMS) { if ((r -= it.w) <= 0) return it; } return ITEMS[0]; }, []);
  const useItem = useCallback((p) => {
    if (!p.item || p.done) return;
    const it = p.item; p.item = null;
    const other = E.players[1 - p.i];
    beep(660, 0.1, 0.05);
    if (it.id === "boost") p.boost = Math.max(p.boost, 1.5);
    if (it.id === "shield") { p.shield = true; setTimeout(() => (p.shield = false), 6000); }
    if (it.id === "lightning") { if (other.shield) other.shield = false; else { other.freeze = 1.3; spawnParts(other.x, other.y, "#ffe94a", 18); } beep(200, 0.25, 0.06, "triangle"); }
    if (it.id === "missile") E.missiles.push({ x: p.x, y: p.y, angle: p.angle, target: other, life: 5 });
    if (it.id === "banana") { const a = p.angle + Math.PI; E.items.push({ type: "banana", x: p.x + Math.cos(a) * 40, y: p.y + Math.sin(a) * 40, r: 12 }); }
    if (it.id === "oil") { const a = p.angle + Math.PI; E.items.push({ type: "oil", x: p.x + Math.cos(a) * 44, y: p.y + Math.sin(a) * 44, r: 20 }); }
  }, [E, beep, spawnParts]);

  const nearestIdx = useCallback((p) => {
    let best = p.idx, bd = Infinity;
    for (let d = -45; d <= 60; d++) {
      const j = ((p.idx + d) % E.N + E.N) % E.N, dx = E.path[j][0] - p.x, dy = E.path[j][1] - p.y, dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = j; }
    }
    return { idx: best, dist: Math.sqrt(bd) };
  }, [E]);

  const showResults = useCallback(() => {
    E.state = "finish";
    engineGain(0);
    const fmt = (t) => { const m = Math.floor(t / 60), s = (t % 60).toFixed(1); return m + ":" + (s < 10 ? "0" : "") + s; };
    setResults({ winner: E.winner.i, color: E.winner.color, time: fmt(E.winner.finishT), fast: E.fastLap < Infinity ? fmt(E.fastLap) : "—" });
  }, [E, engineGain]);

  const onFinish = useCallback((p) => {
    if (E.winner !== null) return;
    E.winner = p; E.slowMo = 0.25;
    beep(523, 0.18, 0.06); setTimeout(() => beep(659, 0.18, 0.06), 120); setTimeout(() => beep(784, 0.3, 0.07), 260);
    for (let i = 0; i < 120; i++) E.confetti.push({ x: Math.random() * W, y: -20 - Math.random() * 300, vy: 1.5 + Math.random() * 2.5, vx: (Math.random() - 0.5) * 1.5, c: ["#38c7ff", "#ff4d5a", "#ffcf3f", "#4dff9e", "#a86bff"][i % 5], s: 4 + Math.random() * 5, r: Math.random() * 6.28 });
    setTimeout(() => (E.slowMo = 1), 1200);
    setTimeout(showResults, 3200);
  }, [E, beep, showResults]);

  const updatePlayer = useCallback((p, dt) => {
    if (p.done) { p.speed *= 0.97; p.x += Math.cos(p.angle) * p.speed; p.y += Math.sin(p.angle) * p.speed; return; }
    const th = THEMES[E.curTrack], k = E.keys;
    const up = p.i === 0 ? k["KeyW"] : k["ArrowUp"];
    const dn = p.i === 0 ? k["KeyS"] : k["ArrowDown"];
    const lf = p.i === 0 ? k["KeyA"] : k["ArrowLeft"];
    const rt = p.i === 0 ? k["KeyD"] : k["ArrowRight"];
    const frozen = p.freeze > 0;
    if (p.freeze > 0) p.freeze -= dt;
    if (p.spin > 0) { p.spin -= dt; p.angle += 9 * dt; }
    let maxS = MAX_SPEED;
    if (p.boost > 0) {
      p.boost -= dt; maxS = BOOST_SPEED;
      const a = p.angle + Math.PI;
      E.parts.push({ x: p.x + Math.cos(a) * 16, y: p.y + Math.sin(a) * 16, vx: Math.cos(a) * 2 + (Math.random() - 0.5), vy: Math.sin(a) * 2 + (Math.random() - 0.5), life: 0.3, color: Math.random() < 0.5 ? "#ff8c00" : "#ffd23f", size: 4 });
    }
    if (frozen) maxS = 0.7;
    if (!p.spin && !frozen) {
      if (up) p.speed += ACCEL * dt;
      else if (dn) p.speed -= BRAKE * dt;
      else p.speed *= Math.pow(0.45, dt);
      const steer = STEER * th.grip * (0.45 + 0.55 * Math.min(1, Math.abs(p.speed) / 2.6)) * dt;
      if (lf) p.angle -= steer * Math.sign(p.speed || 1);
      if (rt) p.angle += steer * Math.sign(p.speed || 1);
      if ((lf || rt) && Math.abs(p.speed) > 2.5) {
        const m = E.marks.getContext("2d"); m.fillStyle = "rgba(20,20,20,0.28)";
        const a = p.angle + Math.PI / 2;
        m.fillRect(p.x + Math.cos(a) * 8 - 1, p.y + Math.sin(a) * 8 - 1, 2.5, 2.5);
        m.fillRect(p.x - Math.cos(a) * 8 - 1, p.y - Math.sin(a) * 8 - 1, 2.5, 2.5);
        if (Math.random() < 0.3) E.parts.push({ x: p.x, y: p.y, vx: Math.random() - 0.5, vy: Math.random() - 0.5, life: 0.5, color: "rgba(220,220,220,0.6)", size: 5 });
      }
    }
    p.speed = Math.max(REVERSE, Math.min(maxS, p.speed));
    p.x += Math.cos(p.angle) * p.speed * 60 * dt * E.slowMo;
    p.y += Math.sin(p.angle) * p.speed * 60 * dt * E.slowMo;
    const near = nearestIdx(p); p.idx = near.idx;
    if (near.dist > E.WALL) {
      const cx = E.path[near.idx][0], cy = E.path[near.idx][1];
      const nx = (p.x - cx) / near.dist, ny = (p.y - cy) / near.dist;
      p.x = cx + nx * E.WALL; p.y = cy + ny * E.WALL;
      if (Math.abs(p.speed) > 1.2) {
        p.speed *= 0.72;
        spawnParts(p.x, p.y, "#ffcf3f", 4, 2);
        if (Math.random() < 0.3) beep(110, 0.05, 0.03, "triangle");
      }
    }
    const idx = p.idx, prev = p.prevIdx;
    if (prev > E.N - 40 && idx < 40 && p.halfway) {
      p.halfway = false;
      const lt = E.raceT - p.lapStart; p.lapStart = E.raceT;
      if (lt < E.fastLap && lt > 2) E.fastLap = lt;
      p.lap++;
      beep(880, 0.1, 0.05);
      if (p.lap > settingsRef.current.laps) { p.done = true; p.finishT = E.raceT; onFinish(p); }
    }
    if (idx > E.N * 0.45 && idx < E.N * 0.6) p.halfway = true;
    p.prevIdx = idx;
    for (const b of E.boxes) {
      if (!b.alive) continue;
      const dx = b.x - p.x, dy = b.y - p.y;
      if (dx * dx + dy * dy < 24 * 24 && !p.item) { p.item = pickItem(); b.alive = false; b.t = 5; spawnParts(b.x, b.y, "#ffcf3f", 12); beep(1200, 0.07, 0.04); }
    }
    for (let i = E.items.length - 1; i >= 0; i--) {
      const it = E.items[i], dx = it.x - p.x, dy = it.y - p.y;
      if (dx * dx + dy * dy < (it.r + 12) ** 2) {
        if (p.shield) p.shield = false;
        else if (it.type === "banana") { p.spin = 0.7; p.speed *= 0.35; beep(240, 0.18, 0.05, "triangle"); }
        else if (it.type === "oil") { p.angle += (Math.random() - 0.5) * 1.6; p.speed *= 0.5; }
        spawnParts(it.x, it.y, "#ffe94a", 10); E.items.splice(i, 1);
      }
    }
  }, [E, nearestIdx, spawnParts, beep, pickItem, onFinish]);

  /* ---------- main loop ---------- */
  useEffect(() => {
    let raf, last = 0;
    const fmt = (t) => { const m = Math.floor(t / 60), s = (t % 60).toFixed(1); return m + ":" + (s < 10 ? "0" : "") + s; };
    const draw = () => {
      const cvs = canvasRef.current; if (!cvs) return;
      const ctx = cvs.getContext("2d");
      ctx.clearRect(0, 0, W, H);
      if (!E.bg) return;
      ctx.drawImage(E.bg, 0, 0);
      ctx.drawImage(E.marks, 0, 0);
      for (const it of E.items) {
        if (it.type === "banana") { ctx.font = "20px serif"; ctx.fillText("🍌", it.x - 10, it.y + 7); }
        else { ctx.fillStyle = "rgba(30,30,30,0.75)"; ctx.beginPath(); ctx.ellipse(it.x, it.y, it.r, it.r * 0.7, 0.4, 0, 7); ctx.fill(); }
      }
      for (const b of E.boxes) {
        if (!b.alive) { b.t -= 1 / 60; if (b.t <= 0) b.alive = true; continue; }
        b.spin += 0.04;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.sin(b.spin) * 0.4);
        const g = ctx.createLinearGradient(-11, -11, 11, 11);
        g.addColorStop(0, "#ffcf3f"); g.addColorStop(0.5, "#ff4d5a"); g.addColorStop(1, "#a86bff");
        ctx.fillStyle = g; ctx.fillRect(-11, -11, 22, 22);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(-11, -11, 22, 22);
        ctx.fillStyle = "#fff"; ctx.font = "bold 15px Consolas"; ctx.fillText("?", -4, 5);
        ctx.restore();
      }
      for (const m of E.missiles) {
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.angle);
        ctx.fillStyle = "#c22"; ctx.fillRect(-8, -3, 14, 6);
        ctx.fillStyle = "#eee"; ctx.beginPath(); ctx.moveTo(6, -3); ctx.lineTo(11, 0); ctx.lineTo(6, 3); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      for (const p of E.players) {
        ctx.save(); ctx.translate(p.x, p.y);
        if (p.kart === "hover") ctx.translate(0, Math.sin(E.raceT * 6 + p.i) * 1.5);
        ctx.rotate(p.angle);
        if (p.shield) { ctx.strokeStyle = "rgba(120,220,255,0.9)"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.stroke(); }
        if (p.freeze > 0) { ctx.fillStyle = "rgba(150,220,255,0.5)"; ctx.beginPath(); ctx.arc(0, 0, 17, 0, 7); ctx.fill(); }
        drawKartShape(ctx, p.kart, p.color, p.dark, E.raceT);
        ctx.restore();
      }
      for (const q of E.parts) { ctx.globalAlpha = Math.max(0, q.life * 2); ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      for (const c of E.confetti) { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = c.c; ctx.fillRect(-c.s / 2, -c.s / 2, c.s, c.s * 0.6); ctx.restore(); }
    };
    const pushHud = () => {
      const P = E.players; if (P.length < 2) return;
      const ahead = P[0].lap * E.N + P[0].idx >= P[1].lap * E.N + P[1].idx;
      const laps = settingsRef.current.laps;
      const next = {
        pos1: E.winner === P[0] ? "🏆" : ahead ? "1st" : "2nd",
        pos2: E.winner === P[1] ? "🏆" : ahead ? "2nd" : "1st",
        lap1: "Lap " + Math.min(P[0].lap, laps) + "/" + laps,
        lap2: "Lap " + Math.min(P[1].lap, laps) + "/" + laps,
        item1: P[0].item ? P[0].item.icon : "",
        item2: P[1].item ? P[1].item.icon : "",
        timer: fmt(E.raceT),
        n1: "P1 · " + KART_TYPES[picksRef.current[0].type].name.toUpperCase(),
        n2: "P2 · " + KART_TYPES[picksRef.current[1].type].name.toUpperCase(),
        c1: COLORS[picksRef.current[0].col], c2: COLORS[picksRef.current[1].col],
      };
      setHud((h) => (JSON.stringify(h) === JSON.stringify(next) ? h : next));
    };
    const loop = (ts) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.033, (ts - last) / 1000 || 0.016); last = ts;
      if (E.state === "countdown") {
        E.countT -= dt;
        if (E.countT > 0) {
          const n = Math.ceil(E.countT);
          if (E._cn !== n) { E._cn = n; beep(440, 0.12, 0.05); setCenterText(String(n)); }
        } else if (E.state === "countdown") {
          setCenterText("GO!"); beep(880, 0.3, 0.06);
          setTimeout(() => setCenterText(""), 700);
          E.state = "race";
        }
        draw(); return;
      }
      if (pausedRef.current) return;
      if (E.state !== "race" && E.state !== "finish") return;
      E.raceT += dt * E.slowMo;
      for (const p of E.players) updatePlayer(p, dt * E.slowMo);
      // kart collision
      const a = E.players[0], b = E.players[1];
      if (a && b) {
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d < 26 && d > 0.01) {
          const nx = dx / d, ny = dy / d, push = (26 - d) / 2;
          a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
          const t = a.speed; a.speed = a.speed * 0.6 + b.speed * 0.3; b.speed = b.speed * 0.6 + t * 0.3;
          spawnParts((a.x + b.x) / 2, (a.y + b.y) / 2, "#fff", 6, 2);
        }
      }
      // missiles
      for (let i = E.missiles.length - 1; i >= 0; i--) {
        const m = E.missiles[i]; m.life -= dt;
        const t = m.target, ta = Math.atan2(t.y - m.y, t.x - m.x);
        let da = ta - m.angle; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
        m.angle += Math.max(-4 * dt, Math.min(4 * dt, da));
        m.x += Math.cos(m.angle) * 420 * dt; m.y += Math.sin(m.angle) * 420 * dt;
        E.parts.push({ x: m.x, y: m.y, vx: 0, vy: 0, life: 0.25, color: "#aaa", size: 3 });
        const dx = t.x - m.x, dy = t.y - m.y;
        if (dx * dx + dy * dy < 400) {
          if (t.shield) t.shield = false; else { t.spin = 1; t.speed = -0.8; }
          spawnParts(m.x, m.y, "#ff8c00", 24, 5); beep(140, 0.25, 0.07, "triangle");
          E.missiles.splice(i, 1); continue;
        }
        if (m.life <= 0) E.missiles.splice(i, 1);
      }
      for (let i = E.parts.length - 1; i >= 0; i--) { const q = E.parts[i]; q.x += q.vx; q.y += q.vy; q.life -= dt; if (q.life <= 0) E.parts.splice(i, 1); }
      for (const c of E.confetti) { c.y += c.vy; c.x += c.vx; c.r += 0.1; }
      E.confetti = E.confetti.filter((c) => c.y < H + 30);
      if (audio.AC && E.state === "race" && !mutedRef.current) {
        E.players.forEach((p, i) => { if (audio.eng[i]) { audio.eng[i].o.frequency.value = 42 + Math.abs(p.speed) * 18; audio.eng[i].g.gain.value = 0.006; } });
      } else engineGain(0);
      pushHud();
      draw();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [E, audio, beep, updatePlayer, spawnParts, engineGain]);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const dn = (e) => {
      E.keys[e.code] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
      if (e.code === "Escape") setPaused((p) => (E.state === "race" ? !p : p));
      if (E.state === "race" && !pausedRef.current) {
        if (e.code === "KeyQ") useItem(E.players[0]);
        if (e.code === "KeyM") useItem(E.players[1]);
      }
    };
    const up = (e) => (E.keys[e.code] = false);
    addEventListener("keydown", dn); addEventListener("keyup", up);
    return () => { removeEventListener("keydown", dn); removeEventListener("keyup", up); };
  }, [E, useItem]);

  /* ---------- garage preview animation tick ---------- */
  useEffect(() => {
    const id = setInterval(() => setAnimT((t) => t + 0.17), 170);
    return () => clearInterval(id);
  }, []);

  /* ---------- network ---------- */
  const applyRandom = useCallback((pl) => {
    setPicks([...pl.picks]);
    setSettings((s) => ({ ...s, track: pl.track, laps: pl.laps }));
    setFlashTrack(pl.track); setTimeout(() => setFlashTrack(-1), 700);
    toast("🎲 Randomized: " + THEMES[pl.track].name + " · " + pl.laps + " lap" + (pl.laps > 1 ? "s" : ""));
  }, [toast]);
  const netHandler = useRef(null);
  netHandler.current = (m) => {
    switch (m.type) {
      case "hello": netRef.current?.send({ type: "present" }); break;
      case "sel":
        if (m.key === "track") { setSettings((s) => ({ ...s, track: m.val })); setFlashTrack(m.val); setTimeout(() => setFlashTrack(-1), 700); toast("Other player picked " + THEMES[m.val].name); }
        if (m.key === "laps") { setSettings((s) => ({ ...s, laps: m.val })); toast("Other player set " + m.val + " lap" + (m.val > 1 ? "s" : "")); }
        if (m.key === "pu") { setSettings((s) => ({ ...s, pu: !!m.val })); toast("Other player turned power-ups " + (m.val ? "ON" : "OFF")); }
        break;
      case "garage":
        setPicks((p) => { const np = [...p]; np[m.slot] = m.pick; return np; });
        toast("Other player updated Player " + (m.slot + 1) + "'s kart");
        break;
      case "rndreq": pendingRnd.current = m.payload; setRndModal(true); break;
      case "rndok": toast("Random accepted! 🎲"); applyRandom(m.payload); break;
      case "rndno": toast("Other player refused the random 🎲"); break;
      default: break;
    }
  };
  useEffect(() => {
    const net = createNet((m) => netHandler.current(m), () => setPeer(true));
    netRef.current = net;
    return () => net.close();
  }, []);

  /* ---------- actions ---------- */
  const selectTrack = (i) => { setSettings((s) => ({ ...s, track: i })); netRef.current?.send({ type: "sel", key: "track", val: i }); };
  const selectLaps = (v) => { setSettings((s) => ({ ...s, laps: v })); netRef.current?.send({ type: "sel", key: "laps", val: v }); };
  const selectPU = (v) => { setSettings((s) => ({ ...s, pu: v })); netRef.current?.send({ type: "sel", key: "pu", val: v ? 1 : 0 }); };
  const onPick = (slot, pick) => { setPicks((p) => { const np = [...p]; np[slot] = pick; return np; }); netRef.current?.send({ type: "garage", slot, pick }); };
  const randomizeAll = () => {
    const pl = {
      picks: [
        { type: Math.floor(Math.random() * KART_TYPES.length), col: Math.floor(Math.random() * COLORS.length) },
        { type: Math.floor(Math.random() * KART_TYPES.length), col: Math.floor(Math.random() * COLORS.length) },
      ],
      track: Math.floor(Math.random() * THEMES.length),
      laps: [1, 3, 5][Math.floor(Math.random() * 3)],
    };
    if (netRef.current?.peer) { netRef.current.send({ type: "rndreq", payload: pl }); toast("🎲 Waiting for the other player to accept…"); }
    else applyRandom(pl);
  };
  const startRace = () => {
    setResults(null); setPaused(false); setScreen("race");
    initAudio();
    setupRace();
    E.state = "countdown"; E.countT = 3; E._cn = 0;
  };
  const backToMenu = () => {
    setResults(null); setPaused(false); setScreen("menu");
    E.state = "menu"; E.bg = null; engineGain(0);
    const c = canvasRef.current; if (c) c.getContext("2d").clearRect(0, 0, W, H);
  };

  /* ---------- render ---------- */
  const dim = "#8b93ab", line = "#1c2236", card = "#0e111c";
  const pillStyle = (sel) => ({
    background: sel ? "#0e2231" : card, color: "#dfe6f5", fontFamily: "inherit",
    border: `1.5px solid ${sel ? "#38c7ff" : line}`,
    boxShadow: sel ? "0 0 14px rgba(56,199,255,.45), inset 0 0 18px rgba(56,199,255,.08)" : "none",
  });

  return (
    <div className="w-full h-screen overflow-hidden relative flex items-center justify-center" style={{ background: "#07080f", fontFamily: 'Consolas,"Courier New",monospace', color: "#dfe6f5" }}>
      <canvas ref={canvasRef} width={W} height={H} className="block rounded-xl"
        style={{ width: "min(98vh,98vw)", height: "min(98vh,98vw)", boxShadow: screen === "race" ? "0 0 50px rgba(56,199,255,.12),0 0 120px rgba(0,0,0,.8)" : "none" }} />

      {/* ── HUD ── */}
      {screen === "race" && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute top-3 left-3.5 rounded-2xl px-4 py-2 min-w-[150px]" style={{ background: "#0a0d17d9", border: `1.5px solid ${line}`, boxShadow: "0 0 16px rgba(56,199,255,.2)" }}>
            <div className="text-[11px] font-bold" style={{ letterSpacing: 2, color: hud.c1 }}>{hud.n1}</div>
            <div className="text-2xl font-bold">{hud.pos1}</div>
            <div className="text-xs" style={{ color: dim }}>{hud.lap1}</div>
            <div className="text-xl h-6">{hud.item1}</div>
          </div>
          <div className="absolute top-3 right-3.5 rounded-2xl px-4 py-2 min-w-[150px] text-right" style={{ background: "#0a0d17d9", border: `1.5px solid ${line}`, boxShadow: "0 0 16px rgba(255,77,90,.2)" }}>
            <div className="text-[11px] font-bold" style={{ letterSpacing: 2, color: hud.c2 }}>{hud.n2}</div>
            <div className="text-2xl font-bold">{hud.pos2}</div>
            <div className="text-xs" style={{ color: dim }}>{hud.lap2}</div>
            <div className="text-xl h-6">{hud.item2}</div>
          </div>
          <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-xl px-4 py-1.5 text-lg font-bold" style={{ background: "#0a0d17d9", border: `1.5px solid ${line}`, letterSpacing: 2 }}>{hud.timer}</div>
          <div className="absolute top-16 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto">
            <button onClick={() => setPaused(true)} title="Pause (Esc)" className="w-10 h-10 rounded-xl cursor-pointer text-base" style={{ background: "#0a0d17d9", border: `1.5px solid ${line}`, color: "#dfe6f5" }}>⏸</button>
            <button onClick={() => setMuted((m) => !m)} title="Sound on/off" className="w-10 h-10 rounded-xl cursor-pointer text-base" style={{ background: "#0a0d17d9", border: `1.5px solid ${line}`, color: "#dfe6f5" }}>{muted ? "🔇" : "🔊"}</button>
          </div>
        </div>
      )}

      {/* countdown */}
      {centerText && (
        <div className="absolute pointer-events-none z-[15] font-bold" style={{ top: "38%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 110, letterSpacing: 6, color: "#ffcf3f", textShadow: "0 0 30px rgba(255,207,63,.8)" }}>{centerText}</div>
      )}

      {/* ── MENU ── */}
      {screen === "menu" && (
        <div className="absolute inset-0 z-20 overflow-auto flex justify-center" style={{ background: "#07080fee" }}>
          <div className="w-full max-w-[880px] px-3 pt-6 pb-10 text-center">
            <h1 className="text-4xl font-bold mb-1" style={{ letterSpacing: 10 }}>
              <span style={{ color: "#38c7ff", textShadow: "0 0 14px #38c7ff,0 0 40px rgba(56,199,255,.4)" }}>STICKMAN</span>{" 🏁 "}
              <span style={{ color: "#ff4d5a", textShadow: "0 0 14px #ff4d5a,0 0 40px rgba(255,77,90,.4)" }}>KART RACING</span>
            </h1>
            <div className="text-sm mb-3" style={{ color: dim, letterSpacing: 2 }}>head-to-head neon kart battles · first across the line wins</div>

            <button onClick={startRace} className="cursor-pointer rounded-2xl font-bold text-white mb-3 transition-transform hover:scale-105"
              style={{ padding: "14px 56px", fontSize: 20, letterSpacing: 5, border: "none", background: "linear-gradient(90deg,#3a7bfd,#ff4d5a)", boxShadow: "0 0 26px rgba(90,120,255,.45)", fontFamily: "inherit" }}>
              START RACE ▶
            </button>
            <div className="flex justify-center mb-1.5">
              <button onClick={randomizeAll} className="cursor-pointer rounded-xl px-5 py-3 text-sm transition-transform hover:-translate-y-0.5"
                style={{ ...pillStyle(false), border: "1.5px solid #a86bff", boxShadow: "0 0 12px rgba(168,107,255,.35)" }}>
                <b style={{ letterSpacing: 1 }}>🎲 RANDOMIZE ALL</b>
                <small className="block mt-0.5" style={{ color: dim, fontSize: 11 }}>random karts · colors · track · laps</small>
              </button>
            </div>
            {peer && <div className="text-sm mb-2" style={{ color: "#4dff9e", letterSpacing: 2 }}>🔗 other player connected — choices are synced</div>}

            <div className="text-sm font-bold mt-4 mb-2.5" style={{ letterSpacing: 2 }}>Match length:</div>
            <div className="flex gap-3 justify-center flex-wrap">
              {[{ l: 1, n: "Sprint" }, { l: 3, n: "Classic" }, { l: 5, n: "Endurance" }].map((o) => (
                <button key={o.l} onClick={() => selectLaps(o.l)} className="cursor-pointer rounded-xl px-5 py-3 text-sm transition-transform hover:-translate-y-0.5" style={pillStyle(settings.laps === o.l)}>
                  <b style={{ letterSpacing: 1 }}>{o.n}</b><small className="block mt-0.5" style={{ color: dim, fontSize: 11 }}>{o.l} lap{o.l > 1 ? "s" : ""}</small>
                </button>
              ))}
            </div>

            <div className="text-sm font-bold mt-4 mb-2.5" style={{ letterSpacing: 2 }}>Garage — pick your kart:</div>
            <div className="grid grid-cols-2 gap-2.5 max-[560px]:grid-cols-1">
              <GaragePanel slot={0} pick={picks[0]} onPick={onPick} animT={animT} />
              <GaragePanel slot={1} pick={picks[1]} onPick={onPick} animT={animT} />
            </div>

            <div className="text-sm font-bold mt-4 mb-2.5" style={{ letterSpacing: 2 }}>Choose your track:</div>
            <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
              {THEMES.map((_, i) => (
                <TrackCard key={i} i={i} selected={settings.track === i} flash={flashTrack === i} onSelect={selectTrack} />
              ))}
            </div>

            <div className="text-sm font-bold mt-4 mb-2.5" style={{ letterSpacing: 2 }}>Power-ups:</div>
            <div className="flex gap-3 justify-center">
              <button onClick={() => selectPU(true)} className="cursor-pointer rounded-xl px-5 py-3 text-sm" style={pillStyle(settings.pu)}>
                <b>ON</b><small className="block mt-0.5" style={{ color: dim, fontSize: 11 }}>item boxes spawn</small>
              </button>
              <button onClick={() => selectPU(false)} className="cursor-pointer rounded-xl px-5 py-3 text-sm" style={pillStyle(!settings.pu)}>
                <b>OFF</b><small className="block mt-0.5" style={{ color: dim, fontSize: 11 }}>pure racing</small>
              </button>
            </div>

            <div className="flex gap-3.5 justify-center flex-wrap mt-6">
              <div className="flex-1 min-w-[280px] rounded-xl px-4 py-3 text-left text-xs leading-loose" style={{ background: card, border: `1.5px solid ${line}`, color: dim }}>
                <b style={{ color: "#38c7ff", letterSpacing: 2 }}>PLAYER 1</b><br />
                <Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key> — drive · <Key>Q</Key> — use item
              </div>
              <div className="flex-1 min-w-[280px] rounded-xl px-4 py-3 text-left text-xs leading-loose" style={{ background: card, border: `1.5px solid ${line}`, color: dim }}>
                <b style={{ color: "#ff4d5a", letterSpacing: 2 }}>PLAYER 2</b><br />
                <Key>↑</Key><Key>←</Key><Key>↓</Key><Key>→</Key> — drive · <Key>M</Key> — use item
              </div>
            </div>
            <div className="text-sm mt-3.5" style={{ color: dim, letterSpacing: 2 }}>⏸ pause anytime with <Key>Esc</Key> · 🔊 sound toggle in the top bar</div>
          </div>
        </div>
      )}

      {/* ── PAUSE ── */}
      {paused && screen === "race" && (
        <Modal>
          <h2 className="text-2xl font-bold mb-4" style={{ letterSpacing: 6 }}>PAUSED</h2>
          <div className="flex flex-col gap-3 min-w-[260px]">
            <GradBtn onClick={() => setPaused(false)}>RESUME ▶</GradBtn>
            <GhostBtn onClick={() => { setPaused(false); startRace(); }}>RESTART RACE</GhostBtn>
            <GhostBtn onClick={() => setMuted((m) => !m)}>SOUND: {muted ? "OFF" : "ON"}</GhostBtn>
            <GhostBtn onClick={backToMenu}>BACK TO MENU</GhostBtn>
          </div>
        </Modal>
      )}

      {/* ── RESULTS ── */}
      {results && (
        <Modal>
          <div className="text-6xl mb-2">🏆</div>
          <div className="text-2xl font-bold mb-2" style={{ letterSpacing: 3, color: results.color, textShadow: `0 0 16px ${results.color}` }}>
            PLAYER {results.winner + 1} WINS!
          </div>
          <table className="mx-auto my-3 text-sm"><tbody>
            <tr><td className="px-4 py-1.5" style={{ color: dim, borderBottom: `1px solid ${line}` }}>Race time</td><td className="px-4 py-1.5" style={{ borderBottom: `1px solid ${line}` }}>{results.time}</td></tr>
            <tr><td className="px-4 py-1.5" style={{ color: dim, borderBottom: `1px solid ${line}` }}>Fastest lap</td><td className="px-4 py-1.5" style={{ borderBottom: `1px solid ${line}` }}>{results.fast}</td></tr>
          </tbody></table>
          <div className="flex flex-col gap-3 min-w-[260px]">
            <GradBtn onClick={startRace}>REMATCH ▶</GradBtn>
            <GhostBtn onClick={backToMenu}>BACK TO MENU</GhostBtn>
          </div>
        </Modal>
      )}

      {/* ── RANDOM REQUEST ── */}
      {rndModal && (
        <Modal z={40}>
          <h2 className="text-2xl font-bold mb-3" style={{ letterSpacing: 6 }}>🎲 RANDOM?</h2>
          <div className="text-sm mb-4" style={{ color: dim, letterSpacing: 1 }}>The other player wants to randomize<br />karts, colors, track and laps for both of you.</div>
          <div className="flex flex-col gap-3 min-w-[260px]">
            <GradBtn onClick={() => { setRndModal(false); if (pendingRnd.current) { applyRandom(pendingRnd.current); netRef.current?.send({ type: "rndok", payload: pendingRnd.current }); pendingRnd.current = null; } }}>ACCEPT ✔</GradBtn>
            <GhostBtn onClick={() => { setRndModal(false); pendingRnd.current = null; netRef.current?.send({ type: "rndno" }); }}>REFUSE ✖</GhostBtn>
          </div>
        </Modal>
      )}

      {/* ── TOAST ── */}
      {toastMsg && (
        <div className="fixed bottom-7 left-1/2 -translate-x-1/2 rounded-xl px-5 py-2.5 text-[13px] z-50"
          style={{ background: card, border: "1.5px solid #38c7ff", letterSpacing: 1, boxShadow: "0 0 18px rgba(56,199,255,.35)" }}>{toastMsg}</div>
      )}
    </div>
  );
}

/* ── small UI helpers ── */
function Modal({ children, z = 30 }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#07080fee", zIndex: z }}>
      <div className="rounded-3xl px-11 py-8 text-center" style={{ background: "#0e111c", border: "1.5px solid #1c2236", boxShadow: "0 0 60px rgba(56,199,255,.12)" }}>{children}</div>
    </div>
  );
}
function GradBtn({ children, onClick }) {
  return <button onClick={onClick} className="cursor-pointer rounded-2xl font-bold text-white transition-transform hover:scale-105"
    style={{ padding: "13px 30px", fontSize: 16, letterSpacing: 3, border: "none", background: "linear-gradient(90deg,#3a7bfd,#ff4d5a)", boxShadow: "0 0 20px rgba(90,120,255,.4)", fontFamily: "inherit" }}>{children}</button>;
}
function GhostBtn({ children, onClick }) {
  return <button onClick={onClick} className="cursor-pointer rounded-xl transition-colors"
    style={{ padding: "12px 30px", fontSize: 15, letterSpacing: 2, background: "#0e111c", border: "1.5px solid #1c2236", color: "#dfe6f5", fontFamily: "inherit" }}>{children}</button>;
}
function Key({ children }) {
  return <span className="inline-block rounded px-1.5 mx-px" style={{ background: "#060810", border: "1px solid #1c2236", color: "#dfe6f5", fontFamily: "monospace" }}>{children}</span>;
}
