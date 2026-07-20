import React, { useRef, useEffect, useState } from "react";

// ============ STICKMAN RACING 🏁 — NEON EDITION v3 · 10 TRACKS ============
// Split-screen duel race: each player sees the world from THEIR OWN camera.
// If your rival is nearby you'll see them run past; otherwise an arrow shows
// the gap. Long parkour tracks (~70–100s clean runs). First to the flag wins!
//
//   P1 (top screen):    A/D run · W jump / wall-jump / rope release · S slide · F TURBO
//   P2 (bottom screen): ←/→ run · ↑ jump / wall-jump / rope release · ↓ slide · K TURBO

const CW = 900, CH = 520;
const VIEW_H = 244;
const STRIP_Y = VIEW_H, STRIP_H = 32;
const GY = 400;
const GRAV = 2300;
const ACCEL = 980, MAX_SPD = 335, AIR_ACCEL = 620;
const TURBO_SPD = 560, TURBO_DRAIN = 1 / 1.5, TURBO_REGEN = 1 / 7, TURBO_MIN = 0.35;
const JUMP_V = 800, WALLJUMP_VY = 820, WALLJUMP_VX = 300;
const SLIDE_FRICTION = 0.35;

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
    jump: () => tone(300, 0.12, "sine", 0.12, 240),
    wallkick: () => { tone(420, 0.12, "square", 0.14, 260); noise(0.08, 1500, 0.15, 2); },
    slide: () => noise(0.18, 800, 0.14, 0.8),
    grab: () => tone(500, 0.09, "triangle", 0.15, 150),
    release: () => noise(0.12, 1600, 0.16, 1.5),
    turbo: () => { noise(0.5, 1000, 0.22, 0.7); tone(180, 0.5, "sawtooth", 0.12, 320); },
    stumble: () => { noise(0.18, 500, 0.35, 1); tone(120, 0.18, "square", 0.2, -60); },
    spring: () => tone(240, 0.22, "sine", 0.2, 560),
    check: () => { tone(880, 0.1, "square", 0.14); tone(1320, 0.12, "square", 0.12, 0, 0.09); },
    fall: () => tone(500, 0.4, "sawtooth", 0.18, -380),
    beep: (final) => tone(final ? 880 : 440, 0.14, "square", 0.16),
    finish: () => [523, 659, 784, 1046, 1319].forEach((f, i) => tone(f, 0.28, "triangle", 0.2, 0, i * 0.12)),
  };
}
const SFX = makeSFX();

// ---------------- TRACK BUILDER ----------------
function builder() {
  const B = {
    x: 40, y: GY,   // ground starts well before the spawn point (x≈200)
    grounds: [], walls: [], hurdles: [], bars: [], spikes: [], springs: [],
    ropes: [], checks: [], finishX: 0,
  };
  const api = {
    run(len) { B.grounds.push({ x0: B.x, x1: B.x + len, y: B.y }); B.x += len; return api; },
    gap(len) { B.x += len; return api; },
    hurdle(pad = 90) { api.run(pad); B.hurdles.push({ x: B.x, y: B.y }); api.run(pad); return api; },
    bar(pad = 90) { api.run(pad); B.bars.push({ x: B.x, y: B.y }); api.run(pad + 40); return api; },
    spikes(w = 90, pad = 70) { api.run(pad); B.spikes.push({ x: B.x, w, y: B.y }); api.run(w); api.run(pad); return api; },
    spring(pad = 60) { api.run(pad); B.springs.push({ x: B.x, y: B.y }); api.run(40); return api; },
    cliffUp(h, pad = 40) {
      api.run(pad);
      B.walls.push({ x: B.x, y: B.y - h, h });
      B.y -= h;
      api.run(140);
      return api;
    },
    cliffDown(h, pad = 40) { api.run(pad); B.y += h; return api; },
    rope(gapLen, len = 130) {
      const ax = B.x + gapLen / 2;
      B.ropes.push({ ax, ay: B.y - len - 118, len });
      api.gap(gapLen);
      return api;
    },
    check() { B.checks.push({ x: B.x, y: B.y }); return api; },
    finish() { api.run(420); B.finishX = B.x - 260; api.run(300); return api; },
    build() { return B; },
  };
  return api;
}

// ---------------- 10 MAPS ----------------
const MAPS = [
  {
    name: "Neon City", desc: "rooftop marathon · springs & hurdles", theme: "city",
    card: { top: "#070b1e", bot: "#182448", acc: "#5aa9ff", emoji: "🌃" },
    make: () => builder()
      .run(500).hurdle().hurdle().run(120).bar().run(150).check()
      .spikes(100).run(80).hurdle().bar().run(100).spring().gap(230).run(260).check()
      .rope(300).run(220).hurdle().spikes(90).run(90).check()
      .bar().bar().run(120).cliffUp(100).run(180).hurdle().cliffDown(100).run(150).check()
      .spring().gap(260).run(200).spikes(110).run(90).rope(320).run(200).hurdle().bar().run(160).check()
      .hurdle().spikes(90).run(110).spring().gap(240).run(240).check()
      .bar().run(120).rope(300, 150).rope(300, 150).run(200).check()
      .cliffUp(90).run(150).spikes(100).run(80).cliffDown(90).run(120).hurdle().hurdle().run(140).check()
      .spring().gap(250).run(180).bar().spikes(100).run(100)
      .finish().build(),
  },
  {
    name: "Jungle Ruins", desc: "vine swings · triple rope chains", theme: "jungle",
    card: { top: "#06140b", bot: "#12321f", acc: "#5dd48a", emoji: "🌿" },
    make: () => builder()
      .run(420).hurdle().run(100).rope(300).run(180).check()
      .bar().spikes(100).run(90).rope(340, 150).run(160).check()
      .cliffUp(90).run(140).hurdle().run(90).rope(300, 140).run(150).check()
      .spikes(120).run(80).bar().run(90).rope(300, 150).rope(300, 150).run(200).check()
      .cliffDown(90).run(120).hurdle().hurdle().spikes(100).run(90).rope(340, 150).run(180).bar().run(140).check()
      .spring().gap(240).run(160).rope(300).run(200).check()
      .hurdle().bar().run(110).rope(300, 150).rope(300, 150).rope(300, 150).run(220).check()
      .spikes(110).run(90).cliffUp(100).run(150).bar().run(90).cliffDown(100).run(130).check()
      .spring().gap(260).run(170).hurdle().spikes(100).run(110).rope(320, 140).run(190)
      .finish().build(),
  },
  {
    name: "Volcano Core", desc: "cliff towers · lava gaps · brutal", theme: "volcano",
    card: { top: "#160504", bot: "#43120a", acc: "#ff8a4c", emoji: "🌋" },
    make: () => builder()
      .run(400).spikes(110, 60).hurdle().run(90).check()
      .cliffUp(110).run(110).bar().run(80).cliffUp(100).run(150).check()
      .spikes(90, 50).run(70).cliffDown(210).run(110).rope(340, 150).run(150).check()
      .hurdle().spikes(120, 55).run(70).bar().run(90).cliffUp(120).run(120).spikes(80, 50).run(90).cliffDown(120).run(110).check()
      .spring().gap(280).run(150).bar().spikes(100, 55).run(70).rope(290, 150).rope(300, 150).run(180).check()
      .hurdle().hurdle().spikes(140, 60).run(100).check()
      .cliffUp(100).run(120).cliffUp(110).run(130).spikes(90, 50).run(80).cliffDown(210).run(120).check()
      .bar().run(90).spring().gap(260).run(150).spikes(120, 55).run(80).rope(320, 150).run(170).check()
      .hurdle().spikes(100, 55).run(80).bar().run(100).spring().gap(250).run(200)
      .finish().build(),
  },
  {
    name: "Frozen Summit", desc: "icy cliffs · slide tunnels", theme: "ice",
    card: { top: "#081222", bot: "#1c3350", acc: "#a9e6ff", emoji: "❄️" },
    make: () => builder()
      .run(460).bar().bar().run(120).hurdle().run(130).check()
      .cliffUp(100).run(140).bar().run(90).cliffUp(90).run(150).check()
      .spikes(100).run(80).cliffDown(190).run(130).rope(310, 140).run(170).check()
      .bar().bar().bar().run(130).hurdle().spikes(90).run(100).check()
      .spring().gap(250).run(180).cliffUp(110).run(140).bar().run(90).cliffDown(110).run(130).check()
      .rope(300, 150).rope(300, 150).run(200).check()
      .spikes(110).run(80).bar().run(100).hurdle().hurdle().run(120).check()
      .cliffUp(95).run(130).spikes(90).run(80).spring().gap(240).run(170).cliffDown(95).run(120).check()
      .bar().bar().run(120).rope(330, 150).run(180).spikes(100).run(110)
      .finish().build(),
  },
  {
    name: "Desert Mirage", desc: "dune sprint · spring flights", theme: "desert",
    card: { top: "#1c0f04", bot: "#4a2a0c", acc: "#ffd27a", emoji: "🏜️" },
    make: () => builder()
      .run(480).hurdle().run(110).spikes(100).run(90).check()
      .spring().gap(250).run(200).hurdle().hurdle().run(130).check()
      .bar().run(110).spikes(120).run(80).spring().gap(260).run(190).check()
      .hurdle().run(100).rope(320, 140).run(180).spikes(100).run(90).check()
      .spring().gap(240).run(170).spring().gap(250).run(190).check()
      .bar().bar().run(120).hurdle().spikes(110).run(90).check()
      .cliffUp(90).run(150).hurdle().run(100).cliffDown(90).run(130).spring().gap(260).run(180).check()
      .spikes(130, 60).run(80).hurdle().bar().run(120).rope(300, 140).run(170).check()
      .spring().gap(250).run(180).hurdle().hurdle().spikes(100).run(120)
      .finish().build(),
  },
  {
    name: "Cyber Grid", desc: "rhythm gates · laser fences", theme: "cyber",
    card: { top: "#05010f", bot: "#180533", acc: "#ff4fd8", emoji: "🤖" },
    make: () => builder()
      .run(460).bar().hurdle().bar().run(120).check()
      .spikes(90).run(80).bar().hurdle().bar().run(110).check()
      .spring().gap(250).run(180).bar().bar().run(110).hurdle().run(120).check()
      .rope(310, 140).run(170).spikes(110).run(80).bar().run(110).check()
      .cliffUp(100).run(130).bar().hurdle().run(100).cliffDown(100).run(120).check()
      .bar().hurdle().bar().hurdle().run(130).check()
      .spring().gap(260).run(170).rope(300, 150).rope(300, 150).run(190).check()
      .spikes(100).run(80).bar().bar().hurdle().run(120).check()
      .cliffUp(90).run(130).spikes(90).run(80).cliffDown(90).run(110).spring().gap(240).run(200)
      .finish().build(),
  },
  {
    name: "Haunted Hollow", desc: "graveyard fog · cursed spikes", theme: "haunt",
    card: { top: "#0a0512", bot: "#1e0f2e", acc: "#9d7aff", emoji: "🎃" },
    make: () => builder()
      .run(440).spikes(100).run(80).hurdle().run(120).check()
      .rope(320, 140).run(170).spikes(110).run(80).bar().run(110).check()
      .hurdle().spikes(90).run(90).rope(300, 150).rope(300, 150).run(190).check()
      .bar().bar().run(110).spikes(120, 60).run(80).hurdle().run(120).check()
      .cliffUp(100).run(140).spikes(90).run(80).cliffDown(100).run(120).check()
      .spring().gap(250).run(170).spikes(100).run(80).rope(330, 150).run(180).check()
      .hurdle().hurdle().spikes(130, 60).run(90).bar().run(110).check()
      .rope(310, 140).run(160).spikes(100).run(80).spring().gap(240).run(180).check()
      .bar().spikes(110).run(90).hurdle().run(110).rope(300, 140).run(180)
      .finish().build(),
  },
  {
    name: "Sky Haven", desc: "floating isles · flow state", theme: "sky",
    card: { top: "#12203f", bot: "#4a6ea8", acc: "#cfe8ff", emoji: "☁️" },
    make: () => builder()
      .run(440).spring().gap(250).run(180).check()
      .rope(320, 140).run(160).spring().gap(260).run(180).check()
      .hurdle().run(100).rope(300, 150).rope(300, 150).run(190).check()
      .spring().gap(240).run(160).spring().gap(250).run(170).check()
      .bar().run(110).rope(330, 150).run(170).hurdle().run(110).check()
      .spring().gap(260).run(170).rope(300, 150).rope(300, 150).rope(300, 150).run(210).check()
      .spikes(90).run(80).spring().gap(250).run(170).bar().run(110).check()
      .rope(320, 140).run(160).spring().gap(240).run(170).hurdle().run(110).check()
      .spring().gap(260).run(180).rope(310, 150).run(190)
      .finish().build(),
  },
  {
    name: "Rust Factory", desc: "pipe maze · steam walls", theme: "factory",
    card: { top: "#0d0d10", bot: "#2a2320", acc: "#ffb85c", emoji: "🏭" },
    make: () => builder()
      .run(440).bar().bar().run(110).hurdle().run(120).check()
      .cliffUp(110).run(130).bar().run(90).cliffDown(110).run(120).check()
      .spikes(110).run(80).bar().hurdle().run(110).check()
      .cliffUp(100).run(120).cliffUp(90).run(130).bar().run(90).cliffDown(190).run(120).check()
      .spring().gap(250).run(170).spikes(100).run(80).bar().bar().run(120).check()
      .rope(310, 140).run(160).hurdle().bar().run(110).check()
      .cliffUp(120).run(130).spikes(90).run(80).bar().run(90).cliffDown(120).run(120).check()
      .hurdle().spikes(120, 60).run(80).spring().gap(240).run(170).check()
      .bar().bar().run(110).rope(320, 150).run(170).spikes(100).run(110)
      .finish().build(),
  },
  {
    name: "Crystal Caves", desc: "everything at once · the gauntlet", theme: "crystal",
    card: { top: "#060213", bot: "#241448", acc: "#8fd0ff", emoji: "💎" },
    make: () => builder()
      .run(420).spikes(100, 60).hurdle().bar().run(110).check()
      .cliffUp(110).run(130).spikes(90, 55).run(80).cliffDown(110).run(110).check()
      .rope(300, 150).rope(300, 150).run(180).bar().run(100).check()
      .spring().gap(260).run(160).spikes(120, 55).run(70).hurdle().hurdle().run(110).check()
      .cliffUp(100).run(120).bar().run(90).cliffUp(100).run(130).spikes(90, 50).run(80).cliffDown(200).run(110).check()
      .rope(330, 150).run(160).bar().spikes(100, 55).run(80).check()
      .spring().gap(250).run(160).rope(300, 150).rope(300, 150).rope(300, 150).run(200).check()
      .hurdle().spikes(130, 60).run(80).bar().bar().run(110).check()
      .cliffUp(120).run(120).spikes(90, 50).run(80).cliffDown(120).run(110).spring().gap(250).run(160).check()
      .bar().hurdle().spikes(110, 55).run(90).rope(320, 150).run(180)
      .finish().build(),
  },
];

