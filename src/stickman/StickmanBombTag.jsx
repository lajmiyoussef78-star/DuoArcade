import { useState, useEffect, useRef, useCallback } from "react";
import { createDuoStickmanNet, remapFromKeys } from "../lib/duoStickmanNet.js";

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

const ARENA_THUMB_W = 176;
const ARENA_THUMB_H = 92;

function ArenaCard({ i, selected, onSelect }) {
  const ref = useRef(null);
  useEffect(() => {
    const cvs = ref.current; if (!cvs) return;
    const A = ARENAS[i];
    const items = []; let boltT = Math.random() * 3, flash = 0, raf;
    const sx = ARENA_THUMB_W / 230;
    const sy = ARENA_THUMB_H / 120;
    const tick = (ts) => {
      raf = requestAnimationFrame(tick);
      const t = ts / 1000, g = cvs.getContext("2d"), w = ARENA_THUMB_W, h = ARENA_THUMB_H, gr = Math.round(96 * sy);
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, A.sky[0]); bg.addColorStop(1, A.sky[1]);
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      if (A.fx === "snow" && Math.random() < 0.3) items.push({ x: Math.random() * w, y: 0, vy: 0.5 + Math.random() * 0.5, type: "s" });
      if (A.fx === "meteor" && Math.random() < 0.04) items.push({ x: Math.random() * w + 40 * sx, y: 0, vx: -1.6 * sx, vy: 1.6 * sy, type: "m" });
      if (A.fx === "lightning") { boltT -= 0.016; if (boltT <= 0) { boltT = 2 + Math.random() * 3; flash = 0.5; } }
      for (let k = items.length - 1; k >= 0; k--) {
        const f = items[k];
        if (f.type === "s") { f.y += f.vy; g.fillStyle = "rgba(220,240,255,.8)"; g.fillRect(f.x, f.y, 1.6, 1.6); if (f.y > h) items.splice(k, 1); }
        if (f.type === "m") { f.x += f.vx; f.y += f.vy; g.strokeStyle = "rgba(255,150,60,.7)"; g.beginPath(); g.moveTo(f.x + 6 * sx, f.y - 6 * sy); g.lineTo(f.x, f.y); g.stroke(); if (f.y > h) items.splice(k, 1); }
      }
      if (flash > 0) { g.fillStyle = "rgba(190,160,255," + flash * 0.35 + ")"; g.fillRect(0, 0, w, h); flash -= 0.05; }
      if (A.fx === "search") {
        const beam = w / 2 + Math.sin(t * 0.6 + i) * 70 * sx;
        g.fillStyle = "rgba(200,210,255,0.09)";
        g.beginPath(); g.moveTo(beam - 8 * sx, 0); g.lineTo(beam + 8 * sx, 0); g.lineTo(beam + 30 * sx, gr); g.lineTo(beam - 30 * sx, gr); g.closePath(); g.fill();
      }
      if (A.fx === "laser") for (let k = 0; k < 2; k++) { const ly = 30 * sy + k * 35 * sy + Math.sin(t + k) * 8 * sy; g.strokeStyle = "rgba(77,255,158,.25)"; g.beginPath(); g.moveTo(0, ly); g.lineTo(w, ly); g.stroke(); }
      g.shadowColor = A.floor; g.shadowBlur = 6;
      g.strokeStyle = A.floor; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(5, gr); g.lineTo(w - 5, gr); g.stroke();
      g.lineWidth = 1.75;
      for (const [px, py, pw] of A.plats) {
        g.beginPath();
        g.moveTo(px * 0.23 * sx, py * 0.2 * sy);
        g.lineTo((px + pw) * 0.23 * sx, py * 0.2 * sy);
        g.stroke();
      }
      g.shadowBlur = 0;
      const x1 = w / 2 + Math.sin(t * 0.9 + i) * 46, x2 = w / 2 + Math.sin(t * 0.9 + i + 0.7) * 46;
      const f1 = Math.cos(t * 0.9 + i) >= 0 ? 1 : -1, f2 = Math.cos(t * 0.9 + i + 0.7) >= 0 ? 1 : -1;
      miniMan(g, x1, gr, "#38c7ff", t * 7 + i, f1, true, t);
      miniMan(g, x2, gr, "#ff4d5a", t * 7 + i + 2, f2, false, t);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [i]);
  const A = ARENAS[i];
  return (
    <button
      type="button"
      onClick={() => onSelect(i)}
      className={"sbt-arena-card" + (selected ? " is-selected" : "")}
      style={{ boxShadow: selected ? `0 0 16px ${A.glow}` : "none", borderColor: selected ? A.floor : undefined }}
    >
      <canvas ref={ref} width={ARENA_THUMB_W} height={ARENA_THUMB_H} className="sbt-arena-thumb" />
      <div className="sbt-arena-name">{A.name}</div>
      <div className="sbt-arena-desc">{A.desc}</div>
    </button>
  );
}

/* ═══════════════════ MAIN GAME ═══════════════════ */
export default function StickmanBombTag({ myRole, rt, names = {} } = {}) {
  const duoNetRef = useRef(null);
  const nameA = (names?.A || names?.a || "Player A").trim() || "Player A";
  const nameB = (names?.B || names?.b || "Player B").trim() || "Player B";
  const nameOf = (slot) => (slot === 0 ? nameA : nameB);
  const namesRef = useRef({ A: nameA, B: nameB });
  namesRef.current = { A: nameA, B: nameB };
  const role = String(myRole || "").toUpperCase() === "B" ? "B"
    : String(myRole || "").toUpperCase() === "A" ? "A" : null;
  const online = !!(rt && role);
  const isHost = !online || role === "A";
  const isGuest = online && role === "B";

  const canvasRef = useRef(null);
  const rootElRef = useRef(null);
  const stageRef = useRef(null);
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
  const [guestReady, setGuestReady] = useState(false);
  const [isTouch] = useState(() => typeof window !== "undefined" && "ontouchstart" in window);

  const settingsRef = useRef(settings); settingsRef.current = settings;
  const mutedRef = useRef(muted); mutedRef.current = muted;
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const screenRef = useRef(screen); screenRef.current = screen;

  // Mark wrap/shell so room-live CSS can scroll lobby / fill play without height:auto collapse
  useEffect(() => {
    const root = rootElRef.current;
    if (!root) return;
    const shell = root.closest(".sbt-shell");
    const wrap = root.closest(".sbt-wrap");
    const host = wrap?.parentElement;
    for (const el of [shell, wrap, host]) {
      if (!el) continue;
      el.setAttribute("data-sbt-screen", screen);
    }
    return () => {
      for (const el of [shell, wrap, host]) {
        try { el?.removeAttribute("data-sbt-screen"); } catch { /* */ }
      }
    };
  }, [screen]);

  // Fit stage to largest 1000×600 rect inside the board (CSS cq can resolve to 0)
  useEffect(() => {
    if (screen !== "play") return undefined;
    const root = rootElRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return undefined;

    const sizeOf = (el) => {
      if (!el) return { w: 0, h: 0 };
      const r = el.getBoundingClientRect?.();
      return {
        w: Math.max(el.clientWidth || 0, r?.width || 0),
        h: Math.max(el.clientHeight || 0, r?.height || 0),
      };
    };

    const isFullscreenNow = () => {
      const fsRoot = root.closest(".gv-fs-root");
      return !!(
        document.fullscreenElement
        || fsRoot?.classList?.contains("is-fullscreen")
        || fsRoot?.matches?.(":fullscreen")
      );
    };

    const FILL_PROPS = [
      "display", "flex-direction", "align-items", "justify-content",
      "width", "height", "max-width", "max-height", "min-width", "min-height",
      "flex", "align-self", "margin", "padding", "overflow", "box-sizing",
    ];

    const clearFillStyles = () => {
      const shell = root.closest(".sbt-shell");
      const wrap = root.closest(".sbt-wrap");
      const host = wrap?.parentElement;
      const board = root.closest(".gr-board-slot");
      const fsRoot = root.closest(".gv-fs-root");
      const boardWrap = root.closest(".gv-board-wrap");
      for (const el of [fsRoot, board, boardWrap, host, wrap, shell, root]) {
        if (!el) continue;
        for (const prop of FILL_PROPS) el.style.removeProperty(prop);
      }
    };

    const fit = () => {
      const shell = root.closest(".sbt-shell");
      const wrap = root.closest(".sbt-wrap");
      const host = wrap?.parentElement;
      const board = root.closest(".gr-board-slot");
      const fsRoot = root.closest(".gv-fs-root");
      const boardWrap = root.closest(".gv-board-wrap");
      const fs = isFullscreenNow();
      let bw = 0;
      let bh = 0;

      if (fs) {
        // Fullscreen: % widths can resolve against a 0-wide flex ancestor and clip the stage.
        // Size the mount chain in PIXELS from the fullscreen root / viewport (same as Kart).
        const vv = window.visualViewport;
        const fsBox = sizeOf(fsRoot);
        const boardBox = sizeOf(board);
        bw = Math.max(
          fsBox.w,
          boardBox.w,
          window.innerWidth || 0,
          document.documentElement?.clientWidth || 0,
          vv?.width || 0,
        );
        bh = Math.max(
          fsBox.h,
          boardBox.h,
          window.innerHeight || 0,
          document.documentElement?.clientHeight || 0,
          vv?.height || 0,
        );
        if (bw < 80) bw = window.innerWidth || 1280;
        if (bh < 80) bh = window.innerHeight || 720;

        const fillEls = [fsRoot, board, boardWrap, host, wrap, shell, root];
        for (const el of fillEls) {
          if (!el) continue;
          el.style.setProperty("display", "flex", "important");
          el.style.setProperty("flex-direction", "column", "important");
          el.style.setProperty("align-items", "center", "important");
          el.style.setProperty("justify-content", "center", "important");
          el.style.setProperty("width", `${Math.floor(bw)}px`, "important");
          el.style.setProperty("height", `${Math.floor(bh)}px`, "important");
          el.style.setProperty("max-width", `${Math.floor(bw)}px`, "important");
          el.style.setProperty("max-height", `${Math.floor(bh)}px`, "important");
          el.style.setProperty("min-width", `${Math.floor(bw)}px`, "important");
          el.style.setProperty("min-height", `${Math.floor(bh)}px`, "important");
          el.style.setProperty("flex", "1 1 auto", "important");
          el.style.setProperty("align-self", "stretch", "important");
          el.style.setProperty("margin", "0", "important");
          el.style.setProperty("padding", "0", "important");
          el.style.setProperty("overflow", "hidden", "important");
          el.style.setProperty("box-sizing", "border-box", "important");
        }
      } else {
        // Leaving fullscreen: drop pixel lock styles or the board stays oversized / off-center
        clearFillStyles();
        const boxes = [host, wrap, shell, root, board].map(sizeOf).filter((b) => b.w >= 80 && b.h >= 80);
        if (boxes.length) {
          bw = Math.min(...boxes.map((b) => b.w));
          bh = Math.min(...boxes.map((b) => b.h));
        } else {
          ({ w: bw, h: bh } = sizeOf(host || board || root));
        }
        if (bh < 80 || bw < 80) {
          const fallback = sizeOf(host || board);
          bw = Math.max(bw, fallback.w);
          bh = Math.max(bh, fallback.h);
        }
        for (const el of [root, shell, wrap]) {
          if (!el) continue;
          el.style.setProperty("height", "100%", "important");
          el.style.setProperty("max-height", "100%", "important");
          el.style.setProperty("width", "100%", "important");
          el.style.setProperty("max-width", "100%", "important");
        }
      }

      // FS: tiny inset so edges aren't clipped; windowed keeps board padding
      const pad = fs ? 12 : 8;
      const availW = Math.max(160, (bw || 400) - pad);
      const availH = Math.max(96, (bh || 240) - pad);
      // Largest 1000×600 rect that fits fully (no mid-arena clip)
      let w = availW;
      let h = w * (600 / 1000);
      if (h > availH) {
        h = availH;
        w = h * (1000 / 600);
      }
      w = Math.floor(w);
      h = Math.floor(h);
      if (!w || !h || !Number.isFinite(w) || !Number.isFinite(h)) return;
      stage.style.setProperty("width", `${w}px`, "important");
      stage.style.setProperty("height", `${h}px`, "important");
      stage.style.setProperty("max-width", `${w}px`, "important");
      stage.style.setProperty("max-height", `${h}px`, "important");
      stage.style.setProperty("aspect-ratio", "auto", "important");
      stage.style.setProperty("margin", "0", "important");
      stage.style.setProperty("flex", "0 0 auto", "important");
    };

    const fitSoon = () => {
      fit();
      requestAnimationFrame(() => {
        fit();
        requestAnimationFrame(fit);
      });
    };

    fitSoon();
    const t1 = setTimeout(fitSoon, 50);
    const t2 = setTimeout(fitSoon, 200);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fitSoon) : null;
    try {
      for (const el of [
        root,
        root.closest(".sbt-shell"),
        root.closest(".sbt-wrap"),
        root.closest(".gv-board-wrap"),
        root.closest(".gr-board-slot"),
        root.closest(".gv-fs-root"),
      ]) {
        if (el) ro?.observe(el);
      }
    } catch { /* */ }
    window.addEventListener("resize", fitSoon);
    document.addEventListener("fullscreenchange", fitSoon);
    document.addEventListener("webkitfullscreenchange", fitSoon);
    const fsRootEl = root.closest(".gv-fs-root");
    const mo = fsRootEl && typeof MutationObserver !== "undefined"
      ? new MutationObserver(() => { fitSoon(); setTimeout(fitSoon, 80); })
      : null;
    try { mo?.observe(fsRootEl, { attributes: true, attributeFilter: ["class"] }); } catch { /* */ }
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      try { ro?.disconnect(); } catch { /* */ }
      try { mo?.disconnect(); } catch { /* */ }
      window.removeEventListener("resize", fitSoon);
      document.removeEventListener("fullscreenchange", fitSoon);
      document.removeEventListener("webkitfullscreenchange", fitSoon);
      try {
        stage.style.removeProperty("width");
        stage.style.removeProperty("height");
        stage.style.removeProperty("max-width");
        stage.style.removeProperty("max-height");
        stage.style.removeProperty("aspect-ratio");
        stage.style.removeProperty("margin");
        stage.style.removeProperty("flex");
        clearFillStyles();
      } catch { /* */ }
    };
  }, [screen]);

  const E = useRef({
    state: "menu", players: [], bombHolder: 0, bombT: 45, round: 1, scores: [0, 0], startHolder: 0,
    parts: [], debris: [], shock: [], flashA: 0, shakeT: 0, shakeAmp: 0, slowMo: 1,
    fxItems: [], lightT: 0, quakeT: 0, countT: 0, bannerT: 0, lastCn: 0,
    passLockUntil: 0, now: 0, keys: {}, pressed: {}, tickAt: 0,
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

  const beginOnlineMatch = useCallback((payload = {}) => {
    const next = payload.settings || settingsRef.current;
    if (payload.settings) setSettings(payload.settings);
    settingsRef.current = next;
    setGuestReady(false);
    setResults(null);
    setPaused(false);
    setBanner(null);
    setCenterHtml(null);
    setScreen("play");
    try { initAudio(); } catch { /* ignore */ }
    E.scores = [0, 0];
    E.round = 1;
    E.startHolder = typeof payload.startHolder === "number" ? payload.startHolder : (Math.random() < 0.5 ? 0 : 1);
    setScores([0, 0]);
    // ensure players exist before first paint (fixes black guest canvas)
    E.players = [makePlayer(0), makePlayer(1)];
    E.bombHolder = E.startHolder;
    E.bombT = next.fuse;
    E.parts = []; E.debris = []; E.shock = []; E.flashA = 0; E.shakeAmp = 0; E.slowMo = 1;
    E.fxItems = []; E.quakeT = 0; E.passLockUntil = 0; E.lastCn = 0;
    setRound(1);
    setTimerTxt(Number(next.fuse).toFixed(1));
    setDanger(false);
    E.state = "countdown"; E.countT = 3;
    E._finishBroadcast = false;
    try { duoNetRef.current?.clearState?.(); } catch { /* */ }
  }, [E, initAudio]);

  useEffect(() => {
    if (!rt || !role) return undefined;
    const p1Codes = ["KeyA", "KeyD", "KeyW", "KeyE"];
    const p2Codes = ["ArrowLeft", "ArrowRight", "ArrowUp", "KeyM"];
    const net = createDuoStickmanNet({
      rt, myRole: role, p1Codes, p2Codes,
      remap: { KeyA: "ArrowLeft", KeyD: "ArrowRight", KeyW: "ArrowUp", KeyE: "KeyM" },
    });
    duoNetRef.current = net;
    net.onUi((m) => {
      if (!m) return;
      const type = m.type || m.k;
      if (type === "start") {
        beginOnlineMatch({
          settings: m.settings,
          startHolder: m.startHolder,
        });
      } else if (type === "ready") {
        setGuestReady(!!m.ready);
      } else if (type === "menu") {
        setScreen("menu"); setPaused(false); setResults(null); setBanner(null); setCenterHtml(null);
        setGuestReady(false);
        E.state = "menu"; E.bannerMsg = null; E.resultsMsg = null;
        E._finishBroadcast = false;
      } else if (type === "finish" && m.results) {
        // Peer (or host) match end — same results panel on both screens
        E.resultsMsg = m.results;
        E.state = "done";
        setPaused(false);
        setBanner(null);
        setCenterHtml(null);
        setResults(m.results);
        setScreen("play");
      } else if (type === "sel" && m.key && m.val != null) {
        setSettings((s) => {
          const next = { ...s, [m.key]: m.val };
          settingsRef.current = next;
          return next;
        });
      }
    });
    return () => {
      try { net.dispose?.(); } catch { /* ignore */ }
      if (duoNetRef.current === net) duoNetRef.current = null;
    };
  }, [rt, role, beginOnlineMatch]);
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
      const msg = {
        winner: w,
        color: w === 0 ? "#38c7ff" : "#ff4d5a",
        score: E.scores[0] + " — " + E.scores[1],
      };
      E.resultsMsg = msg;
      setResults(msg);
      E.state = "done";
      // Broadcast finish immediately — loop stops netTick once state is "done"
      if (online && !E._finishBroadcast) {
        E._finishBroadcast = true;
        try {
          duoNetRef.current?.sendUi({ type: "finish", results: msg });
        } catch { /* */ }
      }
    } else { E.round++; E.startHolder = 1 - E.startHolder; startRound(); }
  }, [E, online, startRound]);

  const endRound = useCallback(() => {
    const survivor = 1 - E.bombHolder;
    E.scores[survivor]++;
    setScores([...E.scores]);
    E.state = "banner"; E.bannerT = 2.2;
    const nm = (survivor === 0 ? namesRef.current.A : namesRef.current.B).toUpperCase();
    const msg = { text: nm + " SURVIVES!", color: survivor === 0 ? "#38c7ff" : "#ff4d5a" };
    E.bannerMsg = msg;
    setBanner(msg);
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
    // Guest draws quiet — host owns spark FX (avoids mismatched arena haze)
    if (!E.drawQuiet) {
      E.parts.push({ x: x + 12, y: y - 14, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 40, life: 0.25, color: Math.random() < 0.5 ? "#ffcf3f" : "#ff8a3c", size: 1.5 + Math.random() * 1.5 });
    }
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
    let raf, last = 0, netAcc = 0, lastGuestPoseT = -1, lastHostBombT = -1;
    const clampX = (x) => Math.max(24, Math.min(W - 24, x));

    const blendPose = (p, sp, dt = 0.016) => {
      if (!p || !sp || sp.x == null) return false;
      const dx = sp.x - p.x;
      const dy = (sp.y ?? p.y) - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 120) {
        p.x = sp.x;
        if (sp.y != null) p.y = sp.y;
      } else if (dist > 0.4) {
        const a = Math.min(1, (dist > 40 ? 0.55 : 0.3) + dt * 1.6);
        p.x += dx * a;
        p.y += dy * a;
      } else {
        p.x = sp.x;
        if (sp.y != null) p.y = sp.y;
      }
      if (sp.vx != null) p.vx = sp.vx;
      if (sp.vy != null) p.vy = sp.vy;
      if (sp.face != null) p.face = sp.face;
      if (sp.onGround != null) p.onGround = sp.onGround;
      if (sp.jumps != null) p.jumps = sp.jumps;
      if (sp.run != null) p.run = sp.run;
      if (sp.dead != null) p.dead = sp.dead;
      p._netX = sp.x;
      p._netY = sp.y ?? p.y;
      p._netVx = sp.vx ?? 0;
      p._netAt = performance.now();
      return true;
    };

    const coastRemote = (p, dt) => {
      if (!p || p.dead || p._netAt == null) return;
      const age = (performance.now() - p._netAt) / 1000;
      if (age < 0.02 || age > 0.25) return;
      const vx = p._netVx ?? p.vx ?? 0;
      if (Math.abs(vx) < 8) return;
      p.x = clampX(p.x + vx * dt * 0.85);
    };

    /**
     * Host-authoritative fuse HUD. bombT counts DOWN — stale packets have a
     * *higher* remaining time. The old Math.max + "remote + 0.85 < last" check
     * rejected every update after ~1s and let the guest free-run (multi-second drift).
     */
    const syncBombT = (remoteT) => {
      if (typeof remoteT !== "number" || !Number.isFinite(remoteT)) return;
      if (lastHostBombT >= 0 && remoteT > lastHostBombT + 0.75) {
        // Upward jump is only valid on fuse/round reset (not an older sample).
        const fuse = settingsRef.current.fuse || 45;
        const isReset = remoteT >= fuse - 1.05 || E.state === "countdown";
        if (!isReset) return;
      }
      lastHostBombT = remoteT;
      const diff = remoteT - E.bombT;
      // Prefer correctness: snap when drifted; light blend only for tiny jitter.
      if (Math.abs(diff) > 0.2) E.bombT = remoteT;
      else if (Math.abs(diff) > 0.04) E.bombT += diff * 0.55;
    };

    const applyHostPhase = (st) => {
      if (!st) return;
      if (st.arena != null && st.arena !== settingsRef.current.arena) {
        const next = { ...settingsRef.current, arena: st.arena };
        if (st.fuse != null) next.fuse = st.fuse;
        if (st.rounds != null) next.rounds = st.rounds;
        settingsRef.current = next;
        setSettings(next);
      }
      if (st.bombHolder != null) E.bombHolder = st.bombHolder;
      if (st.round != null && st.round !== E.round) {
        E.round = st.round;
        setRound(st.round);
        lastHostBombT = -1; // allow fuse reset watermark
      }
      if (st.scores && (st.scores[0] !== E.scores[0] || st.scores[1] !== E.scores[1])) {
        E.scores = st.scores; setScores([...st.scores]);
      }
      // Phase: never regress play → countdown from a late packet
      if (st.state === "done" && st.results) {
        E.state = "done";
        setResults(st.results);
        return;
      }
      if (st.state === "explode" || st.state === "banner") {
        E.state = st.state;
        if (st.state === "banner" && st.banner) {
          if (E._uiBanner !== st.banner.text) { E._uiBanner = st.banner.text; setBanner(st.banner); }
        }
        return;
      }
      if (E.state === "play" && st.state === "countdown") return;
      if (st.state === "countdown" || st.state === "play") E.state = st.state;
      if (st.countT != null && E.state === "countdown") {
        const diff = st.countT - E.countT;
        if (Math.abs(diff) > 0.5) E.countT = st.countT;
        else if (Math.abs(diff) > 0.08) E.countT += diff * 0.3;
      }
      syncBombT(st.bombT);
    };

    const uiTimer = (bombT) => {
      const ttxt = Math.max(0, bombT).toFixed(1);
      if (E._uiTimer !== ttxt) { E._uiTimer = ttxt; setTimerTxt(ttxt); }
      const dang = bombT < 10;
      if (E._uiDanger !== dang) { E._uiDanger = dang; setDanger(dang); }
    };

    const packPose = (p) => (p ? {
      t: performance.now(),
      x: +p.x.toFixed(2),
      y: +p.y.toFixed(2),
      vx: +Number(p.vx || 0).toFixed(2),
      vy: +Number(p.vy || 0).toFixed(2),
      face: p.face,
      onGround: !!p.onGround,
      jumps: p.jumps | 0,
      run: p.run,
      dead: !!p.dead,
    } : null);

    const loop = (ts) => {
      raf = requestAnimationFrame(loop);
      const rdt = Math.min(0.033, (ts - last) / 1000 || 0.016); last = ts;
      const t = ts / 1000; E.now = t;
      if (pausedRef.current || E.state === "menu" || E.state === "done") return;
      const net = duoNetRef.current;
      const guest = !!(net?.online && !net.isHost);

      /* ── Guest (red / P2): local drive + local clock; soft-sync host ── */
      if (guest) {
        if (!E.players?.length) E.players = [makePlayer(0), makePlayer(1)];
        E.drawQuiet = true;

        const extra = net.takeRemoteExtra?.();
        if (extra?.pose && extra.pose.x != null) {
          if (!E.players[0]) E.players[0] = makePlayer(0);
          blendPose(E.players[0], extra.pose, rdt);
          // Dense clock on pose channel (same idea as Kart) — smoother than st-only
          if (extra.from === "p1" || extra.pose.bombT != null) {
            syncBombT(extra.pose.bombT);
            if (extra.pose.state === "play" || extra.pose.state === "countdown") {
              if (!(E.state === "play" && extra.pose.state === "countdown")) {
                E.state = extra.pose.state;
              }
            }
            if (extra.pose.countT != null && E.state === "countdown") {
              const diff = extra.pose.countT - E.countT;
              if (Math.abs(diff) > 0.5) E.countT = extra.pose.countT;
              else if (Math.abs(diff) > 0.08) E.countT += diff * 0.3;
            }
            if (extra.pose.bombHolder != null) E.bombHolder = extra.pose.bombHolder;
          }
        }

        const st = net.takeState?.();
        if (st) {
          applyHostPhase(st);
          if (st.players?.[0] && !(extra?.pose && extra.from === "p1")) {
            if (!E.players[0]) E.players[0] = makePlayer(0);
            blendPose(E.players[0], st.players[0], rdt);
          }
          // P2 death only from host explosion — never overwrite local x/y
          if (st.players?.[1]?.dead && E.players[1]) E.players[1].dead = true;
        } else if (E.players[0]) {
          coastRemote(E.players[0], rdt);
        }

        // Local countdown so 3-2-1 never freezes if a host packet stalls
        if (E.state === "countdown") {
          E.countT = Math.max(0, (E.countT || 0) - rdt);
          const n = Math.ceil(E.countT);
          if (E.lastCn !== n) {
            E.lastCn = n;
            if (n > 0) setCenterHtml({ big: String(n) });
            else {
              const nm = (E.bombHolder === 0 ? namesRef.current.A : namesRef.current.B).toUpperCase();
              setCenterHtml({ big: "GO!", small: `💣 ${nm} HAS THE BOMB` });
            }
          }
          if (E.countT <= 0 && E.state === "countdown") {
            // Host owns the real phase flip; nudge UI only
            setTimeout(() => { if (E.state === "countdown") setCenterHtml(null); }, 900);
          }
        } else if (E.state === "play") {
          if (E.lastCn !== -1) { E.lastCn = -1; setCenterHtml(null); }
          // Local fuse tick — soft-corrected by host syncBombT
          E.bombT = Math.max(0, (E.bombT || 0) - rdt);
          uiTimer(E.bombT);
        }

        if (E.state === "play" && !pausedRef.current && E.players[1] && !E.players[1].dead) {
          const k = E.keys || {};
          if (!k.ArrowLeft && !k.ArrowRight && !k.KeyA && !k.KeyD) {
            if (Math.abs(E.players[1].vx) < 40) E.players[1].vx = 0;
          }
          updatePlayer(E.players[1], rdt);
        }

        netAcc += rdt;
        if (netAcc >= 1 / 20) {
          netAcc = 0;
          const pose = packPose(E.players[1]);
          if (pose && net.sendPose) net.sendPose(pose);
          // Keys only — pose already on p2 channel (avoids dual-authority fight)
          net.netTick(null, null);
        }

        E.fxItems = E.fxItems || [];
        draw(t);
        return;
      }

      /* ── Host / local ── */
      E.drawQuiet = false;
      let hasRemoteP2 = false;
      if (net?.online) {
        net.mergeRemoteInto(E);
        if (!E.pressed) E.pressed = {};
        const pose = net.takeRemoteExtra?.()?.pose;
        if (pose && E.players[1] && pose.t !== lastGuestPoseT) {
          if (typeof pose.t === "number") lastGuestPoseT = pose.t;
          blendPose(E.players[1], pose, rdt);
          hasRemoteP2 = true;
        } else if (lastGuestPoseT >= 0 && E.players[1]) {
          coastRemote(E.players[1], rdt);
          hasRemoteP2 = true;
        }
        if (E.pressed.KeyM) tryPass(1);
        if (!hasRemoteP2 && E.pressed.ArrowUp) tryJump(E.players[1]);
      }
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
          const holderName = (E.bombHolder === 0 ? namesRef.current.A : namesRef.current.B).toUpperCase();
          setCenterHtml({ big: "GO!", small: `💣 ${holderName} HAS THE BOMB` });
          beep(880, 0.25, 0.06);
          setTimeout(() => setCenterHtml(null), 900);
          E.state = "play";
        }
      }
      if (E.state === "play") {
        E.bombT -= dt;
        uiTimer(E.bombT);
        const rate = E.bombT > 15 ? 1 : E.bombT > 7 ? 0.5 : E.bombT > 3 ? 0.25 : 0.12;
        if (t - E.tickAt > rate) { E.tickAt = t; beep(E.bombT < 7 ? 1100 : 800, 0.04, 0.04, "square"); }
        if (E.bombT <= 0) { E.bombT = 0; explode(); }
        updatePlayer(E.players[0], dt);
        if (!hasRemoteP2) updatePlayer(E.players[1], dt);
      }
      if (E.state === "explode") {
        updatePlayer(E.players[0], dt);
        if (!hasRemoteP2) updatePlayer(E.players[1], dt);
      }
      if (E.state === "banner") {
        E.bannerT -= rdt;
        updatePlayer(E.players[0], dt);
        if (!hasRemoteP2) updatePlayer(E.players[1], dt);
        if (E.bannerT <= 0) afterBanner();
      }
      if (net?.online) {
        netAcc += rdt;
        // 20Hz — denser rates queue on Fly RTT and freeze guest clocks
        if (netAcc >= 1 / 20) {
          netAcc = 0;
          const p0 = E.players[0];
          if (p0 && net.sendPose) {
            net.sendPose({
              ...packPose(p0),
              bombT: +Number(E.bombT || 0).toFixed(3),
              countT: +Number(E.countT || 0).toFixed(3),
              state: E.state,
              bombHolder: E.bombHolder,
            });
          }
          net.netTick(() => ({
            state: E.state, bombHolder: E.bombHolder, bombT: E.bombT, scores: E.scores,
            round: E.round, countT: E.countT,
            arena: settingsRef.current.arena,
            fuse: settingsRef.current.fuse,
            rounds: settingsRef.current.rounds,
            banner: E.bannerMsg || null,
            results: E.resultsMsg || null,
            players: E.players.map((p) => ({
              x: p.x, y: p.y, vx: p.vx, vy: p.vy, face: p.face, onGround: p.onGround,
              jumps: p.jumps, run: p.run, dead: p.dead, color: p.color,
            })),
          }));
        }
        E.pressed = {};
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
  }, [E, beep, draw, explode, afterBanner, updateFX, updatePlayer, tryJump, tryPass]);

  /* ---------- keyboard (online: A=P1 host, B=P2 guest; guest may use WASD) ---------- */
  useEffect(() => {
    const dn = (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
      if (e.code === "Escape") setPaused((p) => (E.state === "play" || E.state === "countdown" ? !p : p));
      const net = duoNetRef.current;
      if (net?.online) {
        const code = net.onKeyDown(e.code, E);
        if (!code) return;
        if (E.state === "play" && !pausedRef.current) {
          if (code === "KeyW" && net.isHost) tryJump(E.players[0]);
          if (code === "ArrowUp" && !net.isHost) tryJump(E.players[1]);
          if (code === "KeyE" && net.isHost) tryPass(0);
          // Guest pass: host-authoritative via inp pressed — don't flip locally
        }
        return;
      }
      E.keys[e.code] = true;
      if (E.state === "play" && !pausedRef.current) {
        if (e.code === "KeyW") tryJump(E.players[0]);
        if (e.code === "ArrowUp") tryJump(E.players[1]);
        if (e.code === "KeyE") tryPass(0);
        if (e.code === "KeyM") tryPass(1);
      }
    };
    const up = (e) => {
      const net = duoNetRef.current;
      if (net?.online) net.onKeyUp(e.code, E);
      else E.keys[e.code] = false;
    };
    addEventListener("keydown", dn); addEventListener("keyup", up);
    return () => { removeEventListener("keydown", dn); removeEventListener("keyup", up); };
  }, [E, tryJump, tryPass]);

  /* ---------- canvas tap-to-pass (phones) ---------- */
  const onCanvasTouch = (e) => {
    if (E.state !== "play") return;
    const cvs = canvasRef.current; if (!cvs) return;
    const r = cvs.getBoundingClientRect();
    const net = duoNetRef.current;
    const mySlot = net?.online ? (net.isHost ? 0 : 1) : null;
    for (const t of e.changedTouches) {
      const x = ((t.clientX - r.left) / r.width) * W, y = ((t.clientY - r.top) / r.height) * H;
      const other = E.players[1 - E.bombHolder];
      if (!other || Math.abs(x - other.x) >= 45 || Math.abs(y - (other.y - 34)) >= 55) continue;
      // online: only the bomb holder can pass, and guest must route via net input
      if (net?.online) {
        if (mySlot !== E.bombHolder) continue;
        const code = net.isHost ? "KeyE" : "KeyM";
        net.touchSet?.(code, true, E);
        if (net.isHost) tryPass(0);
        setTimeout(() => net.touchSet?.(code, false, E), 40);
      } else {
        tryPass(E.bombHolder);
      }
    }
  };

  /* ---------- touch button helper ---------- */
  const touchBtn = (k, label, style = {}) => {
    const press = (e) => {
      e.preventDefault();
      const net = duoNetRef.current;
      if (net?.online && net.touchSet) net.touchSet(k, true, E);
      else E.keys[k] = true;
      if (E.state === "play") {
        if (k === "KeyW") tryJump(E.players[0]);
        if (k === "ArrowUp") tryJump(E.players[1]);
        if (k === "KeyE") tryPass(0);
        // KeyM pass resolved on host when online
        if (k === "KeyM" && !(duoNetRef.current?.online)) tryPass(1);
      }
    };
    const release = (e) => {
      e.preventDefault();
      const net = duoNetRef.current;
      if (net?.online && net.touchSet) net.touchSet(k, false, E);
      else E.keys[k] = false;
    };
    const isPass = label.length > 2;
    return (
      <div key={k}
        onTouchStart={press} onTouchEnd={release} onTouchCancel={release}
        onMouseDown={press} onMouseUp={release}
        className={"flex items-center justify-center rounded-2xl select-none" + (isPass ? " sbt-touch-pass" : "")}
        style={{ background: "#0a0d17cc", border: "2px solid #1c2236", color: "#dfe6f5", fontWeight: isPass ? "bold" : "normal", touchAction: "none", ...style }}>
        {label}
      </div>
    );
  };

  const syncSetting = (key, val) => {
    // Either player can change arena / fuse / match length — sync to peer
    setSettings((s) => {
      const next = { ...s, [key]: val };
      settingsRef.current = next;
      return next;
    });
    if (online) duoNetRef.current?.sendUi({ type: "sel", key, val });
  };

  const setReady = (ready) => {
    if (!isGuest) return;
    setGuestReady(!!ready);
    duoNetRef.current?.sendUi({ type: "ready", ready: !!ready });
  };

  const startMatchUI = () => {
    if (isGuest) return;
    if (online && !guestReady && screenRef.current === "menu") return;
    const startHolder = Math.random() < 0.5 ? 0 : 1;
    const payload = { type: "start", settings: settingsRef.current, startHolder };
    beginOnlineMatch({ settings: settingsRef.current, startHolder });
    const blast = () => {
      try { duoNetRef.current?.sendUi(payload); } catch { /* ignore */ }
    };
    blast();
    setTimeout(blast, 120);
    setTimeout(blast, 350);
    setTimeout(blast, 800);
  };

  const backToMenu = (opts = {}) => {
    const fromNet = !!opts?.fromNet;
    setScreen("menu"); setPaused(false); setResults(null); setBanner(null); setCenterHtml(null);
    setGuestReady(false);
    E.state = "menu"; E.bannerMsg = null; E.resultsMsg = null;
    E._finishBroadcast = false;
    // Either player leaving lobby/pause → both return to menu together
    if (online && !fromNet) {
      try { duoNetRef.current?.sendUi({ type: "menu" }); } catch { /* */ }
      if (isGuest) {
        try { duoNetRef.current?.sendUi({ type: "ready", ready: false }); } catch { /* */ }
      }
    }
    const c = canvasRef.current; if (c) c.getContext("2d").clearRect(0, 0, W, H);
  };

  // After a match win: short celebration, then lobby — never the shelf panel
  useEffect(() => {
    if (!results) return undefined;
    const t = setTimeout(() => backToMenu({ fromNet: false }), 2800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  const dim = "#8b93ab", line = "#1c2236", card = "#0e111c";
  const pillStyle = (sel) => ({
    background: sel ? "#0e2231" : card, color: "#dfe6f5", fontFamily: "inherit",
    border: `1.5px solid ${sel ? "#38c7ff" : line}`,
    boxShadow: sel ? "0 0 14px rgba(56,199,255,.45)" : "none",
  });

  return (
    <div
      ref={rootElRef}
      className={"w-full relative flex items-center justify-center " + (screen === "menu" ? "sbt-root-menu" : "sbt-root-play")}
      style={{ background: "#07080f", fontFamily: 'Consolas,"Courier New",monospace', color: "#dfe6f5" }}
    >
      <div ref={stageRef} className={"sbt-stage" + (screen === "menu" ? " sbt-stage-idle" : "")}>
      <canvas ref={canvasRef} width={W} height={H} onTouchStart={onCanvasTouch}
        className={"block rounded-xl sbt-canvas" + (screen === "menu" ? " sbt-canvas-hidden" : "")}
        style={{
          touchAction: "none",
          boxShadow: screen === "play" ? "0 0 50px rgba(56,199,255,.12)" : "none",
        }} />

      {/* HUD */}
      {screen === "play" && (
        <div className="sbt-hud absolute inset-0 pointer-events-none z-10">
          <div className="absolute sbt-hud-panel sbt-hud-p1 font-bold" style={{ background: "#0a0d17d9", border: `1.5px solid ${line}`, color: "#38c7ff", boxShadow: "0 0 16px rgba(56,199,255,.25)" }}>
            <div className="sbt-hud-name tracking-widest" style={{ color: dim }}>{nameA.toUpperCase()}</div>
            <div className="sbt-hud-score">{scores[0]}</div>
          </div>
          <div className="absolute sbt-hud-panel sbt-hud-p2 font-bold text-right" style={{ background: "#0a0d17d9", border: `1.5px solid ${line}`, color: "#ff4d5a", boxShadow: "0 0 16px rgba(255,77,90,.25)" }}>
            <div className="sbt-hud-name tracking-widest" style={{ color: dim }}>{nameB.toUpperCase()}</div>
            <div className="sbt-hud-score">{scores[1]}</div>
          </div>
          <div className="absolute sbt-hud-timer font-bold"
            style={{ background: "#0a0d17d9", border: `1.5px solid ${line}`, color: danger ? "#ff4d5a" : "#dfe6f5", textShadow: danger ? "0 0 18px #ff4d5a" : "none", animation: danger ? "sbtPulse .5s infinite" : "none" }}>
            {timerTxt}
          </div>
          <div className="absolute sbt-hud-round" style={{ color: dim }}>ROUND {round}</div>
          <div className="absolute sbt-hud-controls flex pointer-events-auto">
            <button onClick={() => setPaused(true)} className="rounded-xl cursor-pointer" style={{ background: "#0a0d17d9", border: `1.5px solid ${line}`, color: "#dfe6f5" }}>⏸</button>
            <button onClick={() => setMuted((m) => !m)} className="rounded-xl cursor-pointer" style={{ background: "#0a0d17d9", border: `1.5px solid ${line}`, color: "#dfe6f5" }}>{muted ? "🔇" : "🔊"}</button>
          </div>
          <style>{`@keyframes sbtPulse{50%{transform:translateX(-50%) scale(1.12)}}`}</style>
        </div>
      )}

      {/* countdown / GO */}
      {centerHtml && (
        <div className="absolute sbt-center-text pointer-events-none z-[15] font-bold text-center" style={{ color: "#ffcf3f", textShadow: "0 0 30px rgba(255,207,63,.8)" }}>
          <div className="sbt-center-big">{centerHtml.big}</div>
          {centerHtml.small && <div className="sbt-center-small">{centerHtml.small}</div>}
        </div>
      )}
      {/* round banner */}
      {banner && (
        <div className="absolute sbt-banner-text pointer-events-none z-[15] font-bold text-center" style={{ color: banner.color, textShadow: `0 0 20px ${banner.color}` }}>
          {banner.text}
        </div>
      )}

      {/* touch controls — online: only your own pad */}
      {isTouch && screen === "play" && (
        <>
          {(!online || role === "A") && (
            <div className="absolute sbt-touch-pad sbt-touch-left flex z-[12] pointer-events-auto">
              {touchBtn("KeyA", "◀")}{touchBtn("KeyD", "▶")}{touchBtn("KeyW", "⤒")}{touchBtn("KeyE", "PASS", { borderColor: "#38c7ff" })}
            </div>
          )}
          {(!online || role === "B") && (
            <div className="absolute sbt-touch-pad sbt-touch-right flex z-[12] pointer-events-auto">
              {touchBtn("KeyM", "PASS", { borderColor: "#ff4d5a" })}{touchBtn("ArrowUp", "⤒")}{touchBtn("ArrowLeft", "◀")}{touchBtn("ArrowRight", "▶")}
            </div>
          )}
        </>
      )}
      </div>

      {/* MENU — balanced lobby in board frame; parent scrolls if still short */}
      {screen === "menu" && (
        <div className="sbt-lobby z-20 flex justify-center" style={{ background: "#07080f" }}>
          <div className="sbt-lobby-inner">
            <header className="sbt-lobby-hero">
              <h1 className="sbt-lobby-title">
                <span className="sbt-lobby-title-a">STICKMAN</span>
                <span className="sbt-lobby-title-bomb" aria-hidden="true">💣</span>
                <span className="sbt-lobby-title-b">BOMB TAG</span>
              </h1>
              <p className="sbt-lobby-tagline">
                {online
                  ? `${nameA} vs ${nameB} · pass the bomb · survivor wins`
                  : "pass the bomb before it blows · survivor wins the round"}
              </p>
            </header>

            {/* Lobby CTA — host Start / guest I'm Ready */}
            <div className="sbt-lobby-cta" style={{ background: card, border: `1.5px solid ${line}` }}>
              {online ? (
                <>
                  <div className="sbt-lobby-cta-role" style={{ color: isGuest ? "#ff4d5a" : "#38c7ff" }}>
                    YOU ARE {isGuest ? nameB.toUpperCase() : nameA.toUpperCase()}
                    {isGuest ? " · INVITED" : " · HOST"}
                  </div>
                  <div className="sbt-lobby-cta-hint" style={{ color: dim }}>
                    {isHost
                      ? (guestReady
                        ? `${nameB} is ready — pick settings, then start`
                        : `Waiting for ${nameB} to press I'm Ready`)
                      : (guestReady
                        ? `You're ready — waiting for ${nameA} to start`
                        : "Press I'm Ready when you want to play")}
                  </div>
                  {isHost ? (
                    <button
                      type="button"
                      onClick={startMatchUI}
                      disabled={!guestReady}
                      className="sbt-lobby-cta-btn"
                      style={{
                        background: guestReady ? "linear-gradient(90deg,#3a7bfd,#ff4d5a)" : "linear-gradient(90deg,#3a4558,#4a5568)",
                        opacity: guestReady ? 1 : 0.6,
                        boxShadow: guestReady ? "0 0 20px rgba(90,120,255,.4)" : "none",
                        cursor: guestReady ? "pointer" : "not-allowed",
                      }}
                    >
                      {guestReady ? "START MATCH ▶" : `WAITING FOR ${nameB.toUpperCase()}…`}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReady(!guestReady)}
                      className="sbt-lobby-cta-btn"
                      style={{
                        background: guestReady
                          ? "linear-gradient(90deg,#1f9e58,#4dff9e)"
                          : "linear-gradient(90deg,#ff4d5a,#ff8090)",
                        boxShadow: guestReady
                          ? "0 0 18px rgba(77,255,158,.45)"
                          : "0 0 18px rgba(255,77,90,.4)",
                      }}
                    >
                      {guestReady ? "READY ✓  (tap to cancel)" : "I'M READY ▶"}
                    </button>
                  )}
                </>
              ) : (
                <button type="button" onClick={startMatchUI} className="sbt-lobby-cta-btn sbt-lobby-cta-btn-solo"
                  style={{ background: "linear-gradient(90deg,#3a7bfd,#ff4d5a)", boxShadow: "0 0 20px rgba(90,120,255,.4)" }}>
                  START MATCH ▶
                </button>
              )}
            </div>

            <section className="sbt-lobby-section">
              <div className="sbt-lobby-label">
                Match length{online ? <span className="sbt-lobby-label-hint"> · either can pick</span> : null}
              </div>
              <div className="sbt-opt-row">
                {[{ r: 1, n: "Quick Match", s: "1 round" }, { r: 3, n: "Best of 3", s: "first to 2" }, { r: 5, n: "Best of 5", s: "first to 3" }].map((o) => (
                  <button key={o.r} type="button" onClick={() => syncSetting("rounds", o.r)} className={"sbt-opt-pill" + (settings.rounds === o.r ? " is-selected" : "")} style={pillStyle(settings.rounds === o.r)}>
                    <b className="sbt-opt-pill-title">{o.n}</b>
                    <small className="sbt-opt-pill-sub" style={{ color: dim }}>{o.s}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="sbt-lobby-section">
              <div className="sbt-lobby-label">
                Bomb timer{online ? <span className="sbt-lobby-label-hint"> · either can pick</span> : null}
              </div>
              <div className="sbt-opt-row">
                {[{ f: 30, s: "frantic" }, { f: 45, s: "classic" }, { f: 60, s: "long fuse" }].map((o) => (
                  <button key={o.f} type="button" onClick={() => syncSetting("fuse", o.f)} className={"sbt-opt-pill" + (settings.fuse === o.f ? " is-selected" : "")} style={pillStyle(settings.fuse === o.f)}>
                    <b className="sbt-opt-pill-title">{o.f} s</b>
                    <small className="sbt-opt-pill-sub" style={{ color: dim }}>{o.s}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="sbt-lobby-section sbt-lobby-arenas">
              <div className="sbt-lobby-label">
                {online ? "Arena" : "Choose arena"}
                {online ? <span className="sbt-lobby-label-hint"> · either can pick</span> : null}
              </div>
              <div className="sbt-arena-grid">
                {ARENAS.map((_, i) => (
                  <ArenaCard
                    key={i}
                    i={i}
                    selected={settings.arena === i}
                    onSelect={(a) => syncSetting("arena", a)}
                  />
                ))}
              </div>
            </section>
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

      {/* RESULTS — you win / you lost (online), then auto lobby */}
      {results && (
        <Modal>
          <div data-sbt-winner={results.winner === 0 ? "A" : "B"} className="text-6xl mb-1.5">
            {(!online || (role === "A" ? 0 : 1) === results.winner) ? "🏆" : "💥"}
          </div>
          <div className="text-[28px] font-bold mb-1.5" style={{
            letterSpacing: 3,
            color: (!online || (role === "A" ? 0 : 1) === results.winner) ? results.color : "#8b93ab",
            textShadow: (!online || (role === "A" ? 0 : 1) === results.winner) ? `0 0 16px ${results.color}` : "none",
          }}>
            {!online
              ? `${nameOf(results.winner).toUpperCase()} WINS!`
              : ((role === "A" ? 0 : 1) === results.winner ? "YOU WIN!" : "YOU LOST")}
          </div>
          {online && (
            <div className="text-sm mb-2" style={{ color: dim, letterSpacing: 1 }}>
              {(role === "A" ? 0 : 1) === results.winner
                ? `${nameOf(1 - results.winner)} lost`
                : `${nameOf(results.winner)} won`}
            </div>
          )}
          <div className="mb-2" style={{ color: dim, letterSpacing: 2 }}>{results.score}</div>
          <div style={{ color: dim, fontSize: 12, letterSpacing: 1 }}>Returning to lobby…</div>
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
