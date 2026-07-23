import React, { useRef, useEffect, useState } from "react";

// ============ STICKMAN DODGEBALL 🎯 — NEON EDITION ============
// Survive the falling-hazard storm. Last stickman standing wins the round.
//   P1: A/D move · W jump (tap again in air = double jump) · S hold = slide · F dash
//   P2: ←/→ move · ↑ jump (double jump) · ↓ hold = slide · / dash
// Jump over rollers on the ground · slide under things bouncing overhead ·
// dash for a burst of speed + brief invulnerability frames.

const CW = 1040, CH = 600;
const GY = 500;               // arena floor
const ARENA_L = 80, ARENA_R = 960;
const GRAV = 2100;
const MOVE = 320, AIR_MOVE = 260;
const JUMP_V = 760;
const DASH_SPD = 720, DASH_TIME = 0.16, DASH_CD = 1.0, DASH_IFRAME = 0.2;
const MAX_HP = 100;
const ROUND_TIME_SCALE = 1;   // difficulty ramps against this clock

// ---------------- SOUND ENGINE ----------------
function makeSFX() {
  let ac = null, muted = false;
  const ctx = () => {
    if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (A) ac = new A(); }
    if (ac && ac.state === "suspended") ac.resume();
    return ac;
  };
  const tone = (f, d, type = "sine", v = 0.2, slide = 0, delay = 0) => {
    if (muted) return;
    try {
      const a = ctx(); if (!a) return;
      const t0 = a.currentTime + delay;
      const o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + d);
      g.gain.setValueAtTime(v, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
      o.connect(g).connect(a.destination);
      o.start(t0); o.stop(t0 + d + 0.02);
    } catch (e) {}
  };
  const noise = (d, fq = 1200, v = 0.25, q = 1) => {
    if (muted) return;
    try {
      const a = ctx(); if (!a) return;
      const len = Math.floor(a.sampleRate * d);
      const buf = a.createBuffer(1, len, a.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = a.createBufferSource(); src.buffer = buf;
      const f = a.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = fq; f.Q.value = q;
      const g = a.createGain(); g.gain.value = v;
      src.connect(f).connect(g).connect(a.destination);
      src.start();
    } catch (e) {}
  };
  return {
    setMuted: (m) => { muted = m; },
    unlock: () => ctx(),
    jump: () => tone(320, 0.1, "sine", 0.12, 220),
    doubleJump: () => tone(460, 0.12, "sine", 0.14, 320),
    dash: () => noise(0.13, 1500, 0.2, 1.5),
    slide: () => noise(0.14, 700, 0.14, 0.8),
    thud: () => { noise(0.12, 450, 0.3, 1); tone(100, 0.15, "square", 0.2, -50); },
    hit: (big) => { noise(big ? 0.22 : 0.14, big ? 400 : 650, big ? 0.42 : 0.3, 1); tone(big ? 90 : 130, 0.18, "square", 0.24, -60); },
    crush: () => { noise(0.4, 300, 0.5, 0.6); tone(70, 0.4, "sawtooth", 0.3, -40); },
    boom: () => { noise(0.42, 220, 0.5, 0.6); tone(60, 0.4, "sine", 0.35, -30); },
    shatter: () => noise(0.2, 3200, 0.25, 3),
    clank: () => { tone(700, 0.08, "square", 0.16, -220); noise(0.06, 2800, 0.16, 3); },
    warn: () => tone(880, 0.05, "square", 0.08),
    pickup: (good = true) => { tone(good ? 700 : 300, 0.14, "triangle", 0.2, good ? 400 : -150); },
    shield: () => tone(500, 0.2, "triangle", 0.18, 300),
    ghost: () => tone(260, 0.3, "sine", 0.14, 180),
    lucky: () => [700, 1000, 1400].forEach((f, i) => tone(f, 0.16, "triangle", 0.18, 0, i * 0.08)),
    beep: (final) => tone(final ? 880 : 440, 0.14, "square", 0.16),
    ko: () => { tone(420, 0.55, "sawtooth", 0.26, -340); noise(0.4, 500, 0.3, 0.7); },
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.26, "triangle", 0.2, 0, i * 0.13)),
    fanfare: () => [392, 523, 659, 784, 1046, 1319, 1568].forEach((f, i) => tone(f, 0.3, "triangle", 0.2, 0, i * 0.14)),
    firework: () => noise(0.3, 1800, 0.2, 0.9),
    thunder: () => { noise(0.55, 160, 0.42, 0.4); tone(55, 0.55, "sine", 0.32, -25); },
    zap: () => { tone(1600, 0.15, "sawtooth", 0.2, -900); noise(0.1, 3000, 0.2, 3); },
    gust: () => noise(0.6, 500, 0.16, 0.5),
    freeze: () => { tone(1500, 0.3, "sine", 0.16, -800); tone(2100, 0.24, "sine", 0.1, -1100); },
    powerOff: () => tone(220, 0.5, "sawtooth", 0.2, -180),
    powerOn: () => tone(220, 0.4, "sawtooth", 0.2, 260),
    rumble: () => noise(0.5, 130, 0.28, 0.4),
    alarm: (n) => tone(880, 0.12, "square", 0.16, 0, n * 0.18),
  };
}
const SFX = makeSFX();

// ---------------- ARENA EVENTS ----------------
// Every 20 seconds, each arena triggers its own signature event.
const EVENTS = {
  lightning: { icon: "⚡", label: "LIGHTNING STRIKE", color: "#c9a8ff" },
  wind:      { icon: "🌪️", label: "WIND STORM", color: "#ffd27a" },
  ice:       { icon: "❄️", label: "ICE FLOOR", color: "#a9e6ff" },
  blackout:  { icon: "🌑", label: "BLACKOUT", color: "#c9b8ff" },
  quake:     { icon: "🌍", label: "EARTHQUAKE", color: "#ff8a4c" },
  meteor:    { icon: "🚨", label: "METEOR SHOWER", color: "#ff5c3c" },
};

// ---------------- ARENAS ----------------
const ARENAS = [
  {
    name: "Thunder Grid", desc: "storm clouds · ⚡ lightning every 20s", theme: "lightning", event: "lightning",
    card: { top: "#0a0620", bot: "#241040", acc: "#c9a8ff", acc2: "#5ad8ff" },
  },
  {
    name: "Dust Vortex", desc: "desert dusk · 🌪️ wind storms every 20s", theme: "wind", event: "wind",
    card: { top: "#1c0a10", bot: "#3c1c14", acc: "#ffb03c", acc2: "#ff8a4c" },
  },
  {
    name: "Cryo Circuit", desc: "falling snow · ❄️ ice floor every 20s", theme: "ice", event: "ice",
    card: { top: "#031224", bot: "#0c2c46", acc: "#a9e6ff", acc2: "#5ad8ff" },
  },
  {
    name: "Blackout Sector", desc: "sweeping searchlights · 🌑 blackout every 20s", theme: "blackout", event: "blackout",
    card: { top: "#050308", bot: "#140a20", acc: "#c9b8ff", acc2: "#5ad8ff" },
  },
  {
    name: "Fault Line", desc: "cracked industrial floor · 🌍 quakes every 20s", theme: "quake", event: "quake",
    card: { top: "#180804", bot: "#3a1408", acc: "#ff8a4c", acc2: "#ffd25c" },
  },
  {
    name: "Meteor Bay", desc: "asteroid dome · 🚨 meteor showers every 20s", theme: "meteor", event: "meteor",
    card: { top: "#03040c", bot: "#180a1c", acc: "#ff5c3c", acc2: "#ffb03c" },
  },
];

// ---------------- HAZARD TYPES ----------------
const HAZ = {
  crate:    { r: 22, dmg: 16, mass: "med",  bounce: 0, roll: false, explode: false, breaks: true,  blocks: false, col: "#c99a56", label: "CRATE" },
  ball:     { r: 19, dmg: 20, mass: "med",  bounce: 3, roll: true,  explode: false, breaks: false, blocks: false, col: "#e8eef5", label: "BALL" },
  anvil:    { r: 24, dmg: 34, mass: "heavy",bounce: 0, roll: false, explode: false, breaks: false, blocks: true,  blockT: 2.4, col: "#5a6270", label: "ANVIL" },
  barrel:   { r: 20, dmg: 15, mass: "med",  bounce: 1, roll: true,  explode: false, breaks: true,  blocks: false, col: "#b5793a", label: "BARREL" },
  bomb:     { r: 16, dmg: 18, mass: "light",bounce: 0, roll: false, explode: true,  breaks: false, blocks: false, col: "#2c2f36", label: "BOMB" },
  ice:      { r: 21, dmg: 15, mass: "med",  bounce: 1, roll: false, explode: false, breaks: true,  blocks: false, col: "#a9e6ff", label: "ICE", slick: true },
  concrete: { r: 25, dmg: 28, mass: "heavy",bounce: 0, roll: false, explode: false, breaks: false, blocks: true,  blockT: 3.0, col: "#8a8f98", label: "BLOCK" },
  spiked:   { r: 18, dmg: 22, mass: "light",bounce: 6, roll: false, explode: false, breaks: false, blocks: false, col: "#ff4f6d", label: "SPIKED", flies: true },
  neon:     { r: 16, dmg: 12, mass: "light",bounce: 2, roll: false, explode: false, breaks: false, blocks: false, col: "#5ad8ff", label: "CUBE" },
  hammer:   { r: 27, dmg: 32, mass: "heavy",bounce: 0, roll: false, explode: true,  breaks: false, blocks: false, col: "#7a8290", label: "HAMMER", shock: 90 },
  meteor:   { r: 13, dmg: 14, mass: "light",bounce: 0, roll: false, explode: false, breaks: false, blocks: false, col: "#ff5c3c", label: "METEOR", trail: true },
};
const HAZ_KEYS = Object.keys(HAZ);
// unlock order: gentler hazards first, heavy hitters after the storm ramps up
const HAZ_TIERS = [
  ["crate", "ball", "neon"],
  ["crate", "ball", "neon", "barrel", "ice"],
  ["crate", "ball", "neon", "barrel", "ice", "spiked", "bomb"],
  ["crate", "ball", "neon", "barrel", "ice", "spiked", "bomb", "anvil", "concrete", "hammer"],
];

// ---------------- POWER-UPS ----------------
const PUPS = {
  heal:    { icon: "➕", color: "#7dffb0", label: "HEAL" },
  shield:  { icon: "🛡", color: "#5ad8ff", label: "SHIELD", dur: 5 },
  speed:   { icon: "⚡", color: "#ffe45c", label: "SPEED", dur: 6 },
  jump:    { icon: "⬆", color: "#b08cff", label: "JUMP+", dur: 6 },
  dashcg:  { icon: "🔄", color: "#ff8a4c", label: "DASH RDY" },
  slowmo:  { icon: "⏱", color: "#8fe0ff", label: "SLOW-MO", dur: 4 },
  magnet:  { icon: "🧲", color: "#ff4fd8", label: "MAGNET", dur: 7 },
  ghost:   { icon: "👻", color: "#c9d2ff", label: "GHOST", dur: 4 },
  lucky:   { icon: "🍀", color: "#5dff8a", label: "LUCKY", dur: 999 },
};
const PUP_KEYS = Object.keys(PUPS);