const KEYS = {
  p1: { left: "KeyA", right: "KeyD", jump: "KeyW", slide: "KeyS", turbo: "KeyF" },
  p2: { left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp", slide: "ArrowDown", turbo: "KeyK" },
};
const ALL_KEYS = [...Object.values(KEYS.p1), ...Object.values(KEYS.p2)];
const LOCAL = KEYS.p1; // each partner uses WASD+F on their own device
const LOCAL_CODES = Object.values(LOCAL);

function remapTo(slot, code) {
  const entry = Object.entries(LOCAL).find(([, v]) => v === code);
  if (!entry) return null;
  return KEYS[slot][entry[0]];
}

function makeRacer(id) {
  return {
    id, x: 200 + (id === 0 ? 0 : 34), y: GY, vx: 0, vy: 0,
    neon: id === 0 ? "#3aa0ff" : "#ff3b4d",
    glow: id === 0 ? "#7cc8ff" : "#ff8090",
    onGround: true, sliding: false, slideFx: 0,
    wallDir: 0,
    rope: null, ropeTh: 0, ropeW: 0, ropeCd: 0, lastRope: null,
    stumbleT: 0, respawnT: 0,
    turbo: 1, turboT: 0,
    checkpoint: { x: 200, y: GY },
    finished: false, finishTime: 0,
    runPhase: 0, facing: 1, airT: 0,
    trail: [],
  };
}

export default function StickmanRacing({ myRole = 'A', names = {}, rt, onComplete, pausedRef }) {
  const isHost = myRole === 'A';
  const mySlot = myRole === 'A' ? 'p1' : 'p2';
  const p1Name = names.A || 'Player 1';
  const p2Name = names.B || 'Player 2';

  const canvasRef = useRef(null);
  const [phase, setPhase] = useState("menu");
  const [mapIdx, setMapIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [muted, setMuted] = useState(false);
  const [touchUI, setTouchUI] = useState(false);
  const stateRef = useRef({});
  const finishedRef = useRef(false);

  // show on-screen buttons only on touch devices (phones / tablets)
  useEffect(() => {
    const touch = typeof window !== "undefined" &&
      (("ontouchstart" in window) || (navigator.maxTouchPoints || 0) > 0);
    setTouchUI(touch);
  }, []);

  useEffect(() => { SFX.setMuted(muted); }, [muted]);

  const startRace = (mi, fromNet = false) => {
    if (!isHost && !fromNet) return;
    SFX.unlock();
    finishedRef.current = false;
    setMapIdx(mi); setResult(null);
    setPhase("playing");
    stateRef.current.launch = { mapIdx: mi };
    if (isHost && !fromNet) rt?.send({ k: 'sr-start', mapIdx: mi });
  };

  useEffect(() => {
    if (!rt?.on) return undefined;
    rt.on(msg => {
      if (!msg?.k) return;
      if (msg.k === 'sr-start' && !isHost) startRace(msg.mapIdx, true);
      if (msg.k === 'sr-end') {
        setResult(msg.result || null);
        setPhase('matchEnd');
      }
      if (msg.k === 'sr-menu') {
        setPhase('menu');
        setResult(null);
      }
      if (msg.k === 'sr-in' && isHost && stateRef.current.applyRemoteKeys) {
        stateRef.current.applyRemoteKeys(msg);
      }
      if (msg.k === 'sr-st' && !isHost && stateRef.current.applySnap) {
        stateRef.current.applySnap(msg);
      }
    });
    return undefined;
  }, [rt, isHost]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const mi = stateRef.current.launch.mapIdx;
    const map = MAPS[mi];
    const T = map.make();

    const S = {
      T, players: [makeRacer(0), makeRacer(1)],
      keys: {}, pressed: {},
      t: 0, raceT: 0, mode: "countdown", modeT: 0, lastBeep: -1,
      particles: [], texts: [],
      done: false,
    };

    const remoteHeld = {};
    stateRef.current.applyRemoteKeys = (msg) => {
      Object.keys(remoteHeld).forEach(k => { remoteHeld[k] = false; });
      const held = msg.held || {};
      Object.entries(held).forEach(([code, on]) => {
        const mapped = remapTo('p2', code);
        if (mapped) remoteHeld[mapped] = !!on;
      });
      (msg.edge || []).forEach(code => {
        const mapped = remapTo('p2', code);
        if (mapped) S.pressed[mapped] = true;
      });
    };
    stateRef.current.applySnap = (msg) => {
      if (!msg.players) return;
      S.players = msg.players;
      S.mode = msg.mode;
      S.modeT = msg.modeT;
      S.raceT = msg.raceT;
      S.t = msg.t;
      S.done = !!msg.done;
      S.particles = msg.particles || S.particles;
      S.texts = msg.texts || S.texts;
    };

    let edgeBuf = [];
    const down = (e) => {
      if (!LOCAL_CODES.includes(e.code)) return;
      e.preventDefault();
      const mapped = remapTo(mySlot, e.code);
      if (!mapped) return;
      if (isHost) {
        if (!S.keys[mapped]) S.pressed[mapped] = true;
        S.keys[mapped] = true;
      } else {
        if (!remoteHeld[e.code]) edgeBuf.push(e.code);
        remoteHeld[e.code] = true;
      }
    };
    const up = (e) => {
      if (!LOCAL_CODES.includes(e.code)) return;
      const mapped = remapTo(mySlot, e.code);
      if (!mapped) return;
      if (isHost) S.keys[mapped] = false;
      else remoteHeld[e.code] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    // touch-control bridge — on-screen buttons drive the exact same key states
    stateRef.current.setKey = (code, isDown) => {
      // Touch buttons pass physical KEYS.p1 / KEYS.p2 codes — remap for my seat
      const action = Object.entries(KEYS.p1).find(([, v]) => v === code)?.[0]
        || Object.entries(KEYS.p2).find(([, v]) => v === code)?.[0];
      if (!action) return;
      const mapped = KEYS[mySlot][action];
      if (isHost) {
        if (isDown && !S.keys[mapped]) S.pressed[mapped] = true;
        S.keys[mapped] = isDown;
      } else {
        const localCode = LOCAL[action];
        if (isDown && !remoteHeld[localCode]) edgeBuf.push(localCode);
        remoteHeld[localCode] = isDown;
      }
    };

    const spark = (x, y, color, n = 8, spd = 220) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = spd * (0.4 + Math.random() * 0.8);
        S.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.45, max: 0.45, color, r: 2 + Math.random() * 3, glow: true });
      }
    };
    const puff = (x, y, n = 5) => {
      for (let i = 0; i < n; i++) {
        S.particles.push({ x: x + (Math.random() - 0.5) * 18, y, vx: -60 - Math.random() * 60, vy: -20 - Math.random() * 40, life: 0.35, max: 0.35, color: "rgba(220,220,220,0.5)", r: 3 + Math.random() * 3, grav: 0.2 });
      }
    };
    const worldText = (x, y, str, color) => S.texts.push({ x, y, vy: -70, life: 0.9, max: 0.9, str, color });

    const groundAt = (x) => {
      let best = null;
      for (const g of T.grounds) {
        if (x >= g.x0 - 2 && x <= g.x1 + 2) {
          if (best === null || g.y < best) best = g.y;
        }
      }
      return best;
    };
    const landingY = (x, prevY, newY) => {
      let land = null;
      for (const g of T.grounds) {
        if (x >= g.x0 - 2 && x <= g.x1 + 2 && prevY <= g.y + 4 && newY >= g.y) {
          if (land === null || g.y < land) land = g.y;
        }
      }
      return land;
    };

    const stumble = (p, msg = "OUCH!") => {
      if (p.stumbleT > 0) return;
      p.stumbleT = 0.45;
      p.vx = -120;
      p.turboT = 0;
      SFX.stumble();
      spark(p.x, p.y - 40, "#ff8f6a", 10, 260);
      worldText(p.x, p.y - 96, msg, "#ff8f6a");
    };

    const respawn = (p) => {
      SFX.fall();
      p.x = p.checkpoint.x; p.y = p.checkpoint.y;
      p.vx = 0; p.vy = 0; p.rope = null; p.sliding = false;
      p.respawnT = 0.7; p.turboT = 0;
      worldText(p.x, p.y - 100, "RESPAWN", "#a9c4e6");
    };

    // ---------------- PLAYER UPDATE ----------------
    const updateRacer = (p, dt) => {
      const k = p.id === 0 ? KEYS.p1 : KEYS.p2;
      const canControl = S.mode === "race" && p.respawnT <= 0 && !p.finished;
      if (p.stumbleT > 0) p.stumbleT -= dt;
      if (p.respawnT > 0) p.respawnT -= dt;
      if (p.ropeCd > 0) p.ropeCd -= dt;
      const stunned = p.stumbleT > 0 || p.respawnT > 0;

      // TURBO
      if (p.turboT > 0) {
        p.turboT -= dt;
        p.turbo = Math.max(0, p.turbo - TURBO_DRAIN * dt);
        if (p.turbo <= 0) p.turboT = 0;
        if (Math.random() < 0.6) {
          S.particles.push({ x: p.x - 18, y: p.y - 30 - Math.random() * 30, vx: -240 - Math.random() * 120, vy: (Math.random() - 0.5) * 60, life: 0.3, max: 0.3, color: p.neon, r: 2.5, glow: true, grav: 0 });
        }
      } else {
        p.turbo = Math.min(1, p.turbo + TURBO_REGEN * dt);
      }
      if (canControl && !stunned && S.pressed[k.turbo] && p.turboT <= 0 && p.turbo >= TURBO_MIN && !p.rope) {
        p.turboT = p.turbo * 1.5;
        SFX.turbo();
        worldText(p.x, p.y - 100, "TURBO!", p.neon);
      }
      const boosted = p.turboT > 0;
      const maxSpd = boosted ? TURBO_SPD : MAX_SPD;

      // ROPE SWING
      if (p.rope) {
        const r = p.rope;
        let acc = -(GRAV / r.len) * Math.sin(p.ropeTh);
        if (canControl && !stunned) {
          if (S.keys[k.right]) acc += 2.4;
          if (S.keys[k.left]) acc -= 2.4;
        }
        p.ropeW += acc * dt;
        p.ropeW *= 0.998;
        p.ropeTh += p.ropeW * dt;
        p.x = r.ax + Math.sin(p.ropeTh) * r.len;
        p.y = r.ay + Math.cos(p.ropeTh) * r.len + 48;
        if (canControl && S.pressed[k.jump]) {
          // release with a strong launch — flings you far enough to chain ropes
          const tv = Math.max(Math.abs(p.ropeW * r.len), 240) * Math.sign(p.ropeW * r.len || 1);
          p.vx = Math.cos(p.ropeTh) * tv * 1.3;
          p.vy = -Math.sin(p.ropeTh) * tv - 360;
          p.rope = null; p.lastRope = r; p.ropeCd = 0.45;
          SFX.release();
          spark(p.x, p.y - 40, p.neon, 6, 180);
        }
        return;
      }

      // INPUT / RUN
      let ax = 0;
      if (canControl && !stunned) {
        if (S.keys[k.right]) ax += 1;
        if (S.keys[k.left]) ax -= 1;
      }
      const wantSlide = canControl && !stunned && S.keys[k.slide] && p.onGround;
      if (wantSlide && !p.sliding) { p.sliding = true; SFX.slide(); puff(p.x, p.y); }
      if (!wantSlide) p.sliding = false;

      if (p.sliding) {
        p.vx *= 1 - SLIDE_FRICTION * dt;
        if (Math.random() < 0.4) puff(p.x - 10, p.y, 1);
      } else if (p.onGround) {
        const target = ax * maxSpd;
        const rate = boosted ? ACCEL * 1.5 : ACCEL;
        if (ax !== 0) {
          p.vx += Math.sign(target - p.vx) * rate * dt;
          if (Math.abs(p.vx) > Math.abs(target) && Math.sign(p.vx) === Math.sign(target)) p.vx = target;
          p.facing = ax > 0 ? 1 : -1;
        } else {
          p.vx *= Math.max(0, 1 - 8 * dt);
        }
      } else {
        if (ax !== 0) {
          p.vx += ax * AIR_ACCEL * dt;
          p.vx = Math.max(-maxSpd, Math.min(maxSpd * 1.05, p.vx));
          p.facing = ax > 0 ? 1 : -1;
        }
      }

      // JUMP / WALL-JUMP
      if (canControl && !stunned && S.pressed[k.jump]) {
        if (p.onGround) {
          p.vy = -JUMP_V; p.onGround = false; p.sliding = false;
          SFX.jump(); puff(p.x, p.y, 4);
        } else if (p.wallDir !== 0) {
          p.vy = -WALLJUMP_VY;
          p.vx = -p.wallDir * WALLJUMP_VX;
          p.facing = -p.wallDir;
          SFX.wallkick();
          spark(p.x + p.wallDir * 12, p.y - 46, "#ffffff", 8, 200);
        }
      }

      // PHYSICS
      const prevY = p.y;
      const wallSliding = !p.onGround && p.wallDir !== 0 && ((p.wallDir === 1 && S.keys[k.right]) || (p.wallDir === -1 && S.keys[k.left])) && p.vy > 0;
      p.vy += GRAV * dt;
      if (wallSliding) p.vy = Math.min(p.vy, 150);
      if (p.vy > 1300) p.vy = 1300;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 60) { p.x = 60; p.vx = Math.max(0, p.vx); }

      // WALL COLLISION
      p.wallDir = 0;
      for (const w of T.walls) {
        const wx = w.x, wTop = w.y, wBot = w.y + w.h;
        const pw = 13;
        if (p.y > wTop + 4 && p.y - 74 < wBot) {
          if (p.x + pw > wx && p.x + pw < wx + 30 && p.vx >= 0) {
            p.x = wx - pw; if (p.vx > 0) p.vx = 0; p.wallDir = 1;
          } else if (p.x - pw < wx + 26 && p.x - pw > wx - 6 && p.vx <= 0) {
            p.x = wx + 26 + pw; if (p.vx < 0) p.vx = 0; p.wallDir = -1;
          }
        }
      }
      if (wallSliding && Math.random() < 0.4) {
        S.particles.push({ x: p.x + p.wallDir * 12, y: p.y - 30, vx: 0, vy: 60, life: 0.25, max: 0.25, color: "rgba(230,230,230,0.5)", r: 2, grav: 0 });
      }

      // LANDING
      const land = landingY(p.x, prevY, p.y);
      p.onGround = false;
      if (land !== null && p.vy >= 0) {
        if (p.vy > 900) puff(p.x, land, 6);
        p.y = land; p.vy = 0; p.onGround = true; p.airT = 0;
      } else {
        p.airT += dt;
      }

      // ROPE GRAB — generous zone across the whole swing arc, so rope→rope chains connect
      if (!p.onGround) {
        for (const r of T.ropes) {
          if (r === p.lastRope && p.ropeCd > 0) continue;
          if (S.players[1 - p.id].rope === r) continue;
          const hx = p.x - r.ax, hy2 = (p.y - 48) - r.ay;
          if (hy2 < 0) continue;
          const d = Math.hypot(hx, hy2);
          if (d < r.len + 95 && d > r.len * 0.25) {
            p.rope = r; p.lastRope = r;
            p.ropeTh = Math.atan2(hx, hy2);
            const c = Math.cos(p.ropeTh), sn = Math.sin(p.ropeTh);
            p.ropeW = (p.vx * c - p.vy * sn) / r.len;
            p.sliding = false;
            SFX.grab();
            break;
          }
        }
      }

      // OBSTACLES
      if (S.mode === "race" && !p.finished && p.respawnT <= 0) {
        for (const hd of T.hurdles) {
          if (p.onGround && Math.abs(p.y - hd.y) < 6 && Math.abs(p.x - hd.x) < 16 && Math.abs(p.vx) > 30) stumble(p);
        }
        for (const b of T.bars) {
          if (p.onGround && Math.abs(p.y - b.y) < 6 && Math.abs(p.x - b.x) < 30 && !p.sliding && Math.abs(p.vx) > 30) stumble(p, "DUCK!");
        }
        for (const sp of T.spikes) {
          if (p.onGround && Math.abs(p.y - sp.y) < 6 && p.x > sp.x - 6 && p.x < sp.x + sp.w + 6) {
            stumble(p, "SPIKES!");
            // clean bounce back to just before the strip — retry the jump immediately
            p.x = sp.x - 26; p.vx = -60; p.vy = -330; p.onGround = false;
          }
        }
        for (const s of T.springs) {
          if (p.onGround && Math.abs(p.y - s.y) < 8 && Math.abs(p.x - s.x - 20) < 26 && p.vy >= 0) {
            p.vy = -1080; p.onGround = false;
            SFX.spring();
            spark(s.x + 20, s.y, "#7dffb0", 8, 200);
          }
        }
        for (const c of T.checks) {
          if (p.x >= c.x && p.checkpoint.x < c.x) {
            p.checkpoint = { x: c.x, y: c.y };
            SFX.check();
            worldText(c.x, c.y - 120, "CHECKPOINT", "#7dffb0");
          }
        }
        if (p.y > GY + 220) respawn(p);
        if (p.x >= T.finishX && !p.finished) {
          p.finished = true;
          p.finishTime = S.raceT;
          if (!S.done) {
            S.done = true;
            SFX.finish();
            const other = S.players[1 - p.id];
            const gap = T.finishX - other.x;
            const payload = {
              winner: p.id + 1,
              time: p.finishTime,
              gap: Math.max(0, Math.round(gap / 10)),
            };
            setTimeout(() => {
              if (finishedRef.current) return;
              finishedRef.current = true;
              setResult(payload);
              setPhase("matchEnd");
              if (isHost) {
                rt?.send({ k: 'sr-end', result: payload });
                onComplete?.(p.id === 0 ? 'A' : 'B');
              }
            }, 1600);
          }
        }
      }

      if (p.onGround && Math.abs(p.vx) > 40 && !p.sliding) p.runPhase += dt * (10 + Math.abs(p.vx) / 40);
      else p.runPhase *= 0.9;
      if (boosted) p.trail.push({ x: p.x, y: p.y, life: 0.25, max: 0.25, sliding: p.sliding });
      p.trail = p.trail.filter((tr) => { tr.life -= dt; return tr.life > 0; });
      if (p.slideFx > 0) p.slideFx -= dt;
    };

    // ---------------- BACKDROPS (10 themes) ----------------
    const drawBackdrop = (camX, camY, vy0) => {
      const skies = {
        city: ["#070b1e", "#182448"], jungle: ["#06140b", "#12321f"], volcano: ["#160504", "#43120a"],
        ice: ["#081222", "#1c3350"], desert: ["#1c0f04", "#4a2a0c"], cyber: ["#05010f", "#180533"],
        haunt: ["#0a0512", "#1e0f2e"], sky: ["#12203f", "#4a6ea8"], factory: ["#0d0d10", "#2a2320"],
        crystal: ["#060213", "#241448"],
      };
      const [c1, c2] = skies[map.theme];
      const g = ctx.createLinearGradient(0, vy0, 0, vy0 + VIEW_H);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g; ctx.fillRect(0, vy0, CW, VIEW_H);
      const bot = vy0 + VIEW_H;

      const stars = (count, color = "220,230,255") => {
        for (let i = 0; i < count; i++) {
          const sx = ((i * 137 - camX * 0.06) % CW + CW) % CW;
          const a = 0.3 + 0.5 * Math.abs(Math.sin(S.t + i));
          ctx.fillStyle = `rgba(${color},${a})`;
          ctx.fillRect(sx, vy0 + 12 + (i * 53) % 90, 2, 2);
        }
      };

      if (map.theme === "city") {
        for (let layer = 0; layer < 2; layer++) {
          const par = 0.2 + layer * 0.2;
          const bw = 90, off = ((camX * par) % bw + bw) % bw;
          ctx.fillStyle = layer === 0 ? "#0c1330" : "#111a3e";
          for (let i = -1; i < CW / bw + 2; i++) {
            const bx = i * bw - off;
            const h = 60 + ((i * 37 + layer * 13) % 70);
            ctx.fillRect(bx, bot - h - 30 - layer * 24, bw - 14, h + 60);
            ctx.fillStyle = "rgba(255,220,130,0.5)";
            for (let wnd = 0; wnd < 3; wnd++) {
              const lit = Math.sin(S.t * 1.5 + i * 3 + wnd * 7 + layer) > 0.2;
              if (lit) ctx.fillRect(bx + 12 + wnd * 22, bot - h - 16 - layer * 24 + (wnd % 2) * 24, 6, 8);
            }
            ctx.fillStyle = layer === 0 ? "#0c1330" : "#111a3e";
          }
        }
        stars(20);
      } else if (map.theme === "jungle") {
        for (let layer = 0; layer < 2; layer++) {
          const par = 0.2 + layer * 0.22;
          const tw = 130, off = ((camX * par) % tw + tw) % tw;
          ctx.fillStyle = layer === 0 ? "#0a2113" : "#0e2c1a";
          for (let i = -1; i < CW / tw + 2; i++) {
            const tx = i * tw - off;
            ctx.beginPath();
            ctx.arc(tx + 40, bot - 60 - layer * 30, 46, 0, Math.PI * 2);
            ctx.arc(tx + 90, bot - 40 - layer * 30, 38, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(tx + 34, bot - 60 - layer * 30, 10, 80);
          }
        }
        for (let i = 0; i < 10; i++) {
          const fx = ((i * 197 - camX * 0.3) % CW + CW) % CW;
          const fy = vy0 + 60 + (i * 71) % 140 + Math.sin(S.t * 1.5 + i) * 8;
          const a = 0.3 + 0.7 * Math.abs(Math.sin(S.t * 2 + i * 1.7));
          ctx.save();
          ctx.shadowColor = "#d8ff7a"; ctx.shadowBlur = 8;
          ctx.fillStyle = `rgba(216,255,122,${a})`;
          ctx.beginPath(); ctx.arc(fx, fy, 1.8, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      } else if (map.theme === "volcano") {
        const pulse = 0.5 + 0.5 * Math.sin(S.t * 1.4);
        const gl = ctx.createLinearGradient(0, bot - 90, 0, bot);
        gl.addColorStop(0, "rgba(255,90,30,0)");
        gl.addColorStop(1, `rgba(255,90,30,${0.25 + pulse * 0.15})`);
        ctx.fillStyle = gl; ctx.fillRect(0, bot - 90, CW, 90);
        const rw = 160, off = ((camX * 0.25) % rw + rw) % rw;
        ctx.fillStyle = "#200a06";
        for (let i = -1; i < CW / rw + 2; i++) {
          const rx = i * rw - off;
          ctx.beginPath();
          ctx.moveTo(rx, bot);
          ctx.lineTo(rx + 50, bot - 90 - (i * 31 % 40));
          ctx.lineTo(rx + 110, bot);
          ctx.fill();
        }
        for (let i = 0; i < 12; i++) {
          const ex = ((i * 173 - camX * 0.35) % CW + CW) % CW;
          const ey = bot - ((S.t * 26 + i * 61) % (VIEW_H - 20));
          const a = 0.4 + 0.5 * Math.abs(Math.sin(S.t * 6 + i));
          ctx.save();
          ctx.shadowColor = "#ff7a3c"; ctx.shadowBlur = 8;
          ctx.fillStyle = `rgba(255,150,80,${a})`;
          ctx.beginPath(); ctx.arc(ex, ey, 1.8, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      } else if (map.theme === "ice") {
        // aurora ribbon
        ctx.save();
        ctx.globalAlpha = 0.18;
        const grad = ctx.createLinearGradient(0, vy0 + 20, 0, vy0 + 120);
        grad.addColorStop(0, "rgba(140,255,200,0.9)"); grad.addColorStop(1, "rgba(140,255,200,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-20, vy0 + 50);
        for (let x = 0; x <= CW + 20; x += 30) ctx.lineTo(x, vy0 + 50 + Math.sin(S.t * 0.7 + (x + camX * 0.1) * 0.012) * 20);
        for (let x = CW + 20; x >= -20; x -= 30) ctx.lineTo(x, vy0 + 120 + Math.sin(S.t * 0.7 + (x + camX * 0.1) * 0.012) * 20);
        ctx.fill();
        ctx.restore();
        stars(16);
        // snowy peaks
        const pw2 = 190, off = ((camX * 0.22) % pw2 + pw2) % pw2;
        for (let i = -1; i < CW / pw2 + 2; i++) {
          const px2 = i * pw2 - off;
          ctx.fillStyle = "#152640";
          ctx.beginPath();
          ctx.moveTo(px2, bot); ctx.lineTo(px2 + 70, bot - 110 - (i * 23 % 30)); ctx.lineTo(px2 + 150, bot);
          ctx.fill();
          ctx.fillStyle = "#dcecff";
          ctx.beginPath();
          ctx.moveTo(px2 + 52, bot - 82 - (i * 23 % 30)); ctx.lineTo(px2 + 70, bot - 110 - (i * 23 % 30)); ctx.lineTo(px2 + 88, bot - 84 - (i * 23 % 30));
          ctx.fill();
        }
        // falling snow
        for (let i = 0; i < 26; i++) {
          const sx = ((i * 131 - camX * 0.15 + Math.sin(S.t + i) * 20) % CW + CW) % CW;
          const sy = vy0 + ((S.t * 34 + i * 67) % VIEW_H);
          ctx.fillStyle = "rgba(230,240,255,0.7)";
          ctx.beginPath(); ctx.arc(sx, sy, 1.6, 0, Math.PI * 2); ctx.fill();
        }
      } else if (map.theme === "desert") {
        // low sun
        ctx.save();
        ctx.shadowColor = "#ffb85c"; ctx.shadowBlur = 46;
        ctx.fillStyle = "#ffd9a0";
        ctx.beginPath(); ctx.arc(CW * 0.6, vy0 + 70, 30, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // dunes layers
        for (let layer = 0; layer < 2; layer++) {
          const par = 0.18 + layer * 0.2;
          const dw = 260, off = ((camX * par) % dw + dw) % dw;
          ctx.fillStyle = layer === 0 ? "#2c1a08" : "#3a230c";
          ctx.beginPath();
          ctx.moveTo(-10, bot);
          for (let x = -10; x <= CW + 10; x += 20) {
            const ph = ((x + off) / dw) * Math.PI * 2;
            ctx.lineTo(x, bot - 44 - layer * 26 + Math.sin(ph) * 22);
          }
          ctx.lineTo(CW + 10, bot);
          ctx.fill();
        }
        // drifting sand
        for (let i = 0; i < 14; i++) {
          const sx = ((i * 149 - camX * 0.3 - S.t * 60) % CW + CW) % CW;
          const sy = bot - 20 - (i * 37) % 90;
          ctx.fillStyle = "rgba(255,214,150,0.25)";
          ctx.fillRect(sx, sy, 8, 1.5);
        }
        stars(10, "255,230,190");
      } else if (map.theme === "cyber") {
        // horizon glow
        ctx.save();
        ctx.shadowColor = "#ff4fd8"; ctx.shadowBlur = 26;
        ctx.strokeStyle = "rgba(255,79,216,0.7)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, bot - 70); ctx.lineTo(CW, bot - 70); ctx.stroke();
        ctx.restore();
        // perspective grid
        ctx.strokeStyle = "rgba(90,60,190,0.4)"; ctx.lineWidth = 1;
        const gw = 70, goff = ((camX * 0.4) % gw + gw) % gw;
        for (let i = -1; i < CW / gw + 2; i++) {
          ctx.beginPath();
          ctx.moveTo(i * gw - goff, bot - 70);
          ctx.lineTo((i * gw - goff - CW / 2) * 2 + CW / 2, bot + 30);
          ctx.stroke();
        }
        for (let r2 = 0; r2 < 4; r2++) {
          ctx.beginPath();
          ctx.moveTo(0, bot - 70 + (r2 + 1) * (r2 + 1) * 6);
          ctx.lineTo(CW, bot - 70 + (r2 + 1) * (r2 + 1) * 6);
          ctx.stroke();
        }
        // floating neon triangles
        for (let i = 0; i < 6; i++) {
          const tx = ((i * 190 - camX * 0.2) % CW + CW) % CW;
          const ty = vy0 + 40 + (i * 47) % 100 + Math.sin(S.t * 1.4 + i) * 8;
          ctx.save();
          const col = i % 2 === 0 ? "#ff4fd8" : "#4fd8ff";
          ctx.shadowColor = col; ctx.shadowBlur = 10;
          ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.moveTo(tx, ty - 8); ctx.lineTo(tx - 7, ty + 5); ctx.lineTo(tx + 7, ty + 5); ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }
        stars(14, "180,160,255");
      } else if (map.theme === "haunt") {
        // moon
        ctx.save();
        ctx.shadowColor = "#d8c9ff"; ctx.shadowBlur = 36;
        ctx.fillStyle = "#e6dcff";
        ctx.beginPath(); ctx.arc(CW * 0.35, vy0 + 62, 26, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        stars(14, "200,180,255");
        // bare trees + graves
        const tw2 = 210, off2 = ((camX * 0.24) % tw2 + tw2) % tw2;
        for (let i = -1; i < CW / tw2 + 2; i++) {
          const tx = i * tw2 - off2;
          ctx.strokeStyle = "#160b26"; ctx.lineWidth = 5; ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(tx + 30, bot); ctx.lineTo(tx + 34, bot - 70);
          ctx.moveTo(tx + 34, bot - 50); ctx.lineTo(tx + 54, bot - 78);
          ctx.moveTo(tx + 34, bot - 62); ctx.lineTo(tx + 18, bot - 84);
          ctx.stroke();
          ctx.fillStyle = "#1b1030";
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(tx + 110, bot - 34, 26, 34, [8, 8, 0, 0]);
          else ctx.rect(tx + 110, bot - 34, 26, 34);
          ctx.fill();
        }
        // drifting fog
        for (let i = 0; i < 4; i++) {
          const fx = ((i * 260 - camX * 0.15 + S.t * 18) % (CW + 200)) - 100;
          ctx.fillStyle = "rgba(150,130,190,0.10)";
          ctx.beginPath();
          ctx.ellipse(fx, bot - 22, 110, 16, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (map.theme === "sky") {
        // sun glow
        ctx.save();
        ctx.shadowColor = "#ffe9c0"; ctx.shadowBlur = 40;
        ctx.fillStyle = "#fff2d8";
        ctx.beginPath(); ctx.arc(CW * 0.7, vy0 + 56, 24, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // big cloud layers below/around
        for (let layer = 0; layer < 3; layer++) {
          const par = 0.15 + layer * 0.15;
          const cw2 = 300, off = ((camX * par - S.t * (6 + layer * 5)) % cw2 + cw2) % cw2;
          ctx.fillStyle = `rgba(230,240,255,${0.10 + layer * 0.05})`;
          for (let i = -1; i < CW / cw2 + 2; i++) {
            const cx = i * cw2 - off;
            const cy = vy0 + 150 + layer * 40 + (i * 31 % 30);
            ctx.beginPath();
            ctx.ellipse(cx, cy, 100, 18, 0, 0, Math.PI * 2);
            ctx.ellipse(cx + 60, cy + 8, 70, 14, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // distant birds
        for (let i = 0; i < 4; i++) {
          const bx = ((i * 260 - S.t * 40 - camX * 0.1) % (CW + 100) + CW + 100) % (CW + 100) - 50;
          const by = vy0 + 50 + (i * 43) % 70 + Math.sin(S.t * 3 + i) * 4;
          ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5;
          const fl = Math.sin(S.t * 8 + i) * 3;
          ctx.beginPath();
          ctx.moveTo(bx - 6, by - fl); ctx.lineTo(bx, by); ctx.lineTo(bx + 6, by - fl);
          ctx.stroke();
        }
      } else if (map.theme === "factory") {
        // chimneys + pipes silhouettes with blinking lights
        const fw = 220, off = ((camX * 0.22) % fw + fw) % fw;
        for (let i = -1; i < CW / fw + 2; i++) {
          const fx = i * fw - off;
          ctx.fillStyle = "#17130f";
          ctx.fillRect(fx + 20, bot - 120, 34, 120);
          ctx.fillRect(fx + 90, bot - 80, 60, 80);
          ctx.fillRect(fx + 60, bot - 46, 120, 12);
          // blinking light
          const blink = Math.sin(S.t * 3 + i * 2.4) > 0.5;
          if (blink) {
            ctx.save();
            ctx.shadowColor = "#ff5c3c"; ctx.shadowBlur = 8;
            ctx.fillStyle = "#ff6a4c";
            ctx.beginPath(); ctx.arc(fx + 37, bot - 124, 3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          }
          // rising smoke
          const sm = (S.t * 22 + i * 40) % 90;
          ctx.fillStyle = `rgba(120,110,100,${0.25 * (1 - sm / 90)})`;
          ctx.beginPath(); ctx.arc(fx + 37 + Math.sin(S.t + i) * 6, bot - 130 - sm, 8 + sm * 0.12, 0, Math.PI * 2); ctx.fill();
        }
        // drifting sparks
        for (let i = 0; i < 8; i++) {
          const ex = ((i * 173 - camX * 0.3) % CW + CW) % CW;
          const ey = bot - ((S.t * 20 + i * 47) % 120);
          ctx.save();
          ctx.shadowColor = "#ffb85c"; ctx.shadowBlur = 6;
          ctx.fillStyle = "rgba(255,190,110,0.6)";
          ctx.beginPath(); ctx.arc(ex, ey, 1.4, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      } else if (map.theme === "crystal") {
        stars(16, "170,190,255");
        // glowing crystal spikes
        const cw3 = 170, off = ((camX * 0.24) % cw3 + cw3) % cw3;
        for (let i = -1; i < CW / cw3 + 2; i++) {
          const cx = i * cw3 - off;
          const hues = ["#6ea8ff", "#b06eff", "#6effd8"];
          const col = hues[((i % 3) + 3) % 3];
          const pulse = 0.4 + 0.3 * Math.abs(Math.sin(S.t * 1.2 + i));
          ctx.save();
          ctx.shadowColor = col; ctx.shadowBlur = 14;
          ctx.fillStyle = "#171034";
          ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.moveTo(cx, bot);
          ctx.lineTo(cx + 26, bot - 90 - (i * 29 % 40));
          ctx.lineTo(cx + 52, bot);
          ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.globalAlpha = pulse;
          ctx.beginPath();
          ctx.moveTo(cx + 70, bot);
          ctx.lineTo(cx + 86, bot - 52);
          ctx.lineTo(cx + 102, bot);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }
        // twinkling sparkles
        for (let i = 0; i < 12; i++) {
          const sx = ((i * 151 - camX * 0.32) % CW + CW) % CW;
          const sy = vy0 + 40 + (i * 61) % 150;
          const a = Math.max(0, Math.sin(S.t * 3 + i * 2.2));
          ctx.save();
          ctx.shadowColor = "#cfe0ff"; ctx.shadowBlur = 8;
          ctx.fillStyle = `rgba(220,235,255,${a})`;
          ctx.beginPath(); ctx.arc(sx, sy, 1.6, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }
    };

    const themeCols = () => ({
      city: { g: "#232c47", top: "#5aa9ff", wall: "#2c3a5e", danger: "#ff5d7a" },
      jungle: { g: "#1e3a26", top: "#5dd48a", wall: "#2c5238", danger: "#ffb347" },
      volcano: { g: "#33201a", top: "#ff8a4c", wall: "#4a2c22", danger: "#ff5c1a" },
      ice: { g: "#2a3f55", top: "#a9e6ff", wall: "#39536e", danger: "#6ac8ff" },
      desert: { g: "#4a3418", top: "#ffd27a", wall: "#5c4423", danger: "#ff8f4a" },
      cyber: { g: "#141031", top: "#ff4fd8", wall: "#241a4e", danger: "#ff2f6d" },
      haunt: { g: "#221833", top: "#9d7aff", wall: "#31244a", danger: "#8aff6a" },
      sky: { g: "#3a5a86", top: "#cfe8ff", wall: "#4a6c9c", danger: "#ffd27a" },
      factory: { g: "#2e2a26", top: "#ffb85c", wall: "#3c3630", danger: "#ff6a3c" },
      crystal: { g: "#231a44", top: "#8fd0ff", wall: "#32265e", danger: "#ff6ad4" },
    }[map.theme]);

    const w2s = (camX, camY, vy0, x, y) => [x - camX, vy0 + (y - camY)];

    const drawWorld = (pov, vy0) => {
      const camX = pov.x - CW * 0.42;
      let camY = pov.y - 158;
      camY = Math.max(-260, Math.min(GY - VIEW_H + 96, camY));

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, vy0, CW, VIEW_H);
      ctx.clip();

      drawBackdrop(camX, camY, vy0);
      const C = themeCols();
      const P = (x, y) => w2s(camX, camY, vy0, x, y);

      if (map.theme === "volcano") {
        const [, lv] = P(0, GY + 130);
        if (lv < vy0 + VIEW_H) {
          const lg = ctx.createLinearGradient(0, lv, 0, vy0 + VIEW_H);
          lg.addColorStop(0, "#ff9a3c"); lg.addColorStop(1, "#c22a12");
          ctx.save();
          ctx.shadowColor = "#ff6a2c"; ctx.shadowBlur = 20;
          ctx.fillStyle = lg;
          ctx.fillRect(0, lv + Math.sin(S.t * 2) * 3, CW, vy0 + VIEW_H - lv + 10);
          ctx.restore();
        }
      }

      T.grounds.forEach((g2) => {
        if (g2.x1 < camX - 40 || g2.x0 > camX + CW + 40) return;
        const [x0, y0] = P(g2.x0, g2.y);
        const w = g2.x1 - g2.x0;
        ctx.fillStyle = C.g;
        ctx.fillRect(x0, y0, w, vy0 + VIEW_H - y0 + 20);
        ctx.save();
        ctx.shadowColor = C.top; ctx.shadowBlur = 6;
        ctx.fillStyle = C.top;
        ctx.fillRect(x0, y0, w, 3);
        ctx.restore();
      });

      T.walls.forEach((wl) => {
        if (wl.x < camX - 60 || wl.x > camX + CW + 60) return;
        const [x0, y0] = P(wl.x, wl.y);
        ctx.fillStyle = C.wall;
        ctx.fillRect(x0, y0, 26, wl.h);
        ctx.save();
        ctx.shadowColor = C.top; ctx.shadowBlur = 6;
        ctx.strokeStyle = C.top; ctx.lineWidth = 2;
        ctx.strokeRect(x0, y0, 26, wl.h);
        ctx.restore();
      });

      T.hurdles.forEach((hd) => {
        if (hd.x < camX - 40 || hd.x > camX + CW + 40) return;
        const [x0, y0] = P(hd.x, hd.y);
        ctx.save();
        ctx.shadowColor = C.danger; ctx.shadowBlur = 8;
        ctx.fillStyle = C.danger;
        ctx.fillRect(x0 - 7, y0 - 34, 14, 34);
        ctx.restore();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillRect(x0 - 7, y0 - 34, 14, 4);
      });

      T.bars.forEach((b) => {
        if (b.x < camX - 60 || b.x > camX + CW + 60) return;
        const [x0, y0] = P(b.x, b.y);
        ctx.save();
        ctx.shadowColor = "#ffd27a"; ctx.shadowBlur = 8;
        ctx.fillStyle = "#c9a05a";
        ctx.fillRect(x0 - 30, y0 - 58, 60, 10);
        ctx.restore();
        ctx.strokeStyle = "#c9a05a"; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x0 - 28, y0 - 52); ctx.lineTo(x0 - 28, y0);
        ctx.moveTo(x0 + 28, y0 - 52); ctx.lineTo(x0 + 28, y0);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.font = "10px monospace"; ctx.textAlign = "center";
        ctx.fillText("▼", x0, y0 - 38);
      });

      T.spikes.forEach((sp) => {
        if (sp.x + sp.w < camX - 40 || sp.x > camX + CW + 40) return;
        const [x0, y0] = P(sp.x, sp.y);
        ctx.save();
        ctx.shadowColor = C.danger; ctx.shadowBlur = 8;
        ctx.fillStyle = C.danger;
        ctx.beginPath();
        for (let sx = 0; sx < sp.w; sx += 18) {
          ctx.moveTo(x0 + sx, y0);
          ctx.lineTo(x0 + sx + 9, y0 - 16);
          ctx.lineTo(x0 + sx + 18, y0);
        }
        ctx.fill();
        ctx.restore();
      });

      T.springs.forEach((s2) => {
        if (s2.x < camX - 40 || s2.x > camX + CW + 40) return;
        const [x0, y0] = P(s2.x, s2.y);
        ctx.save();
        ctx.shadowColor = "#7dffb0"; ctx.shadowBlur = 10;
        ctx.fillStyle = "#7dffb0";
        ctx.fillRect(x0, y0 - 10, 40, 10);
        ctx.restore();
        ctx.strokeStyle = "#3aa06a"; ctx.lineWidth = 2;
        for (let zz = 0; zz < 3; zz++) {
          ctx.beginPath();
          ctx.moveTo(x0 + 6 + zz * 12, y0 - 2);
          ctx.lineTo(x0 + 12 + zz * 12, y0 - 8);
          ctx.stroke();
        }
      });

      T.checks.forEach((c) => {
        if (c.x < camX - 40 || c.x > camX + CW + 40) return;
        const [x0, y0] = P(c.x, c.y);
        const passed0 = S.players[0].checkpoint.x >= c.x;
        const passed1 = S.players[1].checkpoint.x >= c.x;
        ctx.strokeStyle = "#9aa5b5"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 - 74); ctx.stroke();
        ctx.save();
        const flagCol = passed0 && passed1 ? "#7dffb0" : passed0 ? "#3aa0ff" : passed1 ? "#ff3b4d" : "rgba(255,255,255,0.35)";
        ctx.shadowColor = flagCol; ctx.shadowBlur = 8;
        ctx.fillStyle = flagCol;
        const wave = Math.sin(S.t * 5 + c.x) * 3;
        ctx.beginPath();
        ctx.moveTo(x0, y0 - 74);
        ctx.lineTo(x0 + 26 + wave, y0 - 66);
        ctx.lineTo(x0, y0 - 58);
        ctx.fill();
        ctx.restore();
      });

      {
        const fx = T.finishX;
        if (!(fx < camX - 80 || fx > camX + CW + 80)) {
          const gy2 = groundAt(fx) ?? GY;
          const [x0, y0] = P(fx, gy2);
          ctx.strokeStyle = "#e8eef5"; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 - 130); ctx.stroke();
          const wave = Math.sin(S.t * 4) * 4;
          for (let ry = 0; ry < 3; ry++) {
            for (let rx = 0; rx < 5; rx++) {
              ctx.fillStyle = (rx + ry) % 2 === 0 ? "#e8eef5" : "#10141d";
              ctx.fillRect(x0 + rx * 10 + (ry * wave) / 3, y0 - 130 + ry * 10, 10, 10);
            }
          }
          ctx.save();
          ctx.shadowColor = "#ffe97a"; ctx.shadowBlur = 12;
          ctx.fillStyle = "#ffe97a"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center";
          ctx.fillText("FINISH", x0, y0 - 140);
          ctx.restore();
        }
      }

      T.ropes.forEach((r) => {
        if (r.ax < camX - 300 || r.ax > camX + CW + 300) return;
        const swingers = S.players.filter((pp) => pp.rope && Math.abs(pp.rope.ax - r.ax) < 1);
        const [ax0, ay0] = P(r.ax, r.ay);
        ctx.save();
        ctx.shadowColor = "#ffd27a"; ctx.shadowBlur = 8;
        ctx.fillStyle = "#ffd27a";
        ctx.beginPath(); ctx.arc(ax0, ay0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (swingers.length === 0) {
          const sway = Math.sin(S.t * 1.2 + r.ax) * 0.08;
          const ex = r.ax + Math.sin(sway) * r.len;
          const ey = r.ay + Math.cos(sway) * r.len;
          const [ex0, ey0] = P(ex, ey);
          ctx.strokeStyle = "#c9a05a"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(ax0, ay0);
          ctx.quadraticCurveTo(ax0 + Math.sin(sway) * r.len * 0.5, ay0 + r.len * 0.55, ex0, ey0);
          ctx.stroke();
          ctx.fillStyle = "#c9a05a";
          ctx.beginPath(); ctx.arc(ex0, ey0, 4, 0, Math.PI * 2); ctx.fill();
        } else {
          swingers.forEach((sw) => {
            const [hx, hyy] = P(sw.x, sw.y - 48);
            ctx.strokeStyle = "#c9a05a"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(ax0, ay0); ctx.lineTo(hx, hyy); ctx.stroke();
          });
        }
      });

      S.players.forEach((pl) => drawRacer(pl, P));

      S.particles.forEach((pt) => {
        const [x0, y0] = P(pt.x, pt.y);
        if (x0 < -20 || x0 > CW + 20) return;
        ctx.save();
        if (pt.glow) { ctx.shadowColor = pt.color; ctx.shadowBlur = 10; }
        ctx.globalAlpha = Math.max(0, pt.life / pt.max);
        ctx.fillStyle = pt.color;
        ctx.beginPath(); ctx.arc(x0, y0, pt.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      S.texts.forEach((tx) => {
        const [x0, y0] = P(tx.x, tx.y);
        if (x0 < -60 || x0 > CW + 60) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, tx.life / tx.max);
        ctx.shadowColor = tx.color; ctx.shadowBlur = 8;
        ctx.fillStyle = tx.color; ctx.font = "bold 14px monospace"; ctx.textAlign = "center";
        ctx.fillText(tx.str, x0, y0);
        ctx.restore();
      });

      // viewport HUD
      const opp = S.players[1 - pov.id];
      const dxOpp = opp.x - pov.x;
      if (Math.abs(dxOpp) > CW * 0.5) {
        const ahead = dxOpp > 0;
        const ix = ahead ? CW - 20 : 20;
        ctx.save();
        ctx.shadowColor = opp.neon; ctx.shadowBlur = 10;
        ctx.fillStyle = opp.neon; ctx.font = "bold 13px monospace";
        ctx.textAlign = ahead ? "right" : "left";
        ctx.fillText(`${ahead ? "" : "◀ "}P${opp.id + 1} ${Math.round(Math.abs(dxOpp) / 10)}m${ahead ? " ▶" : ""}`, ix, vy0 + 40);
        ctx.restore();
      }
      const pos = pov.x >= opp.x ? "1st" : "2nd";
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(10, vy0 + 8, 168, 22);
      ctx.shadowColor = pov.neon; ctx.shadowBlur = 8;
      ctx.fillStyle = pov.neon; ctx.font = "bold 12px monospace"; ctx.textAlign = "left";
      ctx.fillText(`P${pov.id + 1}`, 16, vy0 + 23);
      ctx.shadowBlur = 0;
      ctx.fillStyle = pos === "1st" ? "#ffe97a" : "#9aa5b5";
      ctx.fillText(pos, 46, vy0 + 23);
      ctx.fillStyle = "#fff";
      ctx.fillText(`⏱ ${S.raceT.toFixed(1)}s`, 82, vy0 + 23);
      ctx.restore();
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(CW - 150, vy0 + 8, 140, 18);
      ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1;
      ctx.strokeRect(CW - 150, vy0 + 8, 140, 18);
      ctx.save();
      const ready = pov.turbo >= TURBO_MIN && pov.turboT <= 0;
      ctx.shadowColor = ready ? "#7dffb0" : pov.neon; ctx.shadowBlur = 8;
      ctx.fillStyle = pov.turboT > 0 ? "#ffe97a" : ready ? "#7dffb0" : pov.neon;
      ctx.fillRect(CW - 148, vy0 + 10, 136 * pov.turbo, 14);
      ctx.restore();
      ctx.fillStyle = "#0a0f18"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center";
      ctx.fillText(pov.turboT > 0 ? "TURBO!!" : ready ? "TURBO READY" : "CHARGING…", CW - 80, vy0 + 20);

      ctx.restore();
    };

    const drawRacer = (p, P) => {
      p.trail.forEach((tr) => {
        const [tx0, ty0] = P(tr.x, tr.y);
        ctx.save();
        ctx.globalAlpha = (tr.life / tr.max) * 0.3;
        ctx.shadowColor = p.neon; ctx.shadowBlur = 8;
        ctx.strokeStyle = p.neon; ctx.lineWidth = 4;
        ctx.beginPath();
        if (tr.sliding) { ctx.moveTo(tx0 - 16, ty0 - 12); ctx.lineTo(tx0 + 14, ty0 - 8); }
        else { ctx.moveTo(tx0, ty0 - 34); ctx.lineTo(tx0, ty0 - 66); }
        ctx.stroke();
        ctx.restore();
      });

      const [x0, y0] = P(p.x, p.y);
      if (x0 < -60 || x0 > CW + 60) return;
      ctx.save();
      if (p.respawnT > 0) ctx.globalAlpha = 0.4 + 0.4 * Math.sin(S.t * 30);
      if (p.stumbleT > 0) ctx.globalAlpha = 0.6 + 0.4 * Math.sin(S.t * 50);

      ctx.strokeStyle = "#f4f7fb"; ctx.lineWidth = 5; ctx.lineCap = "round";
      const f = p.facing;

      if (p.sliding) {
        ctx.beginPath();
        ctx.moveTo(x0 - 16 * f, y0 - 8);
        ctx.lineTo(x0 + 10 * f, y0 - 14);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x0 + 10 * f, y0 - 14); ctx.lineTo(x0 + 22 * f, y0 - 4);
        ctx.moveTo(x0 - 16 * f, y0 - 8); ctx.lineTo(x0 - 26 * f, y0 - 2);
        ctx.stroke();
        ctx.save();
        ctx.shadowColor = p.neon; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(x0 + 18 * f, y0 - 22, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = p.neon; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x0 + 18 * f, y0 - 22, 10, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        ctx.restore();
      } else if (p.rope) {
        const hipY = y0 - 34, neckY = y0 - 62, headY = y0 - 74;
        ctx.beginPath();
        ctx.moveTo(x0, hipY); ctx.lineTo(x0 - 8, y0 - 6);
        ctx.moveTo(x0, hipY); ctx.lineTo(x0 + 8, y0 - 2);
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x0, hipY); ctx.lineTo(x0, neckY); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x0, neckY); ctx.lineTo(x0 - 4, y0 - 46);
        ctx.moveTo(x0, neckY); ctx.lineTo(x0 + 4, y0 - 46);
        ctx.stroke();
        ctx.save();
        ctx.shadowColor = p.neon; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(x0, headY, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = p.neon; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x0, headY, 10, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        ctx.restore();
      } else {
        const hipY = y0 - 34, neckY = y0 - 64, headY = y0 - 76;
        ctx.beginPath();
        if (!p.onGround) {
          if (p.wallDir !== 0) {
            ctx.moveTo(x0, hipY); ctx.lineTo(x0 - p.wallDir * 10, y0 - 8);
            ctx.moveTo(x0, hipY); ctx.lineTo(x0 - p.wallDir * 4, y0 - 4);
          } else {
            ctx.moveTo(x0, hipY); ctx.lineTo(x0 - 9 * f, y0 - 10);
            ctx.moveTo(x0, hipY); ctx.lineTo(x0 + 12 * f, y0 - 4);
          }
        } else {
          const lp = Math.sin(p.runPhase) * 15;
          ctx.moveTo(x0, hipY); ctx.lineTo(x0 - 8 + lp * 0.7 * f, y0);
          ctx.moveTo(x0, hipY); ctx.lineTo(x0 + 8 - lp * 0.7 * f, y0);
        }
        ctx.stroke();
        const nx = x0 + p.vx / 900 * 16;
        ctx.beginPath(); ctx.moveTo(x0, hipY); ctx.lineTo(nx, neckY); ctx.stroke();
        const ap = Math.sin(p.runPhase + Math.PI) * 12;
        ctx.beginPath();
        ctx.moveTo(nx, neckY + 4); ctx.lineTo(nx + (8 + ap * 0.5) * f, neckY + 16);
        ctx.moveTo(nx, neckY + 4); ctx.lineTo(nx - (8 - ap * 0.5) * f, neckY + 16);
        ctx.stroke();
        ctx.save();
        ctx.shadowColor = p.neon; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(nx, headY, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = p.neon; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(nx, headY, 10, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        ctx.restore();
      }

      if (p.finished) {
        ctx.save();
        ctx.shadowColor = "#ffe97a"; ctx.shadowBlur = 10;
        ctx.fillStyle = "#ffe97a"; ctx.font = "bold 13px monospace"; ctx.textAlign = "center";
        ctx.fillText("🏁", x0, y0 - 96);
        ctx.restore();
      }
      ctx.restore();
    };

    const drawStrip = () => {
      ctx.fillStyle = "#0a0e18";
      ctx.fillRect(0, STRIP_Y, CW, STRIP_H);
      ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, STRIP_Y + 0.5); ctx.lineTo(CW, STRIP_Y + 0.5);
      ctx.moveTo(0, STRIP_Y + STRIP_H - 0.5); ctx.lineTo(CW, STRIP_H + STRIP_Y - 0.5);
      ctx.stroke();
      const x0 = 60, x1 = CW - 60, mid = STRIP_Y + STRIP_H / 2;
      ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x0, mid); ctx.lineTo(x1, mid); ctx.stroke();
      T.checks.forEach((c) => {
        const tx = x0 + (c.x / T.finishX) * (x1 - x0);
        ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(tx, mid - 5); ctx.lineTo(tx, mid + 5); ctx.stroke();
      });
      ctx.fillStyle = "#ffe97a"; ctx.font = "11px monospace"; ctx.textAlign = "center";
      ctx.fillText("🏁", x1 + 14, mid + 4);
      S.players.forEach((p) => {
        const px = x0 + Math.min(1, p.x / T.finishX) * (x1 - x0);
        ctx.save();
        ctx.shadowColor = p.neon; ctx.shadowBlur = 8;
        ctx.fillStyle = p.neon;
        ctx.beginPath(); ctx.arc(px, mid + (p.id === 0 ? -1 : 1) * 4, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
    };

    let raf, last = performance.now();
    let snapAcc = 0, sendAcc = 0;
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;

      if (pausedRef?.current) {
        raf = requestAnimationFrame(loop);
        return;
      }

      if (isHost) {
        // Guest inputs arrive remapped into p2 key codes via applyRemoteKeys
        Object.values(KEYS.p2).forEach(code => {
          S.keys[code] = !!remoteHeld[code];
        });

        S.t += dt;

        if (S.mode === "countdown") {
          S.modeT += dt;
          const n = Math.ceil(3 - S.modeT);
          if (n !== S.lastBeep && n >= 0) { S.lastBeep = n; SFX.beep(n === 0); }
          if (S.modeT >= 3) { S.mode = "race"; }
        } else if (S.mode === "race") {
          S.raceT += dt;
        }

        S.players.forEach((p) => updateRacer(p, dt));

        S.particles = S.particles.filter((pt) => {
          pt.life -= dt;
          pt.vy += (pt.grav === undefined ? 1 : pt.grav) * 900 * dt;
          pt.x += pt.vx * dt; pt.y += pt.vy * dt;
          return pt.life > 0;
        });
        S.texts = S.texts.filter((tx) => { tx.life -= dt; tx.y += tx.vy * dt; tx.vy *= 0.94; return tx.life > 0; });

        snapAcc += dt;
        if (snapAcc >= 0.05) {
          snapAcc = 0;
          rt?.send({
            k: 'sr-st',
            players: S.players.map(p => ({
              ...p,
              trail: (p.trail || []).slice(-6),
              rope: p.rope ? { ax: p.rope.ax, ay: p.rope.ay, len: p.rope.len } : null,
            })),
            mode: S.mode, modeT: S.modeT, raceT: S.raceT, t: S.t, done: S.done,
            particles: S.particles.slice(0, 36),
            texts: S.texts.slice(0, 8),
          });
        }
      } else {
        // guest: stream inputs ~30Hz
        sendAcc += dt;
        if (sendAcc >= 0.033) {
          sendAcc = 0;
          const held = {};
          LOCAL_CODES.forEach(c => { if (remoteHeld[c]) held[c] = true; });
          const edge = edgeBuf.splice(0);
          rt?.send({ k: 'sr-in', held, edge });
        }
      }

      ctx.clearRect(0, 0, CW, CH);
      drawWorld(S.players[0], 0);
      drawWorld(S.players[1], STRIP_Y + STRIP_H);
      drawStrip();

      if (S.mode === "countdown") {
        const n = Math.ceil(3 - S.modeT);
        ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(0, 0, CW, CH);
        ctx.save();
        ctx.shadowColor = "#fff"; ctx.shadowBlur = 22;
        ctx.fillStyle = "#fff"; ctx.font = "bold 90px monospace"; ctx.textAlign = "center";
        ctx.fillText(n > 0 ? n : "GO!", CW / 2, CH / 2 + 20);
        ctx.restore();
        ctx.font = "15px monospace"; ctx.fillStyle = "#fff";
        ctx.fillText(MAPS[mi].name, CW / 2, CH / 2 + 60);
      }
      const fin = S.players.find((p) => p.finished);
      if (fin) {
        ctx.save();
        ctx.shadowColor = fin.neon; ctx.shadowBlur = 22;
        ctx.fillStyle = fin.neon; ctx.font = "bold 44px monospace"; ctx.textAlign = "center";
        ctx.fillText(`P${fin.id + 1} FINISHES — ${fin.finishTime.toFixed(2)}s`, CW / 2, CH / 2);
        ctx.restore();
      }

      S.pressed = {};
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [phase, isHost, mySlot, rt, onComplete, pausedRef]);

  // ================= UI =================
  const wrap = {
    width: "100%", maxWidth: 960, margin: "0 auto", background: "transparent", color: "#e8eef5",
    display: "flex", flexDirection: "column", alignItems: "center",
    fontFamily: "monospace", padding: "8px 8px 12px", boxSizing: "border-box",
  };
  const neonText = (color) => ({ color, textShadow: `0 0 12px ${color}` });

  if (phase === "menu" || phase === "matchEnd") {
    return (
      <div className="sr-shell" style={wrap}>
        <h1 style={{ letterSpacing: 5, margin: "12px 0 2px", fontSize: 28 }}>
          <span style={neonText("#3aa0ff")}>STICKMAN</span>{" "}
          <span style={{ opacity: 0.9 }}>🏁</span>{" "}
          <span style={neonText("#ff3b4d")}>RACING</span>
        </h1>
        <p style={{ opacity: 0.65, marginTop: 4, textAlign: "center" }}>
          10 tracks · online duel · first to the flag
        </p>
        <p style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
          <span style={neonText("#3aa0ff")}>{p1Name}</span>
          {" vs "}
          <span style={neonText("#ff3b4d")}>{p2Name}</span>
          {isHost ? " · you pick the track" : " · waiting for host to pick"}
        </p>

        {phase === "matchEnd" && result && (
          <div style={{
            margin: "8px 0 16px", padding: "14px 36px", borderRadius: 10,
            background: result.winner === 1 ? "rgba(58,160,255,0.12)" : "rgba(255,59,77,0.12)",
            border: `2px solid ${result.winner === 1 ? "#3aa0ff" : "#ff3b4d"}`,
            boxShadow: `0 0 24px ${result.winner === 1 ? "rgba(58,160,255,0.35)" : "rgba(255,59,77,0.35)"}`,
            fontSize: 20, fontWeight: "bold", textAlign: "center",
          }}>
            🏆 {(result.winner === 1 ? p1Name : p2Name)} WINS — {result.time.toFixed(2)}s
            <div style={{ fontSize: 13, opacity: 0.75, fontWeight: "normal", marginTop: 4 }}>
              rival was {result.gap}m behind
            </div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6, fontWeight: "normal" }}>
              Use Rematch in the shell for another race.
            </div>
          </div>
        )}

        <p style={{ marginBottom: 8, opacity: 0.85 }}>
          {isHost ? "Pick a track (roughly easiest → hardest):" : "Host is choosing a track…"}
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", maxWidth: 940 }}>
          {MAPS.map((m, i) => (
            <button key={m.name} onClick={() => startRace(i)} disabled={!isHost}
              style={{
                cursor: isHost ? "pointer" : "default", width: 168, padding: 0, borderRadius: 10, overflow: "hidden",
                border: "2px solid rgba(255,255,255,0.18)", background: "#10141d", color: "#e8eef5",
                fontFamily: "monospace", transition: "transform .15s, box-shadow .15s",
                opacity: isHost ? 1 : 0.55,
              }}
              onMouseEnter={(e) => { if (!isHost) return; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(120,180,255,0.25)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
              <div style={{ height: 70, background: `linear-gradient(${m.card.top}, ${m.card.bot})`, position: "relative" }}>
                <div style={{ position: "absolute", top: 6, left: 8, fontSize: 18 }}>{m.card.emoji}</div>
                <div style={{ position: "absolute", bottom: 10, left: 12, right: 12, height: 4, background: m.card.acc, borderRadius: 2, boxShadow: `0 0 10px ${m.card.acc}` }} />
                <div style={{ position: "absolute", bottom: 10, right: 10, fontSize: 11 }}>🏁</div>
              </div>
              <div style={{ padding: "8px 0 2px", fontWeight: "bold", letterSpacing: 0.5, fontSize: 13 }}>{m.name}</div>
              <div style={{ padding: "0 6px 9px", fontSize: 9, opacity: 0.55 }}>{m.desc}</div>
            </button>
          ))}
        </div>

        <div style={{
          marginTop: 16, fontSize: 13, lineHeight: 1.85, background: "#10141d", padding: "14px 22px",
          borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", textAlign: "center", maxWidth: 520,
        }}>
          <b style={neonText(myRole === 'A' ? "#3aa0ff" : "#ff3b4d")}>
            You are {myRole === 'A' ? p1Name : p2Name} ({myRole === 'A' ? 'top' : 'bottom'} screen)
          </b><br />
          A / D — run · W — jump · S — slide · <b>F — TURBO</b>
        </div>

        <button onClick={() => setMuted((m) => !m)}
          style={{ marginTop: 14, cursor: "pointer", background: "none", border: "1px solid rgba(255,255,255,0.25)", color: "#e8eef5", borderRadius: 6, padding: "5px 14px", fontFamily: "monospace", fontSize: 12 }}>
          {muted ? "🔇 sound off" : "🔊 sound on"}
        </button>
      </div>
    );
  }

  const myKeys = KEYS[mySlot];
  const myColor = mySlot === 'p1' ? "#3aa0ff" : "#ff3b4d";
  const press = (code, d) => (e) => {
    e.preventDefault();
    if (stateRef.current.setKey) stateRef.current.setKey(code, d);
  };
  const TouchBtn = ({ label, code, color, style, size = 54 }) => (
    <div
      onTouchStart={press(code, true)}
      onTouchEnd={press(code, false)}
      onTouchCancel={press(code, false)}
      onPointerDown={press(code, true)}
      onPointerUp={press(code, false)}
      onPointerCancel={press(code, false)}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "absolute", width: size, height: size, borderRadius: "50%",
        border: `2px solid ${color}`, background: "rgba(10,14,24,0.5)",
        color: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, fontWeight: "bold", userSelect: "none", WebkitUserSelect: "none",
        touchAction: "none", boxShadow: `0 0 12px ${color}66`, zIndex: 5, ...style,
      }}
    >{label}</div>
  );

  const padTop = mySlot === 'p1' ? "26%" : "77%";
  const padJump = mySlot === 'p1' ? "16%" : "67%";
  const padSlide = mySlot === 'p1' ? "29%" : "80%";

  return (
    <div className="sr-shell" style={wrap}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "4px 0 10px", flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ opacity: 0.7, fontSize: 13 }}>{MAPS[mapIdx].name} · first to the flag 🏁</span>
        <button onClick={() => setMuted((m) => !m)}
          style={{ cursor: "pointer", background: "none", border: "1px solid rgba(255,255,255,0.3)", color: "#e8eef5", borderRadius: 6, padding: "4px 10px", fontFamily: "monospace", fontSize: 12 }}>
          {muted ? "🔇" : "🔊"}
        </button>
        <button onClick={() => { setPhase("menu"); rt?.send({ k: 'sr-menu' }); }}
          style={{ cursor: "pointer", background: "none", border: "1px solid rgba(255,255,255,0.3)", color: "#e8eef5", borderRadius: 6, padding: "4px 12px", fontFamily: "monospace", fontSize: 12 }}>
          quit to menu
        </button>
      </div>
      <div style={{ position: "relative", width: "100%", maxWidth: CW }}>
        <canvas ref={canvasRef} width={CW} height={CH}
          style={{ width: "100%", display: "block", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "#000", boxShadow: "0 0 40px rgba(80,140,255,0.12)" }} />
        {touchUI && (
          <>
            <TouchBtn label="◀" code={myKeys.left} color={myColor} style={{ left: 10, top: padTop }} />
            <TouchBtn label="▶" code={myKeys.right} color={myColor} style={{ left: 74, top: padTop }} />
            <TouchBtn label="⭡" code={myKeys.jump} color={myColor} style={{ right: 74, top: padJump }} />
            <TouchBtn label="⭣" code={myKeys.slide} color={myColor} style={{ right: 138, top: padSlide }} />
            <TouchBtn label="🔥" code={myKeys.turbo} color="#ffe97a" style={{ right: 10, top: padSlide }} />
          </>
        )}
      </div>
      <p style={{ opacity: 0.5, fontSize: 12, marginTop: 8, textAlign: "center" }}>
        You control the {mySlot === 'p1' ? 'blue (top)' : 'pink (bottom)'} racer · WASD + F turbo
      </p>
    </div>
  );
}