const KEYS = {
  p1: { left: "KeyA", right: "KeyD", jump: "KeyW", slide: "KeyS", dash: "KeyF" },
  p2: { left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp", slide: "ArrowDown", dash: "Slash" },
};
const ALL_KEYS = [...Object.values(KEYS.p1), ...Object.values(KEYS.p2)];

function makePlayer(id) {
  return {
    id, x: id === 0 ? 260 : 780, y: GY, vx: 0, vy: 0, facing: id === 0 ? 1 : -1,
    neon: id === 0 ? "#3aa0ff" : "#ff3b4d", glow: id === 0 ? "#7cc8ff" : "#ff8090",
    hp: MAX_HP, onGround: true, jumps: 0, sliding: false,
    dashT: 0, dashCd: 0, iframe: 0, hurtFlash: 0,
    shieldT: 0, speedT: 0, jumpT: 0, magnetT: 0, ghostT: 0, slick: 0, lucky: false,
    dead: false, deathT: 0, runPhase: 0, wobble: Math.random() * 6,
  };
}

export default function StickmanDodgeball() {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState("menu"); // menu | playing | matchEnd
  const [mode, setMode] = useState("bo3");
  const [arenaIdx, setArenaIdx] = useState(0);
  const [score, setScore] = useState([0, 0]);
  const [matchWinner, setMatchWinner] = useState(0);
  const [muted, setMuted] = useState(false);
  const [touchUI, setTouchUI] = useState(false);
  const stateRef = useRef({});

  useEffect(() => { SFX.setMuted(muted); }, [muted]);
  useEffect(() => {
    const touch = typeof window !== "undefined" &&
      (("ontouchstart" in window) || (navigator.maxTouchPoints || 0) > 0);
    setTouchUI(touch);
  }, []);

  const targetWins = mode === "quick" ? 1 : mode === "bo3" ? 2 : 3;

  const startMatch = (m = mode, ai = arenaIdx) => {
    SFX.unlock();
    setMode(m); setArenaIdx(ai);
    setScore([0, 0]); setMatchWinner(0);
    setPhase("playing");
    stateRef.current.launch = { mode: m, arenaIdx: ai };
  };

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const launch = stateRef.current.launch;
    const arena = ARENAS[launch.arenaIdx];
    const target = launch.mode === "quick" ? 1 : launch.mode === "bo3" ? 2 : 3;

    const S = {
      players: [], hazards: [], pups: [], particles: [], texts: [], rings: [],
      keys: {}, pressed: {},
      t: 0, round: 1, wins: [0, 0], roundWinner: -1,
      mode: "countdown", modeT: 0, lastBeep: -1,
      roundT: 0, spawnT: 1.2, pupT: 4,
      globalSlowT: 0, shake: 0, flash: 0,
      banner: "", bannerT: 0, bannerCol: "#ffe97a",
      // ---- arena event system: this arena's signature event fires every 20s ----
      eventCd: 6,           // short delay before the first one so players can get their bearings
      eventActive: null, eventT: 0, eventWarnT: 0,
      lightningZones: [], windDir: 1, windT: 0, iceT: 0, blackoutT: 0, quakeT: 0,
      meteorT: 0, meteorSpawnT: 0, quakeJitterT: 0,
      billboards: Array.from({ length: 3 }, (_, i) => ({ x: 60 + i * 320, msg: ["SURVIVE", "DODGE THE STORM", "LAST ONE STANDING"][i], hue: i })),
      beams: Array.from({ length: 4 }, (_, i) => ({ x: 140 + i * 240, ph: Math.random() * 6 })),
      floatPs: Array.from({ length: 26 }, () => ({ x: Math.random() * CW, y: Math.random() * GY, ph: Math.random() * 6, sp: 0.3 + Math.random() * 0.5 })),
      panels: Array.from({ length: 13 }, (_, i) => ({ x: ARENA_L + i * ((ARENA_R - ARENA_L) / 12), ph: Math.random() * 6 })),
      snow: Array.from({ length: 34 }, () => ({ x: Math.random() * CW, y: Math.random() * GY, sp: 0.5 + Math.random(), ph: Math.random() * 6 })),
      duststorm: Array.from({ length: 40 }, () => ({ x: Math.random() * CW, y: Math.random() * GY, sp: 0.6 + Math.random() * 1.2 })),
      stars: Array.from({ length: 60 }, () => ({ x: Math.random() * CW, y: Math.random() * (GY * 0.7), r: Math.random() * 1.6 + 0.4, ph: Math.random() * 6 })),
      asteroids: Array.from({ length: 5 }, (_, i) => ({ x: (i * 210) % CW, y: 40 + (i * 61) % 160, r: 8 + Math.random() * 10, sp: 8 + Math.random() * 10 })),
      searchlights: Array.from({ length: 2 }, (_, i) => ({ x0: i === 0 ? ARENA_L : ARENA_R, ph: Math.random() * 6 })),
      cracks: Array.from({ length: 6 }, (_, i) => ({ x: ARENA_L + 60 + i * 140, ph: Math.random() * 6 })),
      fireworks: [], done: false,
      idc: 1,
    };

    const resetRound = () => {
      S.players = [makePlayer(0), makePlayer(1)];
      S.hazards = []; S.pups = []; S.particles = []; S.texts = []; S.rings = [];
      S.mode = "countdown"; S.modeT = 0; S.lastBeep = -1;
      S.roundT = 0; S.spawnT = 1.3; S.pupT = 5; S.globalSlowT = 0;
      S.roundWinner = -1;
      S.eventCd = 8; S.eventActive = null; S.eventT = 0; S.eventWarnT = 0;
      S.lightningZones = []; S.windT = 0; S.iceT = 0; S.blackoutT = 0; S.quakeT = 0;
      S.meteorT = 0; S.meteorSpawnT = 0;
    };
    resetRound();

    const down = (e) => {
      if (ALL_KEYS.includes(e.code)) e.preventDefault();
      if (!S.keys[e.code]) S.pressed[e.code] = true;
      S.keys[e.code] = true;
    };
    const up = (e) => { S.keys[e.code] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    stateRef.current.setKey = (code, isDown) => {
      if (isDown && !S.keys[code]) S.pressed[code] = true;
      S.keys[code] = isDown;
    };

    // ---------------- fx ----------------
    const spark = (x, y, color, n = 10, spd = 240, upBias = 60) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = spd * (0.4 + Math.random() * 0.8);
        S.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - upBias, life: 0.5, max: 0.5, color, r: 2 + Math.random() * 3, glow: true });
      }
    };
    const dust = (x, y, n = 6, color = "rgba(220,220,220,0.5)") => {
      for (let i = 0; i < n; i++) {
        S.particles.push({ x: x + (Math.random() - 0.5) * 24, y, vx: (Math.random() - 0.5) * 130, vy: -30 - Math.random() * 50, life: 0.4, max: 0.4, color, r: 3 + Math.random() * 3, grav: 0.3 });
      }
    };
    const dmgText = (x, y, str, color, size = 16) => S.texts.push({ x, y, vy: -75, life: 0.8, max: 0.8, str, color, size });
    const setBanner = (str, col = "#ffe97a", t = 1) => { S.banner = str; S.bannerCol = col; S.bannerT = t; };
    const ring = (x, y, color, max = 90, t = 0.4) => S.rings.push({ x, y, r: 8, max, life: t, t, color });

    // ---------------- difficulty ----------------
    const diffK = () => Math.min(1, S.roundT / 55);           // 0→1 over ~55s
    const spawnInterval = () => {
      const k = diffK();
      const base = 1.35 - k * 1.0;                             // 1.35s → 0.35s
      return Math.max(0.28, base) * (0.7 + Math.random() * 0.6);
    };
    const fallSpeedMul = () => 1 + diffK() * 1.3;
    const batchCount = () => {
      const k = diffK();
      const r = Math.random();
      if (k > 0.75 && r < 0.28) return 3;
      if (k > 0.4 && r < 0.4) return 2;
      return 1;
    };
    const tierFor = () => {
      const k = diffK();
      if (k < 0.22) return HAZ_TIERS[0];
      if (k < 0.5) return HAZ_TIERS[1];
      if (k < 0.8) return HAZ_TIERS[2];
      return HAZ_TIERS[3];
    };

    // ---------------- spawning ----------------
    const spawnHazard = () => {
      const tier = tierFor();
      const type = tier[Math.floor(Math.random() * tier.length)];
      const def = HAZ[type];
      const x = ARENA_L + 40 + Math.random() * (ARENA_R - ARENA_L - 80);
      const mul = fallSpeedMul();
      const baseSpeed = def.mass === "heavy" ? 340 : def.mass === "light" ? 480 : 400;
      const h = {
        id: S.idc++, type, x, y: -30, vx: 0, vy: baseSpeed * mul * (0.85 + Math.random() * 0.3),
        r: def.r, state: "falling", bounces: 0, blockT: 0, rot: 0, rotV: (Math.random() - 0.5) * 4,
        hitCd: { 0: 0, 1: 0 }, telegraphed: false, life: 14, grounded: false,
      };
      if (def.flies) { h.vx = (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 100); }
      S.hazards.push(h);
    };
    const spawnPup = () => {
      const type = PUP_KEYS[Math.floor(Math.random() * PUP_KEYS.length)];
      const x = ARENA_L + 60 + Math.random() * (ARENA_R - ARENA_L - 120);
      S.pups.push({ id: S.idc++, type, x, y: -20, vy: 190, vx: 0, life: 9, grabbed: false, ph: Math.random() * 6 });
    };
    const spawnMeteor = () => {
      const x = ARENA_L + 30 + Math.random() * (ARENA_R - ARENA_L - 60);
      S.hazards.push({
        id: S.idc++, type: "meteor", x, y: -20, vx: (Math.random() - 0.5) * 90,
        vy: 620 + Math.random() * 200, r: HAZ.meteor.r, state: "falling", bounces: 0, blockT: 0,
        rot: 0, rotV: 0, hitCd: { 0: 0, 1: 0 }, telegraphed: false, life: 6, grounded: false,
      });
    };

    // ================= ARENA EVENT SYSTEM =================
    // Every 20 seconds, the arena's own signature event fires.
    const EVENT_CYCLE = 20;
    const startEvent = () => {
      const ev = arena.event;
      S.eventActive = ev;
      const def = EVENTS[ev];
      switch (ev) {
        case "lightning": {
          S.eventT = 2.0;
          const n = 2 + Math.floor(Math.random() * 2);
          S.lightningZones = Array.from({ length: n }, () => ({
            x: ARENA_L + 60 + Math.random() * (ARENA_R - ARENA_L - 120),
            telegraphT: 1.3, w: 64, struck: false, strikeT: 0,
          }));
          break;
        }
        case "wind":
          S.eventT = 5;
          S.windT = 5;
          S.windDir = Math.random() < 0.5 ? -1 : 1;
          SFX.gust();
          break;
        case "ice":
          S.eventT = 7;
          S.iceT = 7;
          SFX.freeze();
          break;
        case "blackout":
          S.eventT = 5;
          S.blackoutT = 5;
          SFX.powerOff();
          setTimeout(() => SFX.powerOn(), 4600);
          break;
        case "quake":
          S.eventT = 4;
          S.quakeT = 4;
          SFX.rumble();
          break;
        case "meteor":
          S.eventT = 10;
          S.meteorT = 10;
          S.meteorSpawnT = 0;
          for (let i = 0; i < 3; i++) SFX.alarm(i);
          break;
        default: break;
      }
      setBanner(`${def.icon} ${def.label}!`, def.color, 1.6);
      S.shake = Math.max(S.shake, ev === "quake" ? 0.5 : 0.2);
      S.flash = Math.max(S.flash, ev === "lightning" || ev === "blackout" ? 0.14 : 0.08);
    };

    const updateEvents = (dt) => {
      // countdown to the next occurrence of this arena's event
      if (S.mode === "survive") {
        S.eventCd -= dt;
        if (S.eventCd <= 1.2 && S.eventWarnT <= 0) S.eventWarnT = 0.01; // begin flashing "incoming" warning
        if (S.eventWarnT > 0) S.eventWarnT += dt;
        if (S.eventCd <= 0) { startEvent(); S.eventCd = EVENT_CYCLE; S.eventWarnT = 0; }
      }

      // ---- lightning ----
      if (S.lightningZones.length) {
        S.lightningZones.forEach((z) => {
          if (!z.struck) {
            z.telegraphT -= dt;
            if (z.telegraphT <= 0) {
              z.struck = true; z.strikeT = 0.35;
              SFX.thunder(); SFX.zap();
              S.shake = Math.max(S.shake, 0.3); S.flash = Math.max(S.flash, 0.22);
              ring(z.x, GY, EVENTS.lightning.color, 60);
              spark(z.x, GY - 10, "#ffffff", 16, 300);
              S.players.forEach((p) => {
                if (p.dead) return;
                if (Math.abs(p.x - z.x) < z.w / 2) {
                  applyDamage(p, 24, "⚡");
                }
              });
            }
          } else {
            z.strikeT -= dt;
          }
        });
        S.lightningZones = S.lightningZones.filter((z) => !z.struck || z.strikeT > -0.3);
      }
      // ---- wind ----
      if (S.windT > 0) S.windT -= dt;
      // ---- ice ----
      if (S.iceT > 0) S.iceT -= dt;
      // ---- blackout ----
      if (S.blackoutT > 0) S.blackoutT -= dt;
      // ---- quake ----
      if (S.quakeT > 0) {
        S.quakeT -= dt;
        S.shake = Math.max(S.shake, 0.32);
        S.quakeJitterT -= dt;
        if (S.quakeJitterT <= 0) {
          S.quakeJitterT = 0.35 + Math.random() * 0.3;
          S.players.forEach((p) => {
            if (p.dead || !p.onGround) return;
            p.vx += (Math.random() - 0.5) * 340;
            dust(p.x, p.y, 4, "rgba(255,180,120,0.4)");
          });
        }
      }
      // ---- meteor shower ----
      if (S.meteorT > 0) {
        S.meteorT -= dt;
        S.meteorSpawnT -= dt;
        if (S.meteorSpawnT <= 0) { spawnMeteor(); S.meteorSpawnT = 0.22 + Math.random() * 0.18; }
      }
      if (S.eventActive && S.eventT > 0) {
        S.eventT -= dt;
        if (S.eventT <= 0) S.eventActive = null;
      }
    };

    // ---------------- explosions ----------------
    const explode = (x, y, dmg, radius) => {
      SFX.boom();
      S.shake = Math.max(S.shake, 0.4); S.flash = Math.max(S.flash, 0.12);
      ring(x, y, "#ffb347", radius + 20);
      spark(x, y, "#ffb347", 22, 420, 100);
      spark(x, y, "#ff5c1a", 14, 320, 60);
      S.players.forEach((pl) => {
        if (pl.dead) return;
        const d = Math.hypot(pl.x - x, (pl.y - 40) - y);
        if (d < radius) {
          const amt = Math.round(dmg * (1 - d / radius));
          if (amt > 0) applyDamage(pl, amt, "💥");
        }
      });
    };

    // ---------------- damage ----------------
    const applyDamage = (p, amt, tag = "") => {
      if (p.dead || p.iframe > 0) return;
      if (p.ghostT > 0) return; // hazards pass through
      if (p.shieldT > 0) {
        SFX.clank();
        spark(p.x, p.y - 45, "#5ad8ff", 10, 220);
        dmgText(p.x, p.y - 96, "BLOCKED", "#5ad8ff", 14);
        p.vx += (p.x < CW / 2 ? -1 : 1) * 40;
        return;
      }
      let real = amt;
      if (p.hp - real <= 0 && p.lucky) {
        p.lucky = false;
        p.hp = 1;
        p.iframe = 1.4;
        SFX.lucky();
        setBanner(`P${p.id + 1} LUCKY ESCAPE!`, "#5dff8a", 1);
        spark(p.x, p.y - 45, "#5dff8a", 18, 320);
        return;
      }
      p.hp = Math.max(0, p.hp - real);
      p.hurtFlash = 0.2;
      p.iframe = Math.max(p.iframe, 0.35);
      dmgText(p.x, p.y - 96, `-${real}${tag ? " " + tag : ""}`, "#ff8f6a", real >= 25 ? 20 : 16);
      SFX.hit(real >= 25);
      spark(p.x, p.y - 45, "#ff8f6a", 10, 260);
      S.shake = Math.max(S.shake, real >= 25 ? 0.22 : 0.12);
      if (p.hp <= 0 && !p.dead) {
        p.dead = true; p.deathT = 0;
        SFX.ko();
        spark(p.x, p.y - 45, p.neon, 20, 340);
      }
    };
    const crushKill = (p) => {
      if (p.dead || p.iframe > 0) return;
      if (p.ghostT > 0) return;
      if (p.shieldT > 0) { applyDamage(p, 40, "CRUSH"); return; }
      if (p.lucky) { p.lucky = false; p.hp = 1; p.iframe = 1.4; SFX.lucky(); setBanner(`P${p.id + 1} LUCKY ESCAPE!`, "#5dff8a", 1); return; }
      p.hp = 0; p.dead = true; p.deathT = 0;
      SFX.crush();
      setBanner(`P${p.id + 1} CRUSHED!`, "#ff5d7a", 1);
      spark(p.x, p.y - 40, "#ff5d7a", 24, 380);
      S.shake = Math.max(S.shake, 0.35);
    };

    // ---------------- player update ----------------
    const updatePlayer = (p, dt) => {
      if (p.dead) { p.deathT += dt; return; }
      const k = p.id === 0 ? KEYS.p1 : KEYS.p2;
      const canAct = S.mode === "survive";

      if (p.iframe > 0) p.iframe -= dt;
      if (p.hurtFlash > 0) p.hurtFlash -= dt;
      if (p.dashCd > 0) p.dashCd -= dt;
      if (p.shieldT > 0) p.shieldT -= dt;
      if (p.speedT > 0) p.speedT -= dt;
      if (p.jumpT > 0) p.jumpT -= dt;
      if (p.magnetT > 0) p.magnetT -= dt;
      if (p.ghostT > 0) p.ghostT -= dt;
      if (p.slick > 0) p.slick -= dt;

      const speedMul = p.speedT > 0 ? 1.5 : 1;
      const jumpMul = p.jumpT > 0 ? 1.3 : 1;

      // dash
      if (canAct && S.pressed[k.dash] && p.dashCd <= 0 && p.dashT <= 0) {
        p.dashT = DASH_TIME; p.dashCd = DASH_CD;
        p.iframe = Math.max(p.iframe, DASH_IFRAME);
        SFX.dash();
        spark(p.x, p.y - 40, p.neon, 8, 200);
      }

      // slide
      const wantSlide = canAct && S.keys[k.slide] && p.onGround && p.dashT <= 0;
      if (wantSlide && !p.sliding) { p.sliding = true; SFX.slide(); dust(p.x, p.y); }
      if (!wantSlide) p.sliding = false;

      // horizontal
      let ax = 0;
      if (canAct && p.dashT <= 0) {
        if (S.keys[k.left]) ax -= 1;
        if (S.keys[k.right]) ax += 1;
      }
      if (p.dashT > 0) {
        p.dashT -= dt;
        p.vx = p.facing * DASH_SPD;
      } else if (p.sliding) {
        p.vx *= 1 - 3.2 * dt;
      } else {
        const iced = p.slick > 0 || S.iceT > 0;
        const friction = iced ? 2.2 : (p.onGround ? 9 : 3);
        const mv = (p.onGround ? MOVE : AIR_MOVE) * speedMul;
        if (ax !== 0) {
          p.vx += ax * mv * (iced ? 4 : 10) * dt;
          p.vx = Math.max(-mv, Math.min(mv, p.vx));
          p.facing = ax > 0 ? 1 : -1;
        } else {
          p.vx *= Math.max(0, 1 - friction * dt);
        }
      }

      // jump / double jump
      if (canAct && S.pressed[k.jump] && p.dashT <= 0 && !p.sliding) {
        if (p.onGround) {
          p.vy = -JUMP_V * jumpMul; p.onGround = false; p.jumps = 1;
          SFX.jump(); dust(p.x, p.y, 4);
        } else if (p.jumps < 2) {
          p.vy = -JUMP_V * 0.88 * jumpMul; p.jumps = 2;
          SFX.doubleJump();
          spark(p.x, p.y - 30, p.neon, 6, 160);
        }
      }

      // wind storm — constant push, fights the player's own control input
      if (S.windT > 0) p.vx += S.windDir * 620 * dt;

      // physics
      p.vy += GRAV * dt;
      if (p.vy > 1400) p.vy = 1400;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < ARENA_L + 16) { p.x = ARENA_L + 16; p.vx = Math.max(0, p.vx); }
      if (p.x > ARENA_R - 16) { p.x = ARENA_R - 16; p.vx = Math.min(0, p.vx); }

      if (p.y >= GY) {
        if (!p.onGround && p.vy > 500) dust(p.x, GY, 5);
        p.y = GY; p.vy = 0; p.onGround = true; p.jumps = 0;
      } else {
        p.onGround = false;
      }

      // solid blocking hazards act as walls/platforms
      S.hazards.forEach((h) => {
        if (h.state !== "blocking") return;
        const left = h.x - h.r, right = h.x + h.r, top = h.y - h.r * 2;
        // land on top
        if (p.vy >= 0 && p.x > left - 10 && p.x < right + 10 && p.y >= top && p.y <= top + 24 && (p.y - p.vy * dt) <= top + 6) {
          p.y = top; p.vy = 0; p.onGround = true; p.jumps = 0;
        } else if (p.y > top + 6 && p.y - 74 < h.y) {
          // side push
          if (p.x < h.x && p.x + 14 > left) { p.x = left - 14; p.vx = Math.min(0, p.vx); }
          else if (p.x > h.x && p.x - 14 < right) { p.x = right + 14; p.vx = Math.max(0, p.vx); }
        }
      });

      if (p.onGround && Math.abs(p.vx) > 40 && !p.sliding) p.runPhase += dt * (10 + Math.abs(p.vx) / 40);
      else p.runPhase *= 0.9;

      S.pressed[k.jump] = false; // consumed manually (allows same-frame double actions elsewhere)
    };

    // ---------------- hazard update ----------------
    const playerHurtbox = (p) => {
      const top = p.sliding ? p.y - 26 : p.y - 78;
      return { left: p.x - 14, right: p.x + 14, top, bottom: p.y };
    };
    const circleHitsBox = (hx, hy, hr, box) => {
      const cx = Math.max(box.left, Math.min(hx, box.right));
      const cy = Math.max(box.top, Math.min(hy, box.bottom));
      return (hx - cx) * (hx - cx) + (hy - cy) * (hy - cy) < hr * hr;
    };

    const landingHit = (h) => {
      // one-time impact check, fired the instant a hazard lands — after this
      // it becomes a harmless obstacle (or rolling prop) and can't hurt anyone
      const def = HAZ[h.type];
      S.players.forEach((p) => {
        if (p.dead) return;
        const box = playerHurtbox(p);
        if (circleHitsBox(h.x, h.y, h.r, box)) {
          if (def.mass === "heavy") crushKill(p); else applyDamage(p, def.dmg);
          p.vx += (p.x < h.x ? -1 : 1) * 160;
        }
      });
    };

    const updateHazard = (h, dt) => {
      const def = HAZ[h.type];
      h.life -= dt;
      h.rot += h.rotV * dt;

      if (h.state === "falling") {
        h.vy += (h.def_slowed ? GRAV * 0.5 : GRAV * 0.55) * dt;
        if (S.globalSlowT > 0) h.vy *= 1; // handled via dt scale globally instead
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        if (h.x < ARENA_L + h.r) { h.x = ARENA_L + h.r; h.vx *= -1; }
        if (h.x > ARENA_R - h.r) { h.x = ARENA_R - h.r; h.vx *= -1; }

        // telegraph warning ping once close to the ground
        if (!h.telegraphed && h.y > GY - 150) { h.telegraphed = true; SFX.warn(); }

        if (h.y >= GY - h.r) {
          h.y = GY - h.r;
          SFX.thud();
          if (def.explode) {
            explode(h.x, GY - 6, def.dmg + (def.shock || 0) * 0.3, def.shock || 70);
            if (def.shock) ring(h.x, GY - 6, "#ffd27a", def.shock);
            h.state = "dead"; h.grounded = true;
          } else if (def.bounce > 0 && h.bounces < def.bounce) {
            // still actively bouncing through the air — stays dangerous
            h.bounces++;
            h.vy = -Math.abs(h.vy) * (def.flies ? 0.85 : 0.45);
            if (def.flies && h.bounces === 1) h.vy -= 120;
            spark(h.x, GY - 6, def.col, 6, 160);
          } else if (def.blocks) {
            landingHit(h);
            h.state = "blocking"; h.blockT = def.blockT; h.grounded = true;
            spark(h.x, GY - 6, def.col, 10, 220);
          } else if (def.roll) {
            landingHit(h);
            h.state = "rolling"; h.grounded = true;
            h.vx = (h.x < CW / 2 ? 1 : -1) * (180 + Math.random() * 120) * (h.vx !== 0 ? Math.sign(h.vx) || 1 : 1);
            spark(h.x, GY - 6, def.col, 8, 200);
          } else if (def.breaks) {
            landingHit(h);
            h.grounded = true;
            SFX.shatter();
            spark(h.x, GY - 10, def.col, 14, 260);
            for (let i = 0; i < 3; i++) {
              S.particles.push({ x: h.x, y: GY - 10, vx: (Math.random() - 0.5) * 260, vy: -200 - Math.random() * 100, life: 0.5, max: 0.5, color: def.col, r: 3 + Math.random() * 2, grav: 0.9 });
            }
            if (def.slick) {
              S.hazards.push({ id: S.idc++, type: "__slick", x: h.x, y: GY - 2, r: 46, state: "slick", life: 4 });
            }
            h.state = "dead";
          } else {
            landingHit(h);
            h.grounded = true;
            dust(h.x, GY - 6, 6, def.col);
            h.state = "dead";
          }
        }
      } else if (h.state === "rolling") {
        h.vx *= (1 - 0.5 * dt);
        h.x += h.vx * dt;
        if (h.x < ARENA_L + h.r || h.x > ARENA_R - h.r) { h.vx *= -0.6; h.x = Math.max(ARENA_L + h.r, Math.min(ARENA_R - h.r, h.x)); }
        if (Math.abs(h.vx) < 20 || h.life < 0) h.state = "dead";
      } else if (h.state === "blocking") {
        h.blockT -= dt;
        if (h.blockT <= 0) { h.state = "dead"; spark(h.x, h.y - h.r, def.col, 8, 180); }
      } else if (h.state === "slick") {
        // handled purely as a floor zone, see collision below
        if (h.life < 0) h.state = "dead";
      }
    };

    const resolveHazardHit = (h, dt) => {
      const def = HAZ[h.type] || {};
      if (h.type === "__slick") {
        S.players.forEach((p) => {
          if (p.dead || !p.onGround) return;
          if (Math.abs(p.x - h.x) < h.r) p.slick = 0.15;
        });
        return;
      }
      // once a hazard has landed it's already dealt its one-time landing hit —
      // from then on it's just a harmless prop (rolling, sitting, or fading)
      if (h.state === "dead" || h.grounded) return;
      S.players.forEach((p) => {
        if (p.dead) return;
        if (h.hitCd[p.id] > 0) { h.hitCd[p.id] -= dt; return; }
        const box = playerHurtbox(p);
        if (circleHitsBox(h.x, h.y, h.r, box)) {
          if (def.mass === "heavy") crushKill(p); else applyDamage(p, def.dmg);
          p.vx += (p.x < h.x ? -1 : 1) * 160;
          h.hitCd[p.id] = 0.5;
        }
      });
    };

    // ---------------- power-up update ----------------
    const applyPup = (p, type) => {
      const def = PUPS[type];
      SFX.pickup(true);
      spark(p.x, p.y - 50, def.color, 14, 260);
      dmgText(p.x, p.y - 100, def.label, def.color, 15);
      switch (type) {
        case "heal": p.hp = Math.min(MAX_HP, p.hp + 32); break;
        case "shield": p.shieldT = def.dur; SFX.shield(); break;
        case "speed": p.speedT = def.dur; break;
        case "jump": p.jumpT = def.dur; break;
        case "dashcg": p.dashCd = 0; break;
        case "slowmo": S.globalSlowT = def.dur; setBanner("SLOW MOTION!", "#8fe0ff", 1); break;
        case "magnet": p.magnetT = def.dur; break;
        case "ghost": p.ghostT = def.dur; SFX.ghost(); break;
        case "lucky": p.lucky = true; break;
        default: break;
      }
    };

    const updatePup = (pu, dt) => {
      pu.life -= dt;
      pu.vy += 500 * dt;
      pu.vy = Math.min(pu.vy, 260);
      pu.x += pu.vx * dt;
      pu.y += pu.vy * dt;
      if (pu.y > GY - 16) { pu.y = GY - 16; pu.vy *= -0.3; }
      // magnet pull
      S.players.forEach((p) => {
        if (p.dead || p.magnetT <= 0) return;
        const d = Math.hypot(p.x - pu.x, (p.y - 40) - pu.y);
        if (d < 240) {
          const pull = 500 * dt;
          pu.x += ((p.x - pu.x) / (d || 1)) * pull;
          pu.y += ((p.y - 40 - pu.y) / (d || 1)) * pull;
        }
      });
      // pickup
      S.players.forEach((p) => {
        if (p.dead || pu.grabbed) return;
        if (Math.hypot(p.x - pu.x, (p.y - 40) - pu.y) < 30) {
          pu.grabbed = true;
          applyPup(p, pu.type);
        }
      });
      if (pu.life < 1.4 && !pu.grabbed) pu.blink = true;
    };

    // ---------------- backdrop ----------------
    const drawArena = () => {
      const acc = arena.card.acc, acc2 = arena.card.acc2;
      const g = ctx.createLinearGradient(0, 0, 0, CH);
      g.addColorStop(0, arena.card.top); g.addColorStop(1, arena.card.bot);
      ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);

      // ---- per-arena ambient theme (always present, not just during the event) ----
      if (arena.theme === "lightning") {
        // rolling storm clouds with occasional distant flicker
        for (let i = 0; i < 4; i++) {
          const cx = ((i * 260 + S.t * (6 + i * 3)) % (CW + 260)) - 130;
          const cy = 40 + i * 22;
          ctx.fillStyle = "rgba(70,50,120,0.22)";
          ctx.beginPath();
          ctx.ellipse(cx, cy, 100, 18, 0, 0, Math.PI * 2);
          ctx.ellipse(cx + 60, cy + 8, 70, 14, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        if (Math.sin(S.t * 0.7) > 0.96) {
          ctx.fillStyle = "rgba(200,180,255,0.08)";
          ctx.fillRect(0, 0, CW, GY);
        }
      } else if (arena.theme === "wind") {
        S.duststorm.forEach((d) => {
          d.x -= d.sp * 90 * (1 / 60);
          if (d.x < -10) { d.x = CW + 10; d.y = Math.random() * GY; }
          ctx.strokeStyle = "rgba(255,200,140,0.28)"; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 14, d.y); ctx.stroke();
        });
        // low sun haze
        ctx.save();
        ctx.shadowColor = "#ffcf9a"; ctx.shadowBlur = 40;
        ctx.fillStyle = "rgba(255,207,154,0.5)";
        ctx.beginPath(); ctx.arc(CW * 0.78, 60, 26, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (arena.theme === "ice") {
        S.snow.forEach((s2) => {
          s2.y += s2.sp * 40 * (1 / 60);
          s2.x += Math.sin(S.t + s2.ph) * 0.3;
          if (s2.y > GY) { s2.y = -6; s2.x = Math.random() * CW; }
          ctx.fillStyle = "rgba(230,245,255,0.7)";
          ctx.beginPath(); ctx.arc(s2.x, s2.y, 1.6, 0, Math.PI * 2); ctx.fill();
        });
        ctx.save();
        ctx.globalAlpha = 0.14;
        const grad = ctx.createLinearGradient(0, 30, 0, 140);
        grad.addColorStop(0, "rgba(140,255,220,0.9)"); grad.addColorStop(1, "rgba(140,255,220,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 30, CW, 110);
        ctx.restore();
      } else if (arena.theme === "blackout") {
        ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, CW, CH);
        S.searchlights.forEach((sl, i) => {
          const ang = 1.3 + Math.sin(S.t * 0.5 + sl.ph) * 0.9;
          ctx.save();
          ctx.globalAlpha = 0.08;
          ctx.translate(sl.x0, 0);
          ctx.rotate(ang - Math.PI / 2);
          const grad = ctx.createLinearGradient(0, 0, 0, 420);
          grad.addColorStop(0, i ? "#c9b8ff" : "#5ad8ff"); grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.lineTo(70, 420); ctx.lineTo(-70, 420); ctx.fill();
          ctx.restore();
        });
      } else if (arena.theme === "quake") {
        S.cracks.forEach((c) => {
          const pulse = 0.3 + 0.3 * Math.abs(Math.sin(S.t * 1.2 + c.ph));
          ctx.save();
          ctx.strokeStyle = `rgba(255,138,76,${pulse})`; ctx.lineWidth = 1.5;
          ctx.shadowColor = "#ff8a4c"; ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(c.x, GY - 60);
          ctx.lineTo(c.x + 10, GY - 30); ctx.lineTo(c.x - 6, GY - 12); ctx.lineTo(c.x + 4, GY);
          ctx.stroke();
          ctx.restore();
        });
      } else if (arena.theme === "meteor") {
        S.stars.forEach((st) => {
          const a = 0.3 + 0.6 * Math.abs(Math.sin(S.t * 1.3 + st.ph));
          ctx.fillStyle = `rgba(255,220,200,${a})`;
          ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
        });
        S.asteroids.forEach((a2) => {
          a2.x -= a2.sp * (1 / 60);
          if (a2.x < -20) a2.x = CW + 20;
          ctx.save();
          ctx.fillStyle = "#3a2a24";
          ctx.shadowColor = "#ff5c3c"; ctx.shadowBlur = 6;
          ctx.beginPath(); ctx.arc(a2.x, a2.y, a2.r, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        });
      }

      // moving light beams
      S.beams.forEach((b) => {
        const sway = Math.sin(S.t * 0.6 + b.ph) * 40;
        ctx.save();
        ctx.globalAlpha = 0.07;
        const grad = ctx.createLinearGradient(b.x + sway, 0, b.x + sway + 90, CH);
        grad.addColorStop(0, acc); grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(b.x + sway - 40, 0); ctx.lineTo(b.x + sway + 40, 0);
        ctx.lineTo(b.x + sway + 130, CH); ctx.lineTo(b.x + sway - 130, CH);
        ctx.fill();
        ctx.restore();
      });

      // floating ambient particles
      S.floatPs.forEach((f) => {
        f.y -= f.sp * 14 * (1 / 60);
        if (f.y < -10) { f.y = GY + 10; f.x = Math.random() * CW; }
        const a = 0.25 + 0.25 * Math.abs(Math.sin(S.t * 1.4 + f.ph));
        ctx.save();
        ctx.shadowColor = acc2; ctx.shadowBlur = 6;
        ctx.fillStyle = `rgba(255,255,255,${a * 0.4})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });

      // holographic decorations (rotating rings, floating)
      [[150, 150], [890, 130], [520, 90]].forEach(([hx, hy], i) => {
        ctx.save();
        ctx.translate(hx, hy + Math.sin(S.t * 1.2 + i) * 8);
        ctx.rotate(S.t * (0.4 + i * 0.15));
        ctx.strokeStyle = i % 2 ? acc2 : acc;
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = 2;
        ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.ellipse(0, 0, 26, 10, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, 0, 18, 26, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      });

      // digital billboards
      S.billboards.forEach((b) => {
        const flick = Math.sin(S.t * 2 + b.hue) > -0.6;
        ctx.save();
        ctx.globalAlpha = flick ? 0.85 : 0.4;
        ctx.shadowColor = b.hue % 2 ? acc2 : acc; ctx.shadowBlur = 10;
        ctx.strokeStyle = b.hue % 2 ? acc2 : acc; ctx.lineWidth = 1.5;
        ctx.strokeRect(b.x, 34, 220, 34);
        ctx.fillStyle = "rgba(10,10,20,0.4)";
        ctx.fillRect(b.x, 34, 220, 34);
        ctx.fillStyle = b.hue % 2 ? acc2 : acc;
        ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
        ctx.fillText(b.msg, b.x + 110, 55);
        ctx.restore();
      });

      // side neon border pillars
      [ARENA_L - 14, ARENA_R + 14].forEach((bx) => {
        ctx.save();
        ctx.shadowColor = acc; ctx.shadowBlur = 14;
        ctx.strokeStyle = acc; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, GY + 20); ctx.stroke();
        // marching LED dashes
        ctx.setLineDash([10, 14]);
        ctx.lineDashOffset = -S.t * 60;
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, GY + 20); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      });

      // glowing floor
      ctx.fillStyle = "#0a0a14";
      ctx.fillRect(ARENA_L - 14, GY, ARENA_R - ARENA_L + 28, CH - GY);
      ctx.save();
      ctx.shadowColor = acc; ctx.shadowBlur = 10;
      ctx.strokeStyle = acc; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ARENA_L - 14, GY); ctx.lineTo(ARENA_R + 14, GY); ctx.stroke();
      ctx.restore();
      // floor panels pulsing
      S.panels.forEach((pl, i) => {
        const pulse = 0.15 + 0.15 * Math.abs(Math.sin(S.t * 1.5 + pl.ph));
        ctx.fillStyle = i % 2 ? `${acc}` : `${acc2}`;
        ctx.globalAlpha = pulse;
        ctx.fillRect(pl.x, GY + 4, (ARENA_R - ARENA_L) / 12 - 3, 10);
        ctx.globalAlpha = 1;
      });

      // slick zones
      S.hazards.forEach((h) => {
        if (h.state !== "slick") return;
        const a = Math.min(1, h.life);
        ctx.save();
        ctx.globalAlpha = 0.25 * a;
        ctx.shadowColor = "#a9e6ff"; ctx.shadowBlur = 10;
        ctx.fillStyle = "#a9e6ff";
        ctx.beginPath(); ctx.ellipse(h.x, GY + 2, h.r, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
    };

    // ---------------- active event effects ----------------
    const drawEventFX = () => {
      // wind streaks
      if (S.windT > 0) {
        ctx.save();
        ctx.strokeStyle = EVENTS.wind.color; ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.globalAlpha = 0.3;
        for (let i = 0; i < 10; i++) {
          const y = 40 + i * 42 + Math.sin(S.t * 3 + i) * 6;
          const off = ((S.t * 500 * S.windDir + i * 90) % (CW + 200) + CW + 200) % (CW + 200) - 100;
          const x = S.windDir > 0 ? off : CW - off;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - S.windDir * 30, y); ctx.stroke();
        }
        ctx.restore();
      }
      // ice tint
      if (S.iceT > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.16, S.iceT * 0.05);
        ctx.fillStyle = "#a9e6ff";
        ctx.fillRect(ARENA_L - 14, GY - 6, ARENA_R - ARENA_L + 28, 16);
        ctx.restore();
      }
      // earthquake screen crack flash
      if (S.quakeT > 0) {
        ctx.save();
        ctx.globalAlpha = 0.08 + 0.06 * Math.abs(Math.sin(S.t * 14));
        ctx.fillStyle = "#ff8a4c";
        ctx.fillRect(0, 0, CW, CH);
        ctx.restore();
      }
      // meteor shower red alert vignette
      if (S.meteorT > 0) {
        ctx.save();
        const p2 = 0.1 + 0.06 * Math.abs(Math.sin(S.t * 5));
        const grad = ctx.createRadialGradient(CW / 2, CH / 2, CH * 0.35, CW / 2, CH / 2, CH * 0.75);
        grad.addColorStop(0, "rgba(255,60,40,0)"); grad.addColorStop(1, `rgba(255,60,40,${p2})`);
        ctx.fillStyle = grad; ctx.fillRect(0, 0, CW, CH);
        ctx.restore();
      }
      // lightning telegraph + strike
      S.lightningZones.forEach((z) => {
        if (!z.struck) {
          const pulse = 0.25 + 0.35 * Math.abs(Math.sin(S.t * (10 - z.telegraphT * 5)));
          ctx.save();
          ctx.globalAlpha = pulse;
          ctx.fillStyle = EVENTS.lightning.color;
          ctx.fillRect(z.x - z.w / 2, 0, z.w, GY);
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.globalAlpha = pulse * 0.8;
          ctx.strokeRect(z.x - z.w / 2, 0, z.w, GY);
          ctx.restore();
        } else if (z.strikeT > 0) {
          const a = Math.min(1, z.strikeT / 0.35);
          ctx.save();
          ctx.globalAlpha = a;
          ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 22;
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 5;
          ctx.beginPath();
          let bx = z.x, by = 0;
          ctx.moveTo(bx, by);
          while (by < GY) {
            by += 26 + Math.random() * 20;
            bx += (Math.random() - 0.5) * 30;
            ctx.lineTo(bx, Math.min(by, GY));
          }
          ctx.stroke();
          ctx.strokeStyle = EVENTS.lightning.color; ctx.lineWidth = 10; ctx.globalAlpha = a * 0.35;
          ctx.stroke();
          ctx.restore();
        }
      });
    };


    const drawHazard = (h) => {
      const def = HAZ[h.type];
      if (!def) return;
      // telegraph shadow while falling
      if (h.state === "falling" && h.telegraphed) {
        const remain = Math.max(0, (GY - h.r - h.y) / 900);
        const a = Math.max(0.15, 1 - remain * 2.4);
        ctx.save();
        ctx.globalAlpha = a * 0.5;
        ctx.strokeStyle = def.dmg >= 28 ? "#ff4f4f" : "#ffe45c";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(h.x, GY, h.r * (0.7 + a * 0.5), 8, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      if (h.state === "dead") return;
      // fiery comet trail for meteors
      if (h.type === "meteor" && h.state === "falling") {
        ctx.save();
        ctx.strokeStyle = "#ff8a4c"; ctx.lineWidth = h.r * 0.7; ctx.lineCap = "round";
        ctx.globalAlpha = 0.5;
        ctx.shadowColor = "#ff5c3c"; ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(h.x - h.vx * 0.05, h.y - h.vy * 0.05);
        ctx.lineTo(h.x, h.y);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      ctx.shadowColor = def.col; ctx.shadowBlur = 10;
      switch (h.type) {
        case "crate":
          ctx.fillStyle = def.col; ctx.fillRect(-h.r, -h.r, h.r * 2, h.r * 2);
          ctx.strokeStyle = "#7a5a2c"; ctx.lineWidth = 2; ctx.strokeRect(-h.r, -h.r, h.r * 2, h.r * 2);
          ctx.beginPath(); ctx.moveTo(-h.r, -h.r); ctx.lineTo(h.r, h.r); ctx.moveTo(h.r, -h.r); ctx.lineTo(-h.r, h.r); ctx.stroke();
          break;
        case "ball":
          ctx.fillStyle = def.col; ctx.beginPath(); ctx.arc(0, 0, h.r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#0a0a14";
          ctx.beginPath(); ctx.arc(-5, -4, 2.4, 0, Math.PI * 2); ctx.arc(5, -4, 2.4, 0, Math.PI * 2); ctx.arc(0, 5, 2.4, 0, Math.PI * 2); ctx.fill();
          break;
        case "anvil":
          ctx.fillStyle = def.col;
          ctx.beginPath();
          ctx.moveTo(-h.r, h.r * 0.6); ctx.lineTo(-h.r * 0.5, -h.r * 0.6); ctx.lineTo(h.r * 0.5, -h.r * 0.6); ctx.lineTo(h.r, h.r * 0.6);
          ctx.lineTo(h.r * 1.2, h.r); ctx.lineTo(-h.r * 1.2, h.r); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = "#2a2f38"; ctx.lineWidth = 1.5; ctx.stroke();
          break;
        case "barrel":
          ctx.fillStyle = def.col; ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(-h.r * 0.8, -h.r, h.r * 1.6, h.r * 2, 6); else ctx.rect(-h.r * 0.8, -h.r, h.r * 1.6, h.r * 2);
          ctx.fill();
          ctx.strokeStyle = "#5a3a1a"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-h.r * 0.8, -h.r * 0.4); ctx.lineTo(h.r * 0.8, -h.r * 0.4);
          ctx.moveTo(-h.r * 0.8, h.r * 0.4); ctx.lineTo(h.r * 0.8, h.r * 0.4); ctx.stroke();
          break;
        case "bomb":
          ctx.fillStyle = def.col; ctx.beginPath(); ctx.arc(0, 2, h.r, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#8a3a1a"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(4, -h.r); ctx.quadraticCurveTo(h.r, -h.r * 1.6, h.r * 1.3, -h.r * 1.8); ctx.stroke();
          ctx.save();
          ctx.shadowColor = "#ffb347"; ctx.shadowBlur = 8;
          ctx.fillStyle = Math.sin(S.t * 20) > 0 ? "#ffb347" : "#ff5c1a";
          ctx.beginPath(); ctx.arc(h.r * 1.3, -h.r * 1.8, 3, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          break;
        case "ice":
          ctx.globalAlpha = 0.75; ctx.fillStyle = def.col;
          ctx.beginPath(); ctx.moveTo(0, -h.r); ctx.lineTo(h.r, 0); ctx.lineTo(0, h.r); ctx.lineTo(-h.r, 0); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.9;
          ctx.beginPath(); ctx.moveTo(0, -h.r * 0.5); ctx.lineTo(0, h.r * 0.5); ctx.moveTo(-h.r * 0.5, 0); ctx.lineTo(h.r * 0.5, 0); ctx.stroke();
          break;
        case "concrete":
          ctx.fillStyle = def.col; ctx.fillRect(-h.r, -h.r, h.r * 2, h.r * 2);
          ctx.strokeStyle = "#4a4f58"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-h.r * 0.5, -h.r); ctx.lineTo(-h.r * 0.2, h.r * 0.2); ctx.lineTo(h.r * 0.4, h.r);
          ctx.moveTo(h.r * 0.6, -h.r); ctx.lineTo(h.r * 0.1, -h.r * 0.1); ctx.stroke();
          break;
        case "spiked":
          ctx.fillStyle = def.col; ctx.beginPath(); ctx.arc(0, 0, h.r * 0.65, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = def.col; ctx.lineWidth = 3;
          for (let sp = 0; sp < 8; sp++) {
            const a2 = (sp / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a2) * h.r * 0.6, Math.sin(a2) * h.r * 0.6);
            ctx.lineTo(Math.cos(a2) * h.r * 1.3, Math.sin(a2) * h.r * 1.3);
            ctx.stroke();
          }
          break;
        case "neon":
          ctx.globalAlpha = 0.85; ctx.fillStyle = "#0a0a14";
          ctx.fillRect(-h.r, -h.r, h.r * 2, h.r * 2);
          ctx.strokeStyle = def.col; ctx.lineWidth = 2.5; ctx.globalAlpha = 1;
          ctx.strokeRect(-h.r, -h.r, h.r * 2, h.r * 2);
          ctx.strokeRect(-h.r * 0.5, -h.r * 0.5, h.r, h.r);
          break;
        case "hammer":
          ctx.strokeStyle = "#c9a05a"; ctx.lineWidth = 5; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(0, -h.r * 0.2); ctx.lineTo(0, h.r * 1.3); ctx.stroke();
          ctx.fillStyle = def.col;
          ctx.fillRect(-h.r, -h.r, h.r * 2, h.r * 0.9);
          ctx.strokeStyle = "#4a4f58"; ctx.lineWidth = 1.5; ctx.strokeRect(-h.r, -h.r, h.r * 2, h.r * 0.9);
          break;
        case "meteor":
          ctx.fillStyle = def.col; ctx.beginPath(); ctx.arc(0, 0, h.r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#ffd27a"; ctx.globalAlpha = 0.7;
          ctx.beginPath(); ctx.arc(-h.r * 0.25, -h.r * 0.25, h.r * 0.4, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          break;
        default: break;
      }
      ctx.restore();

      // blocking hazard timer ring
      if (h.state === "blocking") {
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(h.x, h.y - h.r * 2 - 8, 6, -Math.PI / 2, -Math.PI / 2 + (h.blockT / def.blockT) * Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    };

    const drawPup = (pu) => {
      const def = PUPS[pu.type];
      const blink = pu.blink && Math.sin(S.t * 12) < 0;
      if (blink) return;
      ctx.save();
      ctx.translate(pu.x, pu.y + Math.sin(S.t * 3 + pu.ph) * 4);
      ctx.shadowColor = def.color; ctx.shadowBlur = 16;
      ctx.fillStyle = def.color; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
      ctx.font = "13px monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#0a0a14";
      ctx.shadowBlur = 0;
      ctx.fillText(def.icon, 0, 5);
      ctx.restore();
    };

    // ---------------- player drawing ----------------
    const drawPlayer = (p) => {
      if (p.dead) {
        const k2 = Math.min(1, p.deathT * 1.8);
        if (k2 >= 1) return;
        ctx.save();
        ctx.globalAlpha = 1 - k2;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.facing * 1.4 * k2);
        ctx.translate(-p.x, -p.y - k2 * 20);
        drawStick(p, true);
        ctx.restore();
        return;
      }
      drawStick(p, false);
    };
    const drawStick = (p, ghosted) => {
      ctx.save();
      if (p.hurtFlash > 0) ctx.globalAlpha = 0.5 + 0.5 * Math.sin(S.t * 50);
      if (p.ghostT > 0) ctx.globalAlpha = Math.min(ctx.globalAlpha ?? 1, 0.45);
      if (p.iframe > 0 && p.dashT <= 0) ctx.globalAlpha = 0.6 + 0.4 * Math.sin(S.t * 40);

      const hip = p.y - 34, neck = p.y - 64, hy = p.y - 76;
      const f = p.facing;
      ctx.strokeStyle = "#f4f7fb"; ctx.lineWidth = 5; ctx.lineCap = "round";

      if (p.sliding) {
        ctx.beginPath();
        ctx.moveTo(p.x - 16 * f, p.y - 8); ctx.lineTo(p.x + 10 * f, p.y - 14);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x + 10 * f, p.y - 14); ctx.lineTo(p.x + 22 * f, p.y - 4);
        ctx.moveTo(p.x - 16 * f, p.y - 8); ctx.lineTo(p.x - 26 * f, p.y - 2);
        ctx.stroke();
        ctx.save();
        ctx.shadowColor = p.neon; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(p.x + 18 * f, p.y - 22, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = p.neon; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x + 18 * f, p.y - 22, 10, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath();
        if (!p.onGround) {
          ctx.moveTo(p.x, hip); ctx.lineTo(p.x - 9 * f, p.y - 10);
          ctx.moveTo(p.x, hip); ctx.lineTo(p.x + 12 * f, p.y - 6);
        } else {
          const lp = Math.sin(p.runPhase) * (Math.abs(p.vx) > 40 ? 15 : 0);
          ctx.moveTo(p.x, hip); ctx.lineTo(p.x - 8 + lp * 0.7 * f, p.y);
          ctx.moveTo(p.x, hip); ctx.lineTo(p.x + 8 - lp * 0.7 * f, p.y);
        }
        ctx.stroke();
        const lean = Math.max(-0.35, Math.min(0.35, p.vx / 500));
        const nx = p.x + lean * 14;
        ctx.beginPath(); ctx.moveTo(p.x, hip); ctx.lineTo(nx, neck); ctx.stroke();
        const ap = Math.sin(p.runPhase + Math.PI) * 10;
        ctx.beginPath();
        ctx.moveTo(nx, neck + 4); ctx.lineTo(nx + (7 + ap * 0.4) * f, neck + 16);
        ctx.moveTo(nx, neck + 4); ctx.lineTo(nx - (7 - ap * 0.4) * f, neck + 16);
        ctx.stroke();
        ctx.save();
        ctx.shadowColor = p.neon; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(nx, hy + 2, 11, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = p.neon; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(nx, hy + 2, 11, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        ctx.restore();
      }

      // shield bubble
      if (p.shieldT > 0) {
        ctx.save();
        ctx.shadowColor = "#5ad8ff"; ctx.shadowBlur = 14;
        ctx.strokeStyle = "#5ad8ff"; ctx.globalAlpha = 0.6 + 0.2 * Math.sin(S.t * 8);
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(p.x, p.y - 42, 36, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      // dash trail
      if (p.dashT > 0) {
        ctx.save();
        ctx.shadowColor = p.neon; ctx.shadowBlur = 8;
        ctx.strokeStyle = p.neon; ctx.lineWidth = 4;
        for (let i2 = 1; i2 <= 3; i2++) {
          ctx.globalAlpha = 0.3 / i2;
          ctx.beginPath();
          ctx.moveTo(p.x - f * i2 * 16, hip); ctx.lineTo(p.x - f * i2 * 16, neck);
          ctx.stroke();
        }
        ctx.restore();
      }
      // lucky clover glow
      if (p.lucky) {
        ctx.save();
        ctx.shadowColor = "#5dff8a"; ctx.shadowBlur = 8;
        ctx.fillStyle = "#5dff8a"; ctx.font = "11px monospace"; ctx.textAlign = "center";
        ctx.fillText("🍀", p.x, p.y - 100);
        ctx.restore();
      }
      ctx.restore();
    };

    // ---------------- HUD ----------------
    const pupIconRow = (p, x, y, right) => {
      const active = [];
      if (p.shieldT > 0) active.push(PUPS.shield);
      if (p.speedT > 0) active.push(PUPS.speed);
      if (p.jumpT > 0) active.push(PUPS.jump);
      if (p.magnetT > 0) active.push(PUPS.magnet);
      if (p.ghostT > 0) active.push(PUPS.ghost);
      if (p.lucky) active.push(PUPS.lucky);
      active.forEach((d, i) => {
        const ix = right ? x - i * 22 : x + i * 22;
        ctx.save();
        ctx.shadowColor = d.color; ctx.shadowBlur = 6;
        ctx.fillStyle = d.color; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.arc(ix, y, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#0a0a14"; ctx.font = "9px monospace"; ctx.textAlign = "center"; ctx.globalAlpha = 1;
        ctx.fillText(d.icon, ix, y + 3);
        ctx.restore();
      });
    };

    const drawHUD = () => {
      const bw = 340;
      const bar = (x, p, flip) => {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(x, 16, bw, 18);
        const w = (p.hp / MAX_HP) * (bw - 4);
        ctx.save();
        ctx.shadowColor = p.hp < 30 ? "#ff5d5d" : p.neon; ctx.shadowBlur = 10;
        ctx.fillStyle = p.hp < 30 ? "#ff5d5d" : p.neon;
        ctx.fillRect(flip ? x + 2 + (bw - 4 - w) : x + 2, 18, w, 14);
        ctx.restore();
        ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.5;
        ctx.strokeRect(x, 16, bw, 18);
      };
      bar(20, S.players[0], false);
      bar(CW - 20 - bw, S.players[1], true);
      ctx.fillStyle = "#fff"; ctx.font = "bold 11px monospace";
      ctx.textAlign = "left"; ctx.fillText("P1", 20, 47);
      ctx.textAlign = "right"; ctx.fillText("P2", CW - 20, 47);
      pupIconRow(S.players[0], 20, 68, false);
      pupIconRow(S.players[1], CW - 20, 68, true);

      // round pips
      ctx.textAlign = "center";
      for (let s2 = 0; s2 < 2; s2++) {
        for (let i2 = 0; i2 < target; i2++) {
          const x = CW / 2 + (s2 === 0 ? -1 : 1) * (26 + i2 * 18);
          ctx.save();
          if (i2 < S.wins[s2]) { ctx.shadowColor = S.players[s2].neon; ctx.shadowBlur = 8; }
          ctx.beginPath(); ctx.arc(x, 24, 5, 0, Math.PI * 2);
          ctx.fillStyle = i2 < S.wins[s2] ? S.players[s2].neon : "rgba(255,255,255,0.18)";
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.fillStyle = "#fff"; ctx.font = "bold 10px monospace";
      ctx.fillText(`ROUND ${S.round}`, CW / 2, 45);

      // intensity meter
      const k = diffK();
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(CW / 2 - 60, 54, 120, 10);
      ctx.save();
      ctx.shadowColor = k > 0.7 ? "#ff4f4f" : "#ffe45c"; ctx.shadowBlur = 8;
      ctx.fillStyle = k > 0.7 ? "#ff4f4f" : "#ffe45c";
      ctx.fillRect(CW / 2 - 58, 56, 116 * k, 6);
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "8px monospace";
      ctx.fillText("STORM INTENSITY", CW / 2, 76);

      // arena event indicator — countdown to the next one, or its name while active
      {
        const ed = EVENTS[arena.event];
        if (S.eventActive) {
          const flash = Math.sin(S.t * 10) > 0;
          ctx.save();
          ctx.shadowColor = ed.color; ctx.shadowBlur = flash ? 14 : 6;
          ctx.fillStyle = ed.color; ctx.font = "bold 12px monospace";
          ctx.fillText(`${ed.icon} ${ed.label}!`, CW / 2, 92);
          ctx.restore();
        } else {
          const secs = Math.max(0, Math.ceil(S.eventCd));
          const soon = secs <= 3;
          ctx.save();
          if (soon) { ctx.shadowColor = ed.color; ctx.shadowBlur = 8; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(S.t * 10); }
          ctx.fillStyle = soon ? ed.color : "rgba(255,255,255,0.45)";
          ctx.font = "9px monospace";
          ctx.fillText(`${ed.icon} next ${ed.label.toLowerCase()} in ${secs}s`, CW / 2, 90);
          ctx.restore();
        }
      }

      if (S.mode === "countdown") {
        const n = Math.ceil(3 - S.modeT);
        ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(0, 0, CW, CH);
        ctx.save();
        ctx.shadowColor = "#fff"; ctx.shadowBlur = 22;
        ctx.fillStyle = "#fff"; ctx.font = "bold 90px monospace"; ctx.textAlign = "center";
        ctx.fillText(n > 0 ? n : "SURVIVE!", CW / 2, CH / 2);
        ctx.restore();
        ctx.font = "14px monospace"; ctx.fillStyle = "#fff";
        ctx.fillText(`ROUND ${S.round} · ${arena.name}`, CW / 2, CH / 2 + 40);
      }
      if (S.bannerT > 0) {
        ctx.save();
        ctx.shadowColor = S.bannerCol; ctx.shadowBlur = 16;
        ctx.fillStyle = S.bannerCol; ctx.font = "bold 28px monospace"; ctx.textAlign = "center";
        ctx.fillText(S.banner, CW / 2, 130);
        ctx.restore();
      }
      if (S.globalSlowT > 0) {
        ctx.save();
        ctx.fillStyle = "rgba(143,224,255,0.08)";
        ctx.fillRect(0, 0, CW, CH);
        ctx.restore();
      }
      if (S.mode === "roundEnd") {
        ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, CW, CH);
        if (S.roundWinner >= 0) {
          const wp = S.players[S.roundWinner];
          ctx.save();
          ctx.shadowColor = wp.neon; ctx.shadowBlur = 24;
          ctx.fillStyle = wp.neon; ctx.font = "bold 42px monospace"; ctx.textAlign = "center";
          ctx.fillText(`P${S.roundWinner + 1} SURVIVES ROUND ${S.round}`, CW / 2, CH / 2 - 10);
          ctx.restore();
        } else {
          ctx.fillStyle = "#fff"; ctx.font = "bold 36px monospace"; ctx.textAlign = "center";
          ctx.fillText("DOUBLE KO — REPLAY ROUND", CW / 2, CH / 2 - 10);
        }
        ctx.fillStyle = "#fff"; ctx.font = "16px monospace";
        ctx.fillText(`${S.wins[0]} — ${S.wins[1]}`, CW / 2, CH / 2 + 26);
      }
      if (S.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${S.flash * 3})`;
        ctx.fillRect(0, 0, CW, CH);
      }
    };

    // ---------------- victory sequence ----------------
    const drawVictory = () => {
      ctx.fillStyle = "rgba(5,5,12,0.6)"; ctx.fillRect(0, 0, CW, CH);
      const wp = S.players[S.roundWinner >= 0 ? S.roundWinner : 0];
      S.fireworks.forEach((fw) => {
        fw.life -= 1 / 60;
        fw.parts.forEach((pt) => {
          pt.x += pt.vx / 60; pt.y += pt.vy / 60; pt.vy += 300 / 60;
        });
      });
      S.fireworks = S.fireworks.filter((fw) => fw.life > 0);
      if (Math.random() < 0.06) {
        const fx = 120 + Math.random() * (CW - 240), fy = 100 + Math.random() * 140;
        const col = [wp.neon, "#ffe97a", "#5dff8a", "#5ad8ff"][Math.floor(Math.random() * 4)];
        const parts = Array.from({ length: 22 }, () => {
          const a = Math.random() * Math.PI * 2, v = 100 + Math.random() * 140;
          return { x: fx, y: fy, vx: Math.cos(a) * v, vy: Math.sin(a) * v };
        });
        S.fireworks.push({ parts, life: 1, col });
        SFX.firework();
      }
      S.fireworks.forEach((fw) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, fw.life);
        ctx.shadowColor = fw.col; ctx.shadowBlur = 8;
        ctx.fillStyle = fw.col;
        fw.parts.forEach((pt) => { ctx.beginPath(); ctx.arc(pt.x, pt.y, 2.4, 0, Math.PI * 2); ctx.fill(); });
        ctx.restore();
      });
      ctx.save();
      ctx.shadowColor = wp.neon; ctx.shadowBlur = 30;
      ctx.fillStyle = wp.neon; ctx.font = "bold 46px monospace"; ctx.textAlign = "center";
      ctx.fillText(`🏆 PLAYER ${wp.id + 1} CHAMPION 🏆`, CW / 2, CH / 2);
      ctx.restore();
      ctx.fillStyle = "#fff"; ctx.font = "16px monospace";
      ctx.fillText(`${S.wins[0]} — ${S.wins[1]}`, CW / 2, CH / 2 + 34);
    };

    // ---------------- main loop ----------------
    let raf, last = performance.now();
    const loop = (now) => {
      let dt = Math.min((now - last) / 1000, 0.033);
      last = now;
      if (S.globalSlowT > 0) { S.globalSlowT -= dt; }
      const hazardDt = S.globalSlowT > 0 ? dt * 0.35 : dt;
      S.t += dt;
      if (S.bannerT > 0) S.bannerT -= dt;
      if (S.flash > 0) S.flash -= dt;
      if (S.shake > 0) S.shake -= dt;

      if (S.mode === "countdown") {
        S.modeT += dt;
        const n = Math.ceil(3 - S.modeT);
        if (n !== S.lastBeep && n >= 0) { S.lastBeep = n; SFX.beep(n === 0); }
        if (S.modeT >= 3) { S.mode = "survive"; S.modeT = 0; }
      } else if (S.mode === "survive") {
        S.roundT += dt;
        // spawn hazards
        S.spawnT -= dt;
        if (S.spawnT <= 0) {
          const n = batchCount();
          for (let i2 = 0; i2 < n; i2++) spawnHazard();
          S.spawnT = spawnInterval();
        }
        S.pupT -= dt;
        if (S.pupT <= 0) { spawnPup(); S.pupT = 5 + Math.random() * 4; }

        updateEvents(dt);

        S.players.forEach((p) => updatePlayer(p, dt));
        S.hazards.forEach((h) => updateHazard(h, hazardDt));
        S.hazards.forEach((h) => resolveHazardHit(h, dt));
        S.hazards = S.hazards.filter((h) => h.state !== "dead" && h.life > -1);
        S.pups.forEach((pu) => updatePup(pu, dt));
        S.pups = S.pups.filter((pu) => !pu.grabbed && pu.life > 0);

        const d0 = S.players[0].dead, d1 = S.players[1].dead;
        if (d0 || d1) {
          if (d0 && d1) S.roundWinner = -1;
          else S.roundWinner = d0 ? 1 : 0;
          if (S.roundWinner >= 0) {
            S.wins[S.roundWinner]++;
            setScore([...S.wins]);
            SFX.win();
            setBanner(`P${S.roundWinner + 1} WINS THE ROUND!`, S.players[S.roundWinner].neon, 1.2);
          }
          S.mode = "roundEnd"; S.modeT = 0;
        }
      } else if (S.mode === "roundEnd") {
        S.modeT += dt;
        if (S.modeT >= 2.4) {
          if (S.wins[0] >= target || S.wins[1] >= target) {
            if (!S.done) {
              S.done = true;
              const winner = S.wins[0] >= target ? 1 : 2;
              SFX.fanfare();
              S.mode = "victory"; S.modeT = 0;
              setTimeout(() => {
                setMatchWinner(winner);
                setPhase("matchEnd");
              }, 2600);
            }
          } else {
            S.round++;
            resetRound();
          }
        }
      }
      // victory mode keeps rendering underlying scene + overlay; no state transitions needed here

      // decay fx
      S.particles = S.particles.filter((pt) => {
        pt.life -= dt;
        pt.vy += (pt.grav === undefined ? 1 : pt.grav) * 900 * dt;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        return pt.life > 0;
      });
      S.rings = S.rings.filter((r) => { r.life -= dt; r.r += (r.max - r.r) * 10 * dt; return r.life > 0; });
      S.texts = S.texts.filter((tx) => { tx.life -= dt; tx.y += tx.vy * dt; tx.vy *= 0.94; return tx.life > 0; });

      // ---- render ----
      ctx.save();
      if (S.shake > 0) ctx.translate((Math.random() - 0.5) * S.shake * 24, (Math.random() - 0.5) * S.shake * 24);
      drawArena();
      if (S.blackoutT > 0) {
        // arena goes dark — only glowing neon outlines remain visible from here on
        ctx.fillStyle = "rgba(2,2,6,0.93)";
        ctx.fillRect(0, 0, CW, CH);
      }
      S.rings.forEach((r) => {
        ctx.save();
        ctx.shadowColor = r.color; ctx.shadowBlur = 16;
        ctx.strokeStyle = r.color; ctx.globalAlpha = r.life / r.t; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      });
      S.hazards.forEach(drawHazard);
      S.pups.forEach(drawPup);
      S.players.forEach(drawPlayer);
      S.particles.forEach((pt) => {
        ctx.save();
        if (pt.glow) { ctx.shadowColor = pt.color; ctx.shadowBlur = 10; }
        ctx.globalAlpha = Math.max(0, pt.life / pt.max);
        ctx.fillStyle = pt.color;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      S.texts.forEach((tx) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, tx.life / tx.max);
        ctx.shadowColor = tx.color; ctx.shadowBlur = 8;
        ctx.fillStyle = tx.color; ctx.font = `bold ${tx.size}px monospace`; ctx.textAlign = "center";
        ctx.fillText(tx.str, tx.x, tx.y);
        ctx.restore();
      });
      drawEventFX();
      ctx.restore();
      drawHUD();
      if (S.mode === "victory") drawVictory();

      S.pressed = {};
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [phase]);

  // ================= UI =================
  const wrap = {
    minHeight: "100vh", background: "#07090f", color: "#e8eef5",
    display: "flex", flexDirection: "column", alignItems: "center",
    fontFamily: "monospace", padding: 16, boxSizing: "border-box",
  };
  const neonText = (color) => ({ color, textShadow: `0 0 12px ${color}` });

  const press = (code, d) => (e) => {
    e.preventDefault();
    if (stateRef.current.setKey) stateRef.current.setKey(code, d);
  };
  const TouchBtn = ({ label, code, color, style, size = 54 }) => (
    <div
      onTouchStart={press(code, true)}
      onTouchEnd={press(code, false)}
      onTouchCancel={press(code, false)}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "absolute", width: size, height: size, borderRadius: "50%",
        border: `2px solid ${color}`, background: "rgba(10,14,24,0.5)",
        color: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, fontWeight: "bold", userSelect: "none", WebkitUserSelect: "none",
        touchAction: "none", boxShadow: `0 0 12px ${color}66`, zIndex: 5, ...style,
      }}
    >{label}</div>
  );

  // tiny falling hazard used to animate the arena-select cards — objects
  // dropping from above, echoing the actual in-game storm
  const MiniFaller = ({ color, round, style }) => (
    <div style={{
      position: "absolute", width: 7, height: 7,
      background: color, borderRadius: round ? "50%" : 2,
      boxShadow: `0 0 5px ${color}`, ...style,
    }} />
  );

  // tiny running stickman used to animate the arena-select cards — same
  // blue/red as the in-game players, scurrying along each arena's neon line
  const MiniRunner = ({ color, style }) => (
    <div style={{ position: "absolute", width: 12, height: 20, ...style }}>
      <svg width="12" height="20" viewBox="0 0 12 20" style={{ display: "block", filter: `drop-shadow(0 0 3px ${color})` }}>
        <circle cx="6" cy="3.2" r="2.6" fill="none" stroke={color} strokeWidth="1.6" />
        <line x1="6" y1="5.8" x2="6" y2="12" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        <line x1="6" y1="7.6" x2="2" y2="10" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        <line x1="6" y1="7.6" x2="10" y2="5.8" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        <line x1="6" y1="12" x2="2" y2="18.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        <line x1="6" y1="12" x2="10" y2="17" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );

  if (phase === "menu" || phase === "matchEnd") {
    return (
      <div style={wrap}>
        <style>{`
          @keyframes dodgePatrolFwd {
            0%   { transform: translate(0px, 0px); }
            10%  { transform: translate(16px, -3px); }
            22%  { transform: translate(34px, 0px); }
            34%  { transform: translate(50px, -4px); }
            44%  { transform: translate(64px, 0px); }
            50%  { transform: translate(66px, -7px); }
            56%  { transform: translate(64px, 0px); }
            68%  { transform: translate(48px, -3px); }
            80%  { transform: translate(30px, 0px); }
            90%  { transform: translate(12px, -3px); }
            96%  { transform: translate(0px, -6px); }
            100% { transform: translate(0px, 0px); }
          }
          @keyframes dodgePatrolRev {
            0%   { transform: translate(0px, 0px) scaleX(-1); }
            10%  { transform: translate(-16px, -3px) scaleX(-1); }
            22%  { transform: translate(-34px, 0px) scaleX(-1); }
            34%  { transform: translate(-50px, -4px) scaleX(-1); }
            44%  { transform: translate(-64px, 0px) scaleX(-1); }
            50%  { transform: translate(-66px, -7px) scaleX(-1); }
            56%  { transform: translate(-64px, 0px) scaleX(-1); }
            68%  { transform: translate(-48px, -3px) scaleX(-1); }
            80%  { transform: translate(-30px, 0px) scaleX(-1); }
            90%  { transform: translate(-12px, -3px) scaleX(-1); }
            96%  { transform: translate(0px, -6px) scaleX(-1); }
            100% { transform: translate(0px, 0px) scaleX(-1); }
          }
          @keyframes fallDrop {
            0%   { transform: translateY(-10px) rotate(0deg); opacity: 0; }
            8%   { opacity: 1; }
            80%  { opacity: 1; }
            100% { transform: translateY(66px) rotate(180deg); opacity: 0; }
          }
        `}</style>
        <h1 style={{ letterSpacing: 5, margin: "26px 0 2px", fontSize: 34 }}>
          <span style={neonText("#3aa0ff")}>STICKMAN</span>{" "}
          <span style={{ opacity: 0.9 }}>🎯</span>{" "}
          <span style={neonText("#ff3b4d")}>DODGEBALL</span>
        </h1>
        <p style={{ opacity: 0.65, marginTop: 4 }}>survive the falling-hazard storm · last one standing wins</p>

        {phase === "matchEnd" && (
          <div style={{
            margin: "8px 0 16px", padding: "16px 40px", borderRadius: 10,
            background: matchWinner === 1 ? "rgba(58,160,255,0.12)" : "rgba(255,59,77,0.12)",
            border: `2px solid ${matchWinner === 1 ? "#3aa0ff" : "#ff3b4d"}`,
            boxShadow: `0 0 26px ${matchWinner === 1 ? "rgba(58,160,255,0.4)" : "rgba(255,59,77,0.4)"}`,
            fontSize: 24, fontWeight: "bold", textAlign: "center",
          }}>
            🏆 PLAYER {matchWinner} IS THE CHAMPION — {score[0]}–{score[1]}
          </div>
        )}

        <p style={{ marginBottom: 8, opacity: 0.85 }}>Match length:</p>
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          {[["quick", "Quick Match", "1 round"], ["bo3", "Best of 3", "first to 2"], ["bo5", "Best of 5", "first to 3"]].map(([id, label, sub]) => (
            <button key={id} onClick={() => setMode(id)}
              style={{
                cursor: "pointer", padding: "10px 18px", borderRadius: 8, fontFamily: "monospace",
                border: `2px solid ${mode === id ? "#5ad8ff" : "rgba(255,255,255,0.2)"}`,
                background: mode === id ? "rgba(90,216,255,0.12)" : "#10141d",
                color: "#e8eef5", boxShadow: mode === id ? "0 0 14px rgba(90,216,255,0.4)" : "none",
              }}>
              <div style={{ fontWeight: "bold", fontSize: 13 }}>{label}</div>
              <div style={{ fontSize: 10, opacity: 0.6 }}>{sub}</div>
            </button>
          ))}
        </div>

        <p style={{ marginBottom: 8, opacity: 0.85 }}>Choose your arena:</p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          {ARENAS.map((a, i) => (
            <button key={a.name} onClick={() => setArenaIdx(i)}
              style={{
                cursor: "pointer", width: 200, padding: 0, borderRadius: 10, overflow: "hidden",
                border: `2px solid ${arenaIdx === i ? a.card.acc : "rgba(255,255,255,0.18)"}`,
                background: "#10141d", color: "#e8eef5", fontFamily: "monospace",
                boxShadow: arenaIdx === i ? `0 0 18px ${a.card.acc}66` : "none",
                transition: "transform .15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}>
              <div style={{ height: 76, background: `linear-gradient(${a.card.top}, ${a.card.bot})`, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", bottom: 10, left: 12, right: 12, height: 4, background: a.card.acc, borderRadius: 2, boxShadow: `0 0 10px ${a.card.acc}` }} />
                <div style={{ position: "absolute", top: 10, left: 12, width: 30, height: 20, border: `1.5px solid ${a.card.acc2}`, borderRadius: 3, boxShadow: `0 0 8px ${a.card.acc2}` }} />
                <div style={{ position: "absolute", top: 10, right: 12, fontSize: 16 }}>{EVENTS[a.event].icon}</div>
                {/* objects dropping from above, matching the arena's own palette */}
                <MiniFaller color={a.card.acc2} round style={{ left: 62, top: 0, animation: `fallDrop ${1.5 + i * 0.1}s linear infinite`, animationDelay: `${-0.3}s` }} />
                <MiniFaller color={a.card.acc} style={{ left: 112, top: 0, animation: `fallDrop ${1.8 + i * 0.1}s linear infinite`, animationDelay: `${-1.0}s` }} />
                <MiniFaller color={a.card.acc2} style={{ left: 155, top: 0, animation: `fallDrop ${1.6 + i * 0.12}s linear infinite`, animationDelay: `${-0.7}s` }} />
                {/* two stickmen scurrying along the line, dodging the storm */}
                <MiniRunner color="#3aa0ff" style={{ left: 34, bottom: 12, animation: `dodgePatrolFwd ${2.6 + i * 0.15}s steps(2) infinite` }} />
                <MiniRunner color="#ff3b4d" style={{ left: 140, bottom: 12, animation: `dodgePatrolRev ${2.3 + i * 0.15}s steps(2) infinite`, animationDelay: "-1.1s" }} />
              </div>
              <div style={{ padding: "9px 0 2px", fontWeight: "bold", letterSpacing: 1 }}>{a.name}</div>
              <div style={{ padding: "0 6px 10px", fontSize: 10, opacity: 0.55 }}>{a.desc}</div>
            </button>
          ))}
        </div>

        <button onClick={() => startMatch(mode, arenaIdx)}
          style={{
            cursor: "pointer", marginTop: 20, padding: "14px 52px", fontSize: 18, fontWeight: "bold",
            fontFamily: "monospace", letterSpacing: 2, color: "#07090f",
            background: "linear-gradient(90deg,#3aa0ff,#ff3b4d)", border: "none", borderRadius: 10,
            boxShadow: "0 0 26px rgba(150,90,200,0.5)",
          }}>
          {phase === "matchEnd" ? "PLAY AGAIN ▶" : "START MATCH ▶"}
        </button>
        {phase === "matchEnd" && (
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={() => setPhase("menu")}
              style={{ cursor: "pointer", padding: "8px 18px", borderRadius: 8, fontFamily: "monospace", fontSize: 12, border: "1px solid rgba(255,255,255,0.3)", background: "none", color: "#e8eef5" }}>
              Change Arena
            </button>
            <button onClick={() => { setMode("bo3"); setArenaIdx(0); setPhase("menu"); }}
              style={{ cursor: "pointer", padding: "8px 18px", borderRadius: 8, fontFamily: "monospace", fontSize: 12, border: "1px solid rgba(255,255,255,0.3)", background: "none", color: "#e8eef5" }}>
              Return to Menu
            </button>
          </div>
        )}

        <div style={{
          marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30,
          fontSize: 13, lineHeight: 1.85, background: "#10141d", padding: "16px 28px",
          borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div>
            <b style={neonText("#3aa0ff")}>PLAYER 1</b><br />
            A / D — move · W — jump (again = double jump)<br />
            S — hold to slide · F — dash
          </div>
          <div>
            <b style={neonText("#ff3b4d")}>PLAYER 2</b><br />
            ← / → — move · ↑ — jump (again = double jump)<br />
            ↓ — hold to slide · / — dash
          </div>
        </div>

        <div style={{
          marginTop: 12, fontSize: 12, background: "#10141d", padding: "12px 26px",
          borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", maxWidth: 700, lineHeight: 2, textAlign: "center",
        }}>
          <b>Jump</b> over rollers on the ground · <b>Slide</b> under things bouncing overhead ·
          <b> Dash</b> for a burst of speed with brief invulnerability<br />
          🛡 shield · ⚡ speed · ⬆ higher jump · 🔄 dash recharge · ⏱ slow-mo (slows every hazard) ·
          🧲 magnet · 👻 ghost (hazards pass through) · 🍀 lucky (survives one lethal hit)<br />
          <span style={{ opacity: 0.6 }}>the storm intensifies the longer a round runs — watch the red intensity bar</span><br />
          <span style={{ opacity: 0.75 }}>each arena has its own signature event that strikes every 20 seconds — pick your battlefield wisely</span>
        </div>

        <button onClick={() => setMuted((m) => !m)}
          style={{ marginTop: 14, cursor: "pointer", background: "none", border: "1px solid rgba(255,255,255,0.25)", color: "#e8eef5", borderRadius: 6, padding: "5px 14px", fontFamily: "monospace", fontSize: 12 }}>
          {muted ? "🔇 sound off" : "🔊 sound on"}
        </button>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "4px 0 10px" }}>
        <span style={{ opacity: 0.7, fontSize: 13 }}>{ARENAS[arenaIdx].name} · {mode === "quick" ? "Quick Match" : mode === "bo3" ? "Best of 3" : "Best of 5"}</span>
        <button onClick={() => setMuted((m) => !m)}
          style={{ cursor: "pointer", background: "none", border: "1px solid rgba(255,255,255,0.3)", color: "#e8eef5", borderRadius: 6, padding: "4px 10px", fontFamily: "monospace", fontSize: 12 }}>
          {muted ? "🔇" : "🔊"}
        </button>
        <button onClick={() => setPhase("menu")}
          style={{ cursor: "pointer", background: "none", border: "1px solid rgba(255,255,255,0.3)", color: "#e8eef5", borderRadius: 6, padding: "4px 12px", fontFamily: "monospace", fontSize: 12 }}>
          quit to menu
        </button>
      </div>
      <div style={{ position: "relative", width: "100%", maxWidth: CW }}>
        <canvas ref={canvasRef} width={CW} height={CH}
          style={{ width: "100%", display: "block", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "#000", boxShadow: "0 0 40px rgba(150,90,200,0.15)" }} />
        {touchUI && (
          <>
            <TouchBtn label="◀" code={KEYS.p1.left} color="#3aa0ff" style={{ left: 10, bottom: 10 }} />
            <TouchBtn label="▶" code={KEYS.p1.right} color="#3aa0ff" style={{ left: 74, bottom: 10 }} />
            <TouchBtn label="⭡" code={KEYS.p1.jump} color="#3aa0ff" style={{ left: 138, bottom: 34 }} />
            <TouchBtn label="⭣" code={KEYS.p1.slide} color="#3aa0ff" style={{ left: 138, bottom: -20 }} />
            <TouchBtn label="⚡" code={KEYS.p1.dash} color="#ffe97a" style={{ left: 202, bottom: 10 }} />

            <TouchBtn label="◀" code={KEYS.p2.left} color="#ff3b4d" style={{ right: 202, bottom: 10 }} />
            <TouchBtn label="▶" code={KEYS.p2.right} color="#ff3b4d" style={{ right: 138, bottom: 10 }} />
            <TouchBtn label="⭡" code={KEYS.p2.jump} color="#ff3b4d" style={{ right: 74, bottom: 34 }} />
            <TouchBtn label="⭣" code={KEYS.p2.slide} color="#ff3b4d" style={{ right: 74, bottom: -20 }} />
            <TouchBtn label="⚡" code={KEYS.p2.dash} color="#ffe97a" style={{ right: 10, bottom: 10 }} />
          </>
        )}
      </div>
      <p style={{ opacity: 0.5, fontSize: 12, marginTop: 8 }}>
        {touchUI
          ? "P1 blue (left side) · P2 red (right side) · ⭡ jump/double-jump · ⭣ slide · ⚡ dash"
          : "P1: A D W S + F dash — P2: ← → ↑ ↓ + / dash — jump rollers, slide under overhead hits, dash to dodge"}
      </p>
    </div>
  );
}
