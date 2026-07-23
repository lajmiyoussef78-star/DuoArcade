import React, { useRef, useEffect, useState } from "react";

// ============ STICKMAN MOTO RACE 🏍️ — NEON EDITION v4 · 10 TRACKS ============
// Split-screen motorcycle duel. Acrobatic rails: LOOPS, DOUBLE-LOOP corkscrews,
// and the GRAND 8 (two overlapping rings ridden as an ∞ with an LED charge pad
// between them). Whoops rhythm bumps, step-up jumps, mega-air drop jumps,
// mega-drops, moving platforms, spikes, boost pads. Full LED visual kit:
// marching track dashes, loop chase lights, bike underglow + headlight.
//
//   P1 (top):    D gas (hold in AIR = 🛡️ stabilize) · A brake/reverse · W tap=HOP hold=flip · S lean fwd
//   P2 (bottom): → gas (air = stabilize) · ← brake/reverse · ↑ tap=HOP hold=flip · ↓ lean fwd

const CW = 900, CH = 520;
const VIEW_H = 244;
const STRIP_Y = VIEW_H, STRIP_H = 32;
const GYB = 420;
const GRAV = 1500;
const MAX_V = 540, ACCEL = 620, BRAKE = 900, DRAG = 0.28;
const SLOPE_G = 950;
const ROT_SPD = 5.2;
const LOOP_MIN_V = 330;
const RAIL_FRICTION = 90;
const CRASH_ANGLE = 1.35;
const DEATH_Y = GYB + 600;

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
    putt: (v) => tone(52 + v * 0.16, 0.06, "sawtooth", 0.045),
    hop: () => tone(300, 0.12, "sine", 0.12, 240),
    land: () => noise(0.09, 320, 0.2, 0.8),
    boost: () => { noise(0.3, 1100, 0.22, 0.8); tone(220, 0.3, "sawtooth", 0.12, 340); },
    trick: (n) => [660, 880, 1100].slice(0, Math.min(3, n)).forEach((f, i) => tone(f, 0.14, "square", 0.14, 0, i * 0.09)),
    crash: () => { noise(0.35, 400, 0.45, 0.7); tone(90, 0.3, "square", 0.25, -50); },
    loopIn: () => tone(300, 0.25, "sine", 0.15, 500),
    loopOut: () => tone(800, 0.2, "sine", 0.15, -300),
    grand8: () => [523, 784, 1046, 1568].forEach((f, i) => tone(f, 0.2, "triangle", 0.16, 0, i * 0.1)),
    check: () => { tone(880, 0.1, "square", 0.14); tone(1320, 0.12, "square", 0.12, 0, 0.09); },
    beep: (final) => tone(final ? 880 : 440, 0.14, "square", 0.16),
    finish: () => [523, 659, 784, 1046, 1319].forEach((f, i) => tone(f, 0.28, "triangle", 0.2, 0, i * 0.12)),
  };
}
const SFX = makeSFX();

// ---------------- TRACK BUILDER ----------------
function builder() {
  const B = {
    x: 0, y: GYB,
    segs: [], loops: [], plats: [], spikes: [], boosts: [], checks: [], finishX: 0,
  };
  const seg = (len, dy, gap = false) => {
    B.segs.push({ x0: B.x, x1: B.x + len, y0: B.y, y1: B.y + dy, gap });
    B.x += len; B.y += dy;
  };
  const api = {
    flat(len) { seg(len, 0); return api; },
    slope(len, dy) { seg(len, dy); return api; },
    hill(len, h) { seg(len / 2, -h); seg(len / 2, h); return api; },
    valley(len, d) { seg(len / 2, d); seg(len / 2, -d); return api; },
    jump(gapLen, h = 90, rampLen = 150) {
      // Keep gaps clearable at normal race speed
      const gap = Math.min(gapLen, 250);
      seg(Math.max(rampLen, 155), -h);
      seg(gap, 0, true);
      seg(190, h + 10);
      return api;
    },
    // land HIGHER than you took off
    stepJump(gapLen, h = 100, rise = 70) {
      const gap = Math.min(gapLen, 230);
      seg(155, -h);
      seg(gap, 0, true);
      seg(185, h - rise);
      return api;
    },
    // land LOWER — huge airtime
    dropJump(gapLen, h = 80, fall = 90) {
      const gap = Math.min(gapLen, 240);
      seg(145, -h);
      seg(gap, 0, true);
      seg(200, h + fall);
      return api;
    },
    megaDrop(d = 150, len = 150) { seg(len, d); return api; },
    whoops(n = 4, w = 110, h = 22) {
      for (let i = 0; i < n; i++) { seg(w / 2, -h); seg(w / 2, h); }
      return api;
    },
    gapFlat(len) {
      // Ignore degenerate seams like gapFlat(0)
      if (len > 1) seg(len, 0, true);
      return api;
    },
    loop(r = 92, tag = null) {
      api.flat(70);
      B.loops.push({ cx: B.x, cy: B.y - r, r, entryX: B.x, exitX: B.x + 26, turns: 1, tag });
      api.flat(150);
      return api;
    },
    // two full revolutions on the same ring
    corkscrew(r = 96) {
      api.flat(70);
      B.loops.push({ cx: B.x, cy: B.y - r, r, entryX: B.x, exitX: B.x + 26, turns: 2, tag: "DOUBLE LOOP!" });
      api.flat(160);
      return api;
    },
    // GRAND 8: two overlapping rings ridden back-to-back (∞), LED charge pad between
    eight(r = 88) {
      api.flat(70);
      B.loops.push({ cx: B.x, cy: B.y - r, r, entryX: B.x, exitX: B.x + 22, turns: 1, tag: null });
      const gap2 = Math.round(r * 1.15);
      B.boosts.push({ x: B.x + Math.round(gap2 / 2) });   // charge pad keeps speed up for ring two
      api.flat(gap2);
      B.loops.push({ cx: B.x, cy: B.y - r, r, entryX: B.x, exitX: B.x + 26, turns: 1, tag: "GRAND 8!" });
      api.flat(170);
      return api;
    },
    plat(len, amp = 55, speed = 1.3) {
      // Full-width deck — no invisible end holes; cap amp so bridges stay mountable
      B.plats.push({
        x0: B.x,
        x1: B.x + len,
        y: B.y,
        amp: Math.min(amp, 58),
        speed,
        phase: (B.x * 0.013) % 6,
      });
      seg(len, 0, true);
      return api;
    },
    spikes(w = 90, pad = 60) {
      api.flat(pad);
      B.spikes.push({ x: B.x, w });
      api.flat(w + pad);
      return api;
    },
    boost(pad = 40) { api.flat(pad); B.boosts.push({ x: B.x + 24 }); api.flat(60); return api; },
    check() {
      // Always plant the flag on solid ground just ahead of a gap edge
      const last = B.segs[B.segs.length - 1];
      if (last && last.gap) api.flat(40);
      B.checks.push({ x: B.x, y: B.y });
      return api;
    },
    finish() { api.flat(500); B.finishX = B.x - 300; api.flat(360); return api; },
    build() { return B; },
  };
  return api;
}

// ---------------- 10 MAPS ----------------
const MAPS = [
  {
    name: "Sunny Hills", desc: "rolling marathon · loops & meadows", theme: "sunny",
    card: { top: "#3a86d4", bot: "#9ed3ff", acc: "#7dff9a", emoji: "🌄" },
    make: () => builder()
      .flat(520).hill(320, 60).boost().hill(360, 90).valley(320, 60).check()
      .jump(220, 90).flat(170).spikes(90).flat(130).boost().hill(340, 80).check()
      .loop(90).flat(170).valley(300, 70).boost().jump(240, 100).flat(170).check()
      .spikes(100).flat(120).hill(360, 90).boost().plat(280, 50, 1.2).flat(190).check()
      .jump(260, 110).flat(170).boost().loop(95).flat(180).hill(320, 70).check()
      .valley(320, 70).spikes(90).flat(120).boost().jump(240, 100).flat(180).check()
      .plat(300, 55, 1.3).flat(180).hill(340, 80).boost().valley(300, 60).check()
      .loop(92).flat(160).spikes(100).flat(120).boost().jump(260, 110).flat(180).check()
      .hill(360, 90).boost().plat(280, 60, 1.4).flat(180).valley(320, 70).check()
      .jump(280, 115, 160).flat(170).boost().loop(96).flat(170).spikes(90).flat(120).check()
      .hill(340, 80).valley(300, 60).boost().jump(240, 100).flat(180).check()
      .plat(300, 55, 1.3).flat(170).boost().hill(360, 90).flat(240)
      .finish().build(),
  },
  {
    name: "Canyon Rush", desc: "mega jumps · moving bridges", theme: "canyon",
    card: { top: "#8a3a12", bot: "#e0975c", acc: "#ffd27a", emoji: "🏜️" },
    make: () => builder()
      .flat(500).hill(300, 70).boost().jump(260, 100).flat(160).check()
      .spikes(100).flat(110).plat(280, 65, 1.4).flat(180).boost().check()
      .jump(300, 120, 170).flat(170).valley(300, 80).boost().hill(320, 80).check()
      .loop(95).flat(160).spikes(110).flat(120).boost().jump(260, 105).flat(160).check()
      .plat(300, 70, 1.5).flat(160).boost().hill(340, 90).spikes(90).flat(120).check()
      .jump(320, 130, 180).flat(170).boost().valley(320, 80).spikes(100).flat(120).check()
      .plat(520, 60, 1.7).flat(190).boost().check()
      .hill(320, 85).jump(280, 110).flat(160).spikes(110).flat(120).boost().check()
      .loop(98).flat(160).plat(300, 70, 1.5).flat(170).boost().jump(300, 120, 170).flat(170).check()
      .valley(320, 80).spikes(100).flat(110).boost().hill(340, 90).check()
      .jump(340, 135, 185).flat(170).boost().plat(280, 65, 1.6).flat(180).spikes(90).flat(120).check()
      .hill(320, 80).boost().jump(280, 110).flat(180).valley(300, 70).flat(230)
      .finish().build(),
  },
  {
    name: "Loop Land", desc: "loop mania · candy chaos", theme: "candy",
    card: { top: "#3a1060", bot: "#8a3ac0", acc: "#ff6ad4", emoji: "🎢" },
    make: () => builder()
      .flat(500).boost().loop(85).flat(170).hill(300, 70).check()
      .boost().loop(95).flat(160).jump(240, 100).flat(160).check()
      .spikes(90).flat(110).boost().loop(105).flat(180).valley(300, 70).check()
      .plat(280, 60, 1.4).flat(170).boost().jump(260, 105).flat(160).check()
      .loop(90).flat(110).loop(90).flat(190).boost().hill(320, 80).check()
      .jump(280, 120).flat(160).spikes(100).flat(110).boost().loop(100).flat(170).check()
      .plat(300, 70, 1.6).flat(160).boost().valley(320, 75).jump(260, 105).flat(160).check()
      .loop(94).flat(150).spikes(90).flat(110).boost().hill(340, 85).check()
      .boost().loop(88).flat(120).loop(96).flat(180).jump(280, 115).flat(160).check()
      .plat(280, 65, 1.5).flat(170).boost().spikes(100).flat(110).loop(102).flat(170).check()
      .hill(320, 85).boost().jump(300, 120, 170).flat(170).loop(92).flat(160).check()
      .valley(300, 70).boost().loop(96).flat(160).spikes(90).flat(120).hill(320, 80).flat(230)
      .finish().build(),
  },
  {
    name: "Neon Freeway", desc: "synthwave sprint · GRAND 8 debut", theme: "synth",
    card: { top: "#1a0533", bot: "#4a1070", acc: "#ff4fd8", emoji: "🌆" },
    make: () => builder()
      .flat(500).boost().whoops(4).flat(140).hill(300, 70).check()
      .jump(240, 100).flat(160).boost().corkscrew(94).flat(150).check()
      .spikes(90).flat(110).boost().stepJump(220, 100, 70).flat(160).check()
      .boost().eight(86).flat(150).valley(300, 70).check()
      .whoops(5).flat(120).boost().jump(260, 105).flat(160).check()
      .plat(280, 60, 1.4).flat(160).boost().loop(96).flat(160).check()
      .dropJump(260, 80, 90).flat(150).spikes(100).flat(110).boost().check()
      .corkscrew(90).flat(150).hill(320, 80).check()
      .boost().eight(90).flat(150).jump(240, 100).flat(150).check()
      .megaDrop(150, 150).flat(140).boost().stepJump(240, 105, 75).flat(150).check()
      .whoops(4).spikes(90).flat(110).boost().loop(100).flat(150).check()
      .valley(300, 70).boost().jump(280, 110).flat(180).flat(200)
      .finish().build(),
  },
  {
    name: "Deep Neon Sea", desc: "flow rider · glowing depths", theme: "sea",
    card: { top: "#031425", bot: "#0d3a5e", acc: "#4fd8ff", emoji: "🌊" },
    make: () => builder()
      .flat(500).hill(340, 80).valley(340, 80).boost().hill(320, 70).check()
      .loop(92).flat(150).whoops(4).flat(130).boost().check()
      .jump(250, 100).flat(160).boost().eight(88).flat(150).check()
      .valley(320, 75).hill(320, 75).boost().plat(280, 55, 1.3).flat(170).check()
      .dropJump(270, 80, 95).flat(150).boost().corkscrew(92).flat(150).check()
      .whoops(5).flat(120).spikes(90).flat(110).boost().check()
      .hill(340, 85).valley(340, 85).boost().loop(96).flat(150).check()
      .stepJump(230, 100, 70).flat(150).boost().plat(300, 65, 1.4).flat(160).check()
      .eight(90).flat(150).whoops(4).flat(130).boost().check()
      .megaDrop(150, 150).flat(140).spikes(100).flat(110).boost().jump(260, 105).flat(150).check()
      .valley(320, 75).boost().corkscrew(88).flat(150).hill(320, 75).check()
      .boost().loop(94).flat(150).jump(280, 110).flat(170).flat(200)
      .finish().build(),
  },
  {
    name: "Voltage Plant", desc: "high-voltage rhythm · spark alley", theme: "voltage",
    card: { top: "#131316", bot: "#33322c", acc: "#ffe45c", emoji: "⚡" },
    make: () => builder()
      .flat(500).whoops(5).flat(130).boost().jump(240, 95).flat(160).check()
      .spikes(100).flat(110).plat(260, 60, 1.5).flat(170).boost().check()
      .corkscrew(90).flat(150).whoops(4).flat(130).check()
      .spikes(90).flat(110).boost().stepJump(220, 100, 70).flat(150).check()
      .plat(280, 65, 1.6).flat(160).boost().loop(94).flat(150).check()
      .whoops(5).spikes(100).flat(110).boost().jump(260, 105).flat(150).check()
      .megaDrop(150, 150).flat(140).boost().eight(88).flat(150).check()
      .spikes(110).flat(110).plat(300, 70, 1.5).flat(160).boost().check()
      .dropJump(260, 80, 90).flat(150).whoops(4).flat(120).boost().check()
      .corkscrew(94).flat(150).spikes(90).flat(110).boost().check()
      .stepJump(240, 105, 75).flat(150).boost().plat(280, 60, 1.7).flat(160).check()
      .hill(320, 80).boost().jump(280, 110).flat(170).flat(210)
      .finish().build(),
  },
  {
    name: "Laser Jungle", desc: "neon vines · twin GRAND 8s", theme: "laserjungle",
    card: { top: "#03140a", bot: "#0d3a1e", acc: "#5dff8a", emoji: "🌴" },
    make: () => builder()
      .flat(500).hill(300, 70).boost().jump(240, 95).flat(160).check()
      .whoops(4).flat(130).boost().eight(86).flat(150).check()
      .spikes(100).flat(110).plat(280, 60, 1.4).flat(170).boost().check()
      .loop(94).flat(150).valley(300, 70).check()
      .stepJump(220, 100, 70).flat(150).boost().whoops(4).flat(130).check()
      .spikes(90).flat(110).boost().corkscrew(90).flat(150).check()
      .dropJump(260, 80, 90).flat(150).boost().plat(300, 65, 1.5).flat(160).check()
      .hill(320, 80).spikes(100).flat(110).boost().jump(260, 105).flat(150).check()
      .boost().eight(92).flat(150).whoops(5).flat(120).check()
      .megaDrop(150, 150).flat(140).boost().loop(98).flat(150).check()
      .plat(280, 60, 1.6).flat(160).spikes(90).flat(110).boost().stepJump(230, 100, 70).flat(150).check()
      .valley(300, 70).boost().jump(280, 110).flat(170).flat(210)
      .finish().build(),
  },
  {
    name: "Aurora Peaks", desc: "icy mega-drops · sky ribbons", theme: "aurora",
    card: { top: "#03101f", bot: "#12365c", acc: "#7de8ff", emoji: "🌌" },
    make: () => builder()
      .flat(500).hill(320, 80).boost().whoops(4).flat(140).check()
      .megaDrop(150, 150).flat(150).boost().jump(260, 105).flat(160).check()
      .stepJump(230, 105, 75).flat(150).spikes(90).flat(110).boost().check()
      .corkscrew(92).flat(150).valley(320, 75).check()
      .dropJump(280, 85, 100).flat(150).boost().plat(280, 60, 1.4).flat(170).check()
      .whoops(5).flat(120).boost().loop(96).flat(160).check()
      .megaDrop(160, 150).flat(140).spikes(100).flat(110).boost().check()
      .eight(88).flat(150).hill(320, 80).check()
      .stepJump(240, 110, 80).flat(150).boost().jump(260, 105).flat(150).check()
      .plat(300, 70, 1.5).flat(160).boost().dropJump(260, 80, 95).flat(150).check()
      .whoops(4).boost().corkscrew(96).flat(150).spikes(90).flat(110).check()
      .valley(300, 70).boost().jump(280, 110).flat(170).flat(210)
      .finish().build(),
  },
  {
    name: "Galaxy Run", desc: "GRAND 8 paradise · cosmic air", theme: "galaxy",
    card: { top: "#0a0318", bot: "#2c1055", acc: "#b08cff", emoji: "🪐" },
    make: () => builder()
      .flat(500).boost().eight(84).flat(150).hill(300, 70).check()
      .dropJump(280, 85, 100).flat(150).boost().corkscrew(92).flat(150).check()
      .whoops(4).flat(130).boost().eight(88).flat(150).check()
      .spikes(90).flat(110).stepJump(230, 105, 75).flat(150).boost().check()
      .loop(96).flat(140).loop(90).flat(160).boost().check()
      .megaDrop(160, 150).flat(140).boost().dropJump(260, 80, 95).flat(150).check()
      .plat(280, 60, 1.5).flat(160).boost().eight(90).flat(150).check()
      .whoops(5).spikes(100).flat(110).boost().jump(260, 105).flat(150).check()
      .corkscrew(96).flat(150).valley(320, 75).boost().check()
      .stepJump(240, 110, 80).flat(150).boost().eight(86).flat(150).check()
      .plat(300, 70, 1.6).flat(160).spikes(90).flat(110).boost().loop(100).flat(150).check()
      .hill(320, 80).boost().dropJump(280, 85, 100).flat(170).flat(200)
      .finish().build(),
  },
  {
    name: "Inferno Circuit", desc: "the gauntlet · everything burns", theme: "inferno",
    card: { top: "#160303", bot: "#4d130a", acc: "#ff7a3c", emoji: "🔥" },
    make: () => builder()
      .flat(480).spikes(100).flat(110).boost().jump(260, 105).flat(150).check()
      .whoops(5).flat(120).boost().corkscrew(92).flat(150).check()
      .megaDrop(160, 150).flat(140).spikes(110).flat(110).boost().check()
      .eight(88).flat(150).stepJump(230, 105, 75).flat(150).check()
      .plat(280, 65, 1.6).flat(160).spikes(90).flat(110).boost().check()
      .dropJump(280, 85, 100).flat(150).boost().loop(98).flat(150).check()
      .whoops(4).spikes(100).flat(110).boost().stepJump(240, 110, 80).flat(150).check()
      .corkscrew(96).flat(150).plat(300, 70, 1.7).flat(160).boost().check()
      .eight(92).flat(150).spikes(110).flat(110).boost().check()
      .megaDrop(160, 150).flat(140).whoops(5).flat(120).boost().jump(280, 110).flat(150).check()
      .plat(280, 60, 1.8).flat(160).spikes(100).flat(110).boost().corkscrew(90).flat(150).check()
      .hill(320, 85).boost().dropJump(300, 90, 105).flat(170).flat(200)
      .finish().build(),
  }
];

const KEYS = {
  p1: { gas: "KeyD", brake: "KeyA", back: "KeyW", fwd: "KeyS" },
  p2: { gas: "ArrowRight", brake: "ArrowLeft", back: "ArrowUp", fwd: "ArrowDown" },
};
const ALL_KEYS = [...Object.values(KEYS.p1), ...Object.values(KEYS.p2)];

function makeRider(id) {
  return {
    id, x: 160 + (id === 0 ? 0 : 40), y: GYB, v: 0, vx: 0, vy: 0,
    angle: 0, angVel: 0, rotSum: 0,
    neon: id === 0 ? "#3aa0ff" : "#ff3b4d",
    glow: id === 0 ? "#7cc8ff" : "#ff8090",
    grounded: true, onPlat: null,
    loop: null, loopPhi: 0,
    crashT: 0, spawnProt: 0, spawnX: 160, gapLipY: null, checkpoint: { x: 160, y: GYB },
    finished: false, finishTime: 0,
    wheelSpin: 0, puttT: 0, airT: 0, stickT: 0, stabFx: 0,
    trail: [],
  };
}

export default function StickmanMotoRace() {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState("menu");
  const [mapIdx, setMapIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [muted, setMuted] = useState(false);
  const [touchUI, setTouchUI] = useState(false);
  const stateRef = useRef({});

  useEffect(() => { SFX.setMuted(muted); }, [muted]);
  useEffect(() => {
    const touch = typeof window !== "undefined" &&
      (("ontouchstart" in window) || (navigator.maxTouchPoints || 0) > 0);
    setTouchUI(touch);
  }, []);

  const startRace = (mi) => {
    SFX.unlock();
    setMapIdx(mi); setResult(null);
    setPhase("playing");
    stateRef.current.launch = { mapIdx: mi };
  };

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const mi = stateRef.current.launch.mapIdx;
    const map = MAPS[mi];
    const T = map.make();

    const S = {
      T, players: [makeRider(0), makeRider(1)],
      keys: {}, pressed: {},
      t: 0, raceT: 0, mode: "countdown", modeT: 0, lastBeep: -1,
      particles: [], texts: [],
      cams: [{ x: 0, y: 0, init: false }, { x: 0, y: 0, init: false }],
      done: false,
    };

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

    const spark = (x, y, color, n = 8, spd = 220) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = spd * (0.4 + Math.random() * 0.8);
        S.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.45, max: 0.45, color, r: 2 + Math.random() * 3, glow: true });
      }
    };
    const worldText = (x, y, str, color) => S.texts.push({ x, y, vy: -70, life: 1, max: 1, str, color });

    // ---------------- TERRAIN ----------------
    const platY = (pl) => pl.y + Math.sin(S.t * pl.speed + pl.phase) * pl.amp;
    const terrainY = (x) => {
      for (const sg of T.segs) {
        if (x >= sg.x0 && x <= sg.x1) {
          if (sg.gap) {
            for (const pl of T.plats) {
              if (x >= pl.x0 && x <= pl.x1) return platY(pl);
            }
            return null;
          }
          const k = (x - sg.x0) / (sg.x1 - sg.x0);
          const sm = (1 - Math.cos(k * Math.PI)) / 2;
          return sg.y0 + (sg.y1 - sg.y0) * sm;
        }
      }
      return null;
    };
    const slopeAt = (x) => {
      const a = terrainY(x - 9), b = terrainY(x + 9);
      if (a === null || b === null) return 0;
      return Math.atan2(b - a, 18);
    };
    const platUnder = (x) => {
      for (const pl of T.plats) if (x >= pl.x0 && x <= pl.x1) {
        for (const sg of T.segs) if (x >= sg.x0 && x <= sg.x1 && sg.gap) return pl;
      }
      return null;
    };
    const normAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

    const crash = (p, msg = "CRASH!") => {
      if (p.crashT > 0) return;
      SFX.crash();
      spark(p.x, p.y - 20, "#ff8f6a", 16, 320);
      spark(p.x, p.y - 20, p.neon, 10, 260);
      worldText(p.x, p.y - 90, msg, "#ff8f6a");
      p.crashT = 0.9;
      p.loop = null;
    };
    const respawn = (p) => {
      p.x = p.checkpoint.x;
      p.y = terrainY(p.checkpoint.x) ?? p.checkpoint.y;
      p.v = 0; p.vx = 0; p.vy = 0;
      p.angle = slopeAt(p.checkpoint.x); p.angVel = 0; p.rotSum = 0;
      p.grounded = true; p.loop = null; p.onPlat = null;
      p.airT = 0; p.stickT = 0.1;
      p.gapLipY = null;
      p.spawnX = p.x;
      p.spawnProt = 0.4;
    };

    // ---------------- RIDER UPDATE ----------------
    const updateRider = (p, dt) => {
      const k = p.id === 0 ? KEYS.p1 : KEYS.p2;
      const canControl = S.mode === "race" && p.crashT <= 0 && !p.finished;
      if (p.crashT > 0) {
        p.crashT -= dt;
        if (p.crashT <= 0) respawn(p);
        return;
      }
      if (p.spawnProt > 0) {
        p.spawnProt -= dt;
        if (Math.abs(p.x - p.spawnX) > 40 || (canControl && S.keys[k.gas])) p.spawnProt = 0;
      }
      if (p.stabFx > 0) p.stabFx -= dt;

      if (Math.abs(p.v) > 40 || p.loop) {
        p.puttT -= dt;
        if (p.puttT <= 0) { p.puttT = 0.1; SFX.putt(Math.abs(p.v)); }
      }

      // ---- LOOP / GRAND-8 RAIL ----
      if (p.loop) {
        const L = p.loop;
        const total = Math.PI * 2 * (L.turns || 1);
        p.v -= RAIL_FRICTION * dt;
        if (p.v < 150) {
          const dirA = -p.loopPhi;
          p.vx = Math.cos(dirA) * p.v; p.vy = -Math.sin(dirA) * p.v;
          p.grounded = false; p.loop = null;
          p.angVel = 2; p.rotSum = 0; p.airT = 0;
          worldText(p.x, p.y - 60, "TOO SLOW!", "#ff8f6a");
          return;
        }
        p.loopPhi += (p.v / L.r) * dt;
        const phm = p.loopPhi % (Math.PI * 2);
        p.x = L.cx + Math.sin(phm) * L.r;
        p.y = L.cy + Math.cos(phm) * L.r;
        p.angle = -p.loopPhi;
        p.wheelSpin += (p.v * dt) / 12;
        if (p.loopPhi >= total) {
          p.loop = null;
          p.x = L.exitX; p.y = terrainY(L.exitX) ?? GYB;
          p.angle = 0; p.grounded = true; p.stickT = 0.1;
          if (L.tag === "GRAND 8!") SFX.grand8();
          else SFX.loopOut();
          worldText(p.x, p.y - 84, L.tag || "LOOP!", L.tag ? "#ffe97a" : "#7dffb0");
          spark(p.x, p.y - 10, p.neon, 8, 200);
        }
        return;
      }

      if (p.grounded) {
        // ---- GROUND RIDE ----
        if (p.stickT > 0) p.stickT -= dt;
        const slope = slopeAt(p.x);
        let acc = 0;
        if (canControl) {
          if (S.keys[k.gas]) {
            // LOW-GEAR TORQUE: strong at low speed — climbs ramps from a standstill
            const lowGear = 1 + Math.max(0, (280 - Math.abs(p.v)) / 280);
            acc += ACCEL * lowGear;
          }
          if (S.keys[k.brake]) acc -= (p.v > 20 ? BRAKE : ACCEL * 0.9); // brake → reverse
        }
        acc -= SLOPE_G * Math.sin(slope);
        acc -= DRAG * p.v;
        p.v += acc * dt;
        p.v = Math.max(-260, Math.min(MAX_V + 220, p.v));

        const prevX = p.x;
        p.x += p.v * Math.cos(slope) * dt;
        if (p.x < 60) { p.x = 60; p.v = Math.max(0, p.v); }
        p.wheelSpin += (p.v * dt) / 12;

        const ny = terrainY(p.x);
        if (ny === null) {
          // Entered a real pit / jump gap — remember lip height so falling short kills you
          p.gapLipY = p.y;
          p.grounded = false;
          p.vx = p.v * Math.cos(p.angle);
          p.vy = p.v * Math.sin(p.angle);
          p.rotSum = 0; p.angVel = 0; p.airT = 0; p.onPlat = null;
        } else {
          const rise = ny - p.y;
          if (p.stickT <= 0 && rise > 10 + Math.abs(p.v) * dt * 1.4 && Math.abs(p.v) > 160) {
            p.grounded = false;
            p.vx = p.v * Math.cos(p.angle);
            p.vy = p.v * Math.sin(p.angle);
            p.rotSum = 0; p.angVel = 0; p.airT = 0;
          } else {
            p.y = ny;
            const target = slopeAt(p.x);
            p.angle += normAngle(target - p.angle) * Math.min(1, 12 * dt);
            p.onPlat = platUnder(p.x);
          }
        }

        // ---- BUNNY HOP ----
        if (canControl && p.grounded && S.pressed[k.back]) {
          p.grounded = false;
          p.vx = p.v * Math.cos(p.angle);
          p.vy = p.v * Math.sin(p.angle) - 560;
          p.rotSum = 0; p.angVel = 0; p.onPlat = null; p.airT = 0;
          SFX.hop();
          spark(p.x, p.y, "rgba(220,220,220,0.6)", 4, 120);
        }

        // ---- LOOP ENTRY ----
        for (const L of T.loops) {
          if (prevX < L.entryX && p.x >= L.entryX && p.v >= LOOP_MIN_V) {
            p.loop = L; p.loopPhi = 0;
            SFX.loopIn();
            break;
          } else if (prevX < L.entryX && p.x >= L.entryX && p.v >= 200) {
            worldText(p.x, p.y - 80, "NEED MORE SPEED!", "#ffd27a");
          }
        }

        // ---- GROUND HAZARDS / PICKUPS ----
        if (S.mode === "race" && !p.finished) {
          for (const sp of T.spikes) {
            if (p.spawnProt <= 0 && p.grounded && p.x > sp.x - 4 && p.x < sp.x + sp.w + 4) crash(p, "SPIKES!");
          }
          for (const b of T.boosts) {
            if (!b["used" + p.id] && Math.abs(p.x - b.x) < 26) {
              b["used" + p.id] = true;
              setTimeout(() => { b["used" + p.id] = false; }, 1500);
              p.v = Math.min(MAX_V + 220, p.v + 190);
              SFX.boost();
              worldText(p.x, p.y - 84, "BOOST!", "#7dffb0");
              spark(p.x, p.y - 10, "#7dffb0", 8, 200);
            }
          }
        }
      } else {
        // ---- AIRBORNE ----
        const stab = canControl && S.keys[k.gas] && !S.keys[k.back] && !S.keys[k.fwd];
        if (canControl) {
          if (S.keys[k.back]) p.angVel = -ROT_SPD;
          else if (S.keys[k.fwd]) p.angVel = ROT_SPD;
          else if (stab) p.angVel *= Math.max(0, 1 - 12 * dt);
          else p.angVel *= 0.92;
        }
        p.angle += p.angVel * dt;
        p.rotSum += p.angVel * dt;
        if (stab) {
          // 🛡️ AIR STABILIZER: hold GAS mid-air to auto-level toward your landing
          const target = slopeAt(p.x + p.vx * 0.25);
          const delta = normAngle(target - p.angle) * Math.min(1, 8 * dt);
          p.angle += delta;
          p.rotSum += delta;
          p.stabFx = 0.12;
        }
        p.airT += dt;
        p.vy += GRAV * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < 60) { p.x = 60; p.vx = Math.max(0, p.vx); }
        p.wheelSpin += (Math.abs(p.vx) * dt) / 16;

        const ny = terrainY(p.x);

        // Pit death only when you drop in with almost no jump speed (not mid-ramp-jump)
        if (ny === null) {
          if (p.gapLipY == null) p.gapLipY = p.y - 20;
          if (p.y > p.gapLipY + 140 && Math.abs(p.vx) < 100) crash(p, "FELL!");
        } else if (p.y >= ny && p.vy >= 0) {
          const slope = slopeAt(p.x);
          const diff = Math.abs(normAngle(p.angle - slope));
          const flips = Math.floor((Math.abs(p.rotSum) + 0.9) / (Math.PI * 2));
          if (diff > CRASH_ANGLE) {
            crash(p, "WIPEOUT!");
          } else {
            p.y = ny; p.grounded = true;
            p.angle = slope;
            p.stickT = 0.12;
            p.gapLipY = null;
            const landV = Math.hypot(p.vx, p.vy) * Math.cos(Math.min(diff, 1)) * 0.94;
            p.v = Math.max(p.v * 0, landV) * Math.sign(p.vx || 1);
            if (p.airT > 0.15) {
              SFX.land();
              spark(p.x, p.y, "rgba(220,220,220,0.6)", 5, 140);
            }
            p.airT = 0;
            if (flips > 0) {
              const bonus = 120 + flips * 60;
              p.v = Math.min(MAX_V + 240, p.v + bonus);
              SFX.trick(flips);
              const name = p.rotSum < 0 ? "BACKFLIP" : "FRONTFLIP";
              worldText(p.x, p.y - 96, `${name}${flips > 1 ? " x" + flips : ""}! +BOOST`, "#ffe97a");
              spark(p.x, p.y - 30, "#ffe97a", 12, 280);
            }
            p.rotSum = 0; p.angVel = 0;
            p.onPlat = platUnder(p.x);
          }
        }
      }

      if (p.grounded && p.onPlat) {
        const ny = platY(p.onPlat);
        if (p.x >= p.onPlat.x0 && p.x <= p.onPlat.x1) p.y = ny;
        else p.onPlat = null;
      }

      if (p.y > DEATH_Y) crash(p, "FELL!");

      if (S.mode === "race" && !p.finished && p.crashT <= 0) {
        // Only grounded — falling through a gap must not save a checkpoint past it
        if (p.grounded) {
          for (const c of T.checks) {
            if (p.x >= c.x && p.checkpoint.x < c.x) {
              p.checkpoint = { x: c.x, y: c.y };
              SFX.check();
              worldText(c.x, c.y - 110, "CHECKPOINT", "#7dffb0");
            }
          }
        }
        if (p.x >= T.finishX) {
          p.finished = true;
          p.finishTime = S.raceT;
          if (!S.done) {
            S.done = true;
            SFX.finish();
            const other = S.players[1 - p.id];
            const gap = T.finishX - other.x;
            setTimeout(() => {
              setResult({ winner: p.id + 1, time: p.finishTime, gap: Math.max(0, Math.round(gap / 10)) });
              setPhase("matchEnd");
            }, 1600);
          }
        }
      }

      if (Math.abs(p.v) > 420 || (!p.grounded && Math.hypot(p.vx, p.vy) > 420)) {
        p.trail.push({ x: p.x, y: p.y - 16, life: 0.22, max: 0.22 });
      }
      p.trail = p.trail.filter((tr) => { tr.life -= dt; return tr.life > 0; });
    };

    // ---------------- BACKDROPS (10 neon themes) ----------------
    const drawBackdrop = (camX, vy0) => {
      const skies = {
        sunny: ["#2e7ac9", "#a8dcff"], canyon: ["#6e2a0c", "#e0975c"], candy: ["#2a0a50", "#7a35b5"],
        synth: ["#12022b", "#3a0a60"], aurora: ["#020a16", "#0d2a4a"], laserjungle: ["#02120a", "#0a2e18"],
        galaxy: ["#050110", "#1c0a3e"], voltage: ["#0d0d10", "#26251f"], sea: ["#02101f", "#0a3050"],
        inferno: ["#0e0202", "#3d0f06"],
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
          ctx.fillRect(sx, vy0 + 10 + (i * 53) % 100, 2, 2);
        }
      };

      if (map.theme === "sunny") {
        ctx.save();
        ctx.shadowColor = "#fff4c0"; ctx.shadowBlur = 40;
        ctx.fillStyle = "#fff8d8";
        ctx.beginPath(); ctx.arc(CW * 0.72, vy0 + 52, 26, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        for (let i = 0; i < 4; i++) {
          const cx = ((i * 260 - camX * (0.08 + i * 0.03) - S.t * (8 + i * 4)) % (CW + 240) + CW + 240) % (CW + 240) - 120;
          const cy = vy0 + 44 + i * 30;
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.beginPath();
          ctx.ellipse(cx, cy, 55, 13, 0, 0, Math.PI * 2);
          ctx.ellipse(cx + 34, cy + 5, 38, 10, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let layer = 0; layer < 2; layer++) {
          const par = 0.16 + layer * 0.18;
          const hw = 300, off = ((camX * par) % hw + hw) % hw;
          ctx.fillStyle = layer === 0 ? "#4faf6a" : "#3d9457";
          ctx.beginPath();
          ctx.moveTo(-10, bot);
          for (let x = -10; x <= CW + 10; x += 20) {
            const ph = ((x + off) / hw) * Math.PI * 2;
            ctx.lineTo(x, bot - 40 - layer * 26 + Math.sin(ph) * 24);
          }
          ctx.lineTo(CW + 10, bot);
          ctx.fill();
        }
      } else if (map.theme === "canyon") {
        ctx.save();
        ctx.shadowColor = "#ffcf9a"; ctx.shadowBlur = 46;
        ctx.fillStyle = "#ffe2b8";
        ctx.beginPath(); ctx.arc(CW * 0.3, vy0 + 58, 30, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        for (let layer = 0; layer < 2; layer++) {
          const par = 0.16 + layer * 0.2;
          const mw = 340, off = ((camX * par) % mw + mw) % mw;
          ctx.fillStyle = layer === 0 ? "#8a4318" : "#a5561f";
          for (let i = -1; i < CW / mw + 2; i++) {
            const mx = i * mw - off;
            const h = 70 + (i * 37 % 40) + layer * 20;
            ctx.fillRect(mx + 30, bot - h, 150, h);
            ctx.fillRect(mx + 10, bot - h + 18, 190, 10);
          }
        }
      } else if (map.theme === "candy") {
        stars(16, "255,220,255");
        ctx.save();
        ctx.globalAlpha = 0.25;
        ["#ff5d7a", "#ffd27a", "#7dffb0", "#5aa9ff"].forEach((col, ri) => {
          ctx.strokeStyle = col; ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.arc(CW * 0.5 - camX * 0.05 % 200, bot + 130, 250 + ri * 12, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        });
        ctx.restore();
        const lw = 260, off = ((camX * 0.2) % lw + lw) % lw;
        for (let i = -1; i < CW / lw + 2; i++) {
          const lx = i * lw - off;
          ctx.strokeStyle = "#e8d8ff"; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(lx + 60, bot); ctx.lineTo(lx + 60, bot - 66); ctx.stroke();
          const col = ["#ff6ad4", "#7dffb0", "#ffd27a"][((i % 3) + 3) % 3];
          ctx.save();
          ctx.shadowColor = col; ctx.shadowBlur = 12;
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(lx + 60, bot - 80, 18, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      } else if (map.theme === "synth") {
        // striped retro sun
        ctx.save();
        ctx.shadowColor = "#ff4fd8"; ctx.shadowBlur = 34;
        const sy2 = vy0 + 70;
        for (let s2 = 0; s2 < 8; s2++) {
          ctx.fillStyle = s2 % 2 ? "#ff4fd8" : "#ff8a5c";
          ctx.beginPath();
          ctx.arc(CW * 0.5, sy2, 44, 0, Math.PI * 2);
          ctx.clip ? 0 : 0;
          ctx.fill();
          break;
        }
        ctx.fillStyle = "#ff4fd8";
        ctx.beginPath(); ctx.arc(CW * 0.5, sy2, 44, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#12022b";
        for (let s2 = 0; s2 < 4; s2++) ctx.fillRect(CW * 0.5 - 48, sy2 + 4 + s2 * 11, 96, 4);
        ctx.restore();
        // neon skyline
        const bw = 110, off = ((camX * 0.22) % bw + bw) % bw;
        for (let i = -1; i < CW / bw + 2; i++) {
          const bx = i * bw - off;
          const h = 70 + (i * 41 % 60);
          ctx.fillStyle = "#1a0a33";
          ctx.fillRect(bx + 12, bot - h, 74, h);
          const edge = i % 2 ? "#ff4fd8" : "#4fd8ff";
          ctx.save();
          ctx.shadowColor = edge; ctx.shadowBlur = 8;
          ctx.strokeStyle = edge; ctx.lineWidth = 2;
          ctx.strokeRect(bx + 12, bot - h, 74, h);
          ctx.restore();
          ctx.fillStyle = "rgba(255,200,255,0.5)";
          for (let wnd = 0; wnd < 3; wnd++) {
            if (Math.sin(S.t * 1.6 + i * 3 + wnd * 5) > 0.1) ctx.fillRect(bx + 24 + wnd * 18, bot - h + 14 + (wnd % 2) * 22, 6, 8);
          }
        }
        stars(14, "230,160,255");
      } else if (map.theme === "aurora") {
        stars(18);
        for (let rIdx = 0; rIdx < 2; rIdx++) {
          ctx.save();
          ctx.globalAlpha = 0.2;
          const hue = rIdx === 0 ? "140,255,190" : "130,180,255";
          const grad = ctx.createLinearGradient(0, vy0 + 20, 0, vy0 + 130);
          grad.addColorStop(0, `rgba(${hue},0.9)`); grad.addColorStop(1, `rgba(${hue},0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(-20, vy0 + 46);
          for (let x = 0; x <= CW + 20; x += 30) ctx.lineTo(x, vy0 + 46 + rIdx * 30 + Math.sin(S.t * 0.7 + (x + camX * 0.1) * 0.012 + rIdx * 2) * 22);
          for (let x = CW + 20; x >= -20; x -= 30) ctx.lineTo(x, vy0 + 130 + rIdx * 30 + Math.sin(S.t * 0.7 + (x + camX * 0.1) * 0.012 + rIdx * 2) * 22);
          ctx.fill();
          ctx.restore();
        }
        const pw2 = 200, off = ((camX * 0.22) % pw2 + pw2) % pw2;
        for (let i = -1; i < CW / pw2 + 2; i++) {
          const px2 = i * pw2 - off;
          ctx.fillStyle = "#0a1c33";
          ctx.beginPath();
          ctx.moveTo(px2, bot); ctx.lineTo(px2 + 74, bot - 110 - (i * 23 % 30)); ctx.lineTo(px2 + 156, bot);
          ctx.fill();
          ctx.save();
          ctx.shadowColor = "#7de8ff"; ctx.shadowBlur = 8;
          ctx.strokeStyle = "rgba(125,232,255,0.7)"; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px2, bot); ctx.lineTo(px2 + 74, bot - 110 - (i * 23 % 30)); ctx.lineTo(px2 + 156, bot);
          ctx.stroke();
          ctx.restore();
        }
        for (let i = 0; i < 24; i++) {
          const sx = ((i * 131 - camX * 0.15 + Math.sin(S.t + i) * 20) % CW + CW) % CW;
          const sy2 = vy0 + ((S.t * 30 + i * 67) % VIEW_H);
          ctx.fillStyle = "rgba(230,240,255,0.7)";
          ctx.beginPath(); ctx.arc(sx, sy2, 1.5, 0, Math.PI * 2); ctx.fill();
        }
      } else if (map.theme === "laserjungle") {
        // sweeping laser beams
        for (let i = 0; i < 3; i++) {
          const ang = 0.5 + Math.sin(S.t * 0.5 + i * 2.1) * 0.35;
          const bx = ((i * 340 - camX * 0.1) % (CW + 200) + CW + 200) % (CW + 200) - 100;
          ctx.save();
          ctx.globalAlpha = 0.14;
          ctx.strokeStyle = i % 2 ? "#5dff8a" : "#d8ff5c"; ctx.lineWidth = 5;
          ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.moveTo(bx, vy0);
          ctx.lineTo(bx + Math.tan(ang) * VIEW_H, bot);
          ctx.stroke();
          ctx.restore();
        }
        const tw = 150, off = ((camX * 0.22) % tw + tw) % tw;
        for (let i = -1; i < CW / tw + 2; i++) {
          const tx = i * tw - off;
          ctx.fillStyle = "#04180c";
          ctx.beginPath();
          ctx.arc(tx + 44, bot - 66, 42, 0, Math.PI * 2);
          ctx.arc(tx + 96, bot - 44, 34, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(tx + 38, bot - 66, 10, 80);
          ctx.save();
          ctx.shadowColor = "#5dff8a"; ctx.shadowBlur = 10;
          ctx.strokeStyle = "rgba(93,255,138,0.5)"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(tx + 44, bot - 66, 42, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
          ctx.restore();
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
      } else if (map.theme === "galaxy") {
        stars(34, "200,190,255");
        // nebulas
        for (let i = 0; i < 3; i++) {
          const nx = ((i * 340 - camX * 0.05) % (CW + 300) + CW + 300) % (CW + 300) - 150;
          const ny2 = vy0 + 50 + (i * 61) % 100;
          const grad = ctx.createRadialGradient(nx, ny2, 4, nx, ny2, 90);
          const cc = i % 2 ? "176,140,255" : "255,106,212";
          grad.addColorStop(0, `rgba(${cc},0.18)`); grad.addColorStop(1, `rgba(${cc},0)`);
          ctx.fillStyle = grad;
          ctx.fillRect(nx - 90, ny2 - 90, 180, 180);
        }
        // ringed planet
        const px3 = ((520 - camX * 0.08) % (CW + 260) + CW + 260) % (CW + 260) - 130;
        ctx.save();
        ctx.shadowColor = "#b08cff"; ctx.shadowBlur = 20;
        ctx.fillStyle = "#7a5ccf";
        ctx.beginPath(); ctx.arc(px3, vy0 + 74, 24, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#ff6ad4"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(px3, vy0 + 74, 40, 10, -0.35, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        // shooting star
        const shoot = (S.t % 5) / 5;
        if (shoot < 0.15) {
          const sx = CW * (1 - shoot * 5), sy2 = vy0 + 30 + shoot * 300;
          ctx.save();
          ctx.shadowColor = "#fff"; ctx.shadowBlur = 10;
          ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(sx, sy2); ctx.lineTo(sx + 34, sy2 - 18); ctx.stroke();
          ctx.restore();
        }
      } else if (map.theme === "voltage") {
        const fw = 240, off = ((camX * 0.22) % fw + fw) % fw;
        for (let i = -1; i < CW / fw + 2; i++) {
          const fx = i * fw - off;
          // pylons
          ctx.strokeStyle = "#1c1c20"; ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(fx + 40, bot); ctx.lineTo(fx + 60, bot - 120);
          ctx.moveTo(fx + 80, bot); ctx.lineTo(fx + 60, bot - 120);
          ctx.moveTo(fx + 34, bot - 60); ctx.lineTo(fx + 86, bot - 60);
          ctx.moveTo(fx + 40, bot - 92); ctx.lineTo(fx + 80, bot - 92);
          ctx.stroke();
          const blink = Math.sin(S.t * 3 + i * 2.4) > 0.5;
          if (blink) {
            ctx.save();
            ctx.shadowColor = "#ff5c3c"; ctx.shadowBlur = 8;
            ctx.fillStyle = "#ff6a4c";
            ctx.beginPath(); ctx.arc(fx + 60, bot - 124, 3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          }
          // arcs between pylons
          if (Math.sin(S.t * 7 + i * 3.7) > 0.93) {
            ctx.save();
            ctx.shadowColor = "#ffe45c"; ctx.shadowBlur = 12;
            ctx.strokeStyle = "#fff8c0"; ctx.lineWidth = 2;
            ctx.beginPath();
            let zx = fx + 60, zy = bot - 118;
            ctx.moveTo(zx, zy);
            for (let z2 = 0; z2 < 5; z2++) {
              zx += fw / 5.5; zy += (Math.random() - 0.5) * 18;
              ctx.lineTo(zx, zy);
            }
            ctx.stroke();
            ctx.restore();
          }
        }
        for (let i = 0; i < 8; i++) {
          const ex = ((i * 173 - camX * 0.3) % CW + CW) % CW;
          const ey = bot - ((S.t * 20 + i * 47) % 120);
          ctx.save();
          ctx.shadowColor = "#ffe45c"; ctx.shadowBlur = 6;
          ctx.fillStyle = "rgba(255,235,120,0.6)";
          ctx.beginPath(); ctx.arc(ex, ey, 1.4, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      } else if (map.theme === "sea") {
        // light rays
        for (let i = 0; i < 4; i++) {
          const rx = ((i * 260 - camX * 0.08) % (CW + 200) + CW + 200) % (CW + 200) - 100;
          ctx.save();
          ctx.globalAlpha = 0.06 + 0.03 * Math.sin(S.t + i);
          ctx.fillStyle = "#aef0ff";
          ctx.beginPath();
          ctx.moveTo(rx, vy0); ctx.lineTo(rx + 60, vy0);
          ctx.lineTo(rx + 150, bot); ctx.lineTo(rx + 30, bot);
          ctx.fill();
          ctx.restore();
        }
        // jellyfish
        for (let i = 0; i < 3; i++) {
          const jx = ((i * 330 - camX * 0.18) % (CW + 120) + CW + 120) % (CW + 120) - 60;
          const jy = vy0 + 70 + (i * 57) % 110 + Math.sin(S.t * 1.2 + i * 2) * 12;
          const pul = 0.5 + 0.5 * Math.sin(S.t * 2 + i);
          const col = i % 2 ? "#ff6ad4" : "#4fd8ff";
          ctx.save();
          ctx.shadowColor = col; ctx.shadowBlur = 14;
          ctx.fillStyle = col; ctx.globalAlpha = 0.5 + pul * 0.3;
          ctx.beginPath(); ctx.arc(jx, jy, 12 + pul * 3, Math.PI, 0); ctx.fill();
          ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5;
          for (let t2 = 0; t2 < 4; t2++) {
            ctx.beginPath();
            ctx.moveTo(jx - 8 + t2 * 5, jy);
            ctx.quadraticCurveTo(jx - 8 + t2 * 5 + Math.sin(S.t * 3 + t2) * 5, jy + 12, jx - 8 + t2 * 5 + Math.sin(S.t * 3 + t2 + 1) * 6, jy + 22);
            ctx.stroke();
          }
          ctx.restore();
        }
        // bubbles
        for (let i = 0; i < 14; i++) {
          const bx = ((i * 151 - camX * 0.25 + Math.sin(S.t + i) * 10) % CW + CW) % CW;
          const by = bot - ((S.t * 34 + i * 77) % VIEW_H);
          ctx.strokeStyle = "rgba(180,230,255,0.5)"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(bx, by, 2 + (i % 3), 0, Math.PI * 2); ctx.stroke();
        }
      } else {
        // inferno
        const pulse = 0.5 + 0.5 * Math.sin(S.t * 1.4);
        const gl = ctx.createLinearGradient(0, bot - 90, 0, bot);
        gl.addColorStop(0, "rgba(255,90,30,0)");
        gl.addColorStop(1, `rgba(255,90,30,${0.28 + pulse * 0.15})`);
        ctx.fillStyle = gl; ctx.fillRect(0, bot - 90, CW, 90);
        const rw = 180, off = ((camX * 0.25) % rw + rw) % rw;
        for (let i = -1; i < CW / rw + 2; i++) {
          const rx = i * rw - off;
          ctx.fillStyle = "#1c0503";
          ctx.beginPath();
          ctx.moveTo(rx, bot);
          ctx.lineTo(rx + 56, bot - 100 - (i * 31 % 40));
          ctx.lineTo(rx + 122, bot);
          ctx.fill();
          ctx.save();
          ctx.shadowColor = "#ff7a3c"; ctx.shadowBlur = 8;
          ctx.strokeStyle = "rgba(255,122,60,0.55)"; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(rx, bot); ctx.lineTo(rx + 56, bot - 100 - (i * 31 % 40)); ctx.lineTo(rx + 122, bot);
          ctx.stroke();
          ctx.restore();
        }
        for (let i = 0; i < 14; i++) {
          const ex = ((i * 173 - camX * 0.35) % CW + CW) % CW;
          const ey = bot - ((S.t * 28 + i * 61) % (VIEW_H - 20));
          const a = 0.4 + 0.5 * Math.abs(Math.sin(S.t * 6 + i));
          ctx.save();
          ctx.shadowColor = "#ff7a3c"; ctx.shadowBlur = 8;
          ctx.fillStyle = `rgba(255,150,80,${a})`;
          ctx.beginPath(); ctx.arc(ex, ey, 1.8, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }
    };

    const themeCols = () => ({
      sunny: { g: "#3f8a54", top: "#7dff9a", loop: "#ffb85c", danger: "#ff5d7a" },
      canyon: { g: "#7a4318", top: "#ffd27a", loop: "#ff8a4c", danger: "#ff5c1a" },
      candy: { g: "#5a2a8a", top: "#ff6ad4", loop: "#7dffb0", danger: "#ff2f6d" },
      synth: { g: "#161031", top: "#ff4fd8", loop: "#4fd8ff", danger: "#ff2f6d" },
      aurora: { g: "#12233c", top: "#7de8ff", loop: "#8fffc8", danger: "#6ac8ff" },
      laserjungle: { g: "#0d2a16", top: "#5dff8a", loop: "#d8ff5c", danger: "#ff5c8a" },
      galaxy: { g: "#191038", top: "#b08cff", loop: "#ff6ad4", danger: "#ff4f6d" },
      voltage: { g: "#26262c", top: "#ffe45c", loop: "#7de8ff", danger: "#ff6a3c" },
      sea: { g: "#0d2a44", top: "#4fd8ff", loop: "#7dffb0", danger: "#ff6ad4" },
      inferno: { g: "#2e120c", top: "#ff7a3c", loop: "#ffd25c", danger: "#ff3b3b" },
    }[map.theme]);

    // ---------------- WORLD RENDER ----------------
    const drawWorld = (pov, vy0) => {
      const cam = S.cams[pov.id];
      const camX = cam.x, camY = cam.y;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, vy0, CW, VIEW_H);
      ctx.clip();

      drawBackdrop(camX, vy0);
      const C = themeCols();
      const P = (x, y) => [x - camX, vy0 + (y - camY)];

      if (map.theme === "inferno" || map.theme === "canyon") {
        const [, lv] = P(0, GYB + 150);
        if (lv < vy0 + VIEW_H && map.theme === "inferno") {
          const lg = ctx.createLinearGradient(0, lv, 0, vy0 + VIEW_H);
          lg.addColorStop(0, "#ff9a3c"); lg.addColorStop(1, "#c22a12");
          ctx.save();
          ctx.shadowColor = "#ff6a2c"; ctx.shadowBlur = 20;
          ctx.fillStyle = lg;
          ctx.fillRect(0, lv + Math.sin(S.t * 2) * 3, CW, vy0 + VIEW_H - lv + 10);
          ctx.restore();
        }
      }

      // terrain fill
      const step = 12;
      let started = false;
      const flush = () => {
        if (started) {
          ctx.lineTo(ctx.__lastX, vy0 + VIEW_H + 30);
          ctx.closePath();
          ctx.fillStyle = C.g;
          ctx.fill();
          started = false;
        }
      };
      ctx.beginPath();
      for (let sx = camX - step; sx <= camX + CW + step; sx += step) {
        const ty = terrainY(sx);
        if (ty === null) { flush(); ctx.beginPath(); continue; }
        const [px2, py2] = P(sx, ty);
        if (!started) {
          ctx.beginPath();
          ctx.moveTo(px2, vy0 + VIEW_H + 30);
          ctx.lineTo(px2, py2);
          started = true;
        } else ctx.lineTo(px2, py2);
        ctx.__lastX = px2;
      }
      flush();
      // neon edge + marching LED dashes
      const edgePath = () => {
        ctx.beginPath();
        let pen = false;
        for (let sx = camX - step; sx <= camX + CW + step; sx += step) {
          const ty = terrainY(sx);
          if (ty === null) { pen = false; continue; }
          const [px2, py2] = P(sx, ty);
          if (!pen) { ctx.moveTo(px2, py2); pen = true; }
          else ctx.lineTo(px2, py2);
        }
      };
      ctx.save();
      ctx.shadowColor = C.top; ctx.shadowBlur = 8;
      ctx.strokeStyle = C.top; ctx.lineWidth = 3; ctx.lineCap = "round";
      edgePath(); ctx.stroke();
      // LED dashes flowing along the track
      ctx.shadowBlur = 6;
      ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1.6;
      ctx.setLineDash([9, 17]);
      ctx.lineDashOffset = (camX - S.t * 120) % 26;
      edgePath(); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // loops with LED chase lights
      T.loops.forEach((L) => {
        if (L.cx < camX - 280 || L.cx > camX + CW + 280) return;
        const [lx, ly] = P(L.cx, L.cy);
        ctx.save();
        ctx.shadowColor = C.loop; ctx.shadowBlur = 14;
        ctx.strokeStyle = C.loop; ctx.lineWidth = 8; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.arc(lx, ly, L.r + 6, 0, Math.PI * 2); ctx.stroke();
        if (L.turns === 2) {
          ctx.lineWidth = 4; ctx.globalAlpha = 0.7;
          ctx.beginPath(); ctx.arc(lx, ly, L.r - 10, 0, Math.PI * 2); ctx.stroke();
        } else {
          ctx.globalAlpha = 0.45; ctx.lineWidth = 3; ctx.strokeStyle = "#ffffff";
          ctx.beginPath(); ctx.arc(lx, ly, L.r - 8, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
        // LED chase dots
        for (let d2 = 0; d2 < 10; d2++) {
          const a2 = S.t * 2.6 + (d2 * Math.PI * 2) / 10;
          const dx2 = lx + Math.sin(a2) * (L.r + 6);
          const dy2 = ly + Math.cos(a2) * (L.r + 6);
          ctx.save();
          ctx.shadowColor = d2 % 2 ? "#ffffff" : C.loop; ctx.shadowBlur = 8;
          ctx.fillStyle = d2 % 2 ? "#ffffff" : C.loop;
          ctx.globalAlpha = 0.9;
          ctx.beginPath(); ctx.arc(dx2, dy2, 2.4, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = "bold 10px monospace"; ctx.textAlign = "center";
        ctx.fillText("⚡ SPEED!", lx, ly - L.r - 14);
      });

      // moving platforms
      T.plats.forEach((pl) => {
        if (pl.x1 < camX - 60 || pl.x0 > camX + CW + 60) return;
        const y = platY(pl);
        const [x0, y0] = P(pl.x0, y);
        const w = pl.x1 - pl.x0;
        ctx.save();
        ctx.shadowColor = C.top; ctx.shadowBlur = 8;
        ctx.fillStyle = C.g;
        ctx.fillRect(x0, y0, w, 16);
        ctx.fillStyle = C.top;
        ctx.fillRect(x0, y0, w, 3);
        ctx.restore();
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "10px monospace"; ctx.textAlign = "center";
        ctx.fillText("⇕", x0 + w / 2, y0 + 13);
      });

      // spikes
      T.spikes.forEach((sp) => {
        if (sp.x + sp.w < camX - 40 || sp.x > camX + CW + 40) return;
        ctx.save();
        ctx.shadowColor = C.danger; ctx.shadowBlur = 8;
        ctx.fillStyle = C.danger;
        ctx.beginPath();
        for (let sx = 0; sx < sp.w; sx += 18) {
          const ty = terrainY(sp.x + sx) ?? GYB;
          const ty2 = terrainY(sp.x + sx + 18) ?? GYB;
          const [ax, ay] = P(sp.x + sx, ty);
          const [bx2, by2] = P(sp.x + sx + 9, Math.min(ty, ty2) - 16);
          const [cx2, cy2] = P(sp.x + sx + 18, ty2);
          ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2); ctx.lineTo(cx2, cy2);
        }
        ctx.fill();
        ctx.restore();
      });

      // boost pads with pulsing LED glow
      T.boosts.forEach((b) => {
        if (b.x < camX - 60 || b.x > camX + CW + 60) return;
        const ty = terrainY(b.x) ?? GYB;
        const [x0, y0] = P(b.x, ty);
        const pulse = Math.sin(S.t * 6 + b.x);
        ctx.save();
        ctx.shadowColor = "#7dffb0"; ctx.shadowBlur = 10 + pulse * 5;
        ctx.strokeStyle = "#7dffb0"; ctx.lineWidth = 4;
        for (let a2 = 0; a2 < 2; a2++) {
          ctx.beginPath();
          ctx.moveTo(x0 - 18 + a2 * 16 + pulse * 2, y0 - 4);
          ctx.lineTo(x0 - 6 + a2 * 16 + pulse * 2, y0 - 12);
          ctx.lineTo(x0 - 18 + a2 * 16 + pulse * 2, y0 - 20);
          ctx.stroke();
        }
        ctx.restore();
      });

      // checkpoints
      T.checks.forEach((c) => {
        if (c.x < camX - 40 || c.x > camX + CW + 40) return;
        const ty = terrainY(c.x) ?? c.y;
        const [x0, y0] = P(c.x, ty);
        const passed0 = S.players[0].checkpoint.x >= c.x;
        const passed1 = S.players[1].checkpoint.x >= c.x;
        ctx.strokeStyle = "#e8eef5"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 - 72); ctx.stroke();
        const flagCol = passed0 && passed1 ? "#7dffb0" : passed0 ? "#3aa0ff" : passed1 ? "#ff3b4d" : "rgba(255,255,255,0.5)";
        ctx.save();
        ctx.shadowColor = flagCol; ctx.shadowBlur = 8;
        ctx.fillStyle = flagCol;
        const wave = Math.sin(S.t * 5 + c.x) * 3;
        ctx.beginPath();
        ctx.moveTo(x0, y0 - 72);
        ctx.lineTo(x0 + 25 + wave, y0 - 64);
        ctx.lineTo(x0, y0 - 56);
        ctx.fill();
        ctx.restore();
      });

      // finish
      {
        const fx = T.finishX;
        if (!(fx < camX - 80 || fx > camX + CW + 80)) {
          const ty = terrainY(fx) ?? GYB;
          const [x0, y0] = P(fx, ty);
          ctx.strokeStyle = "#e8eef5"; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 - 128); ctx.stroke();
          const wave = Math.sin(S.t * 4) * 4;
          for (let ry = 0; ry < 3; ry++) {
            for (let rx = 0; rx < 5; rx++) {
              ctx.fillStyle = (rx + ry) % 2 === 0 ? "#e8eef5" : "#10141d";
              ctx.fillRect(x0 + rx * 10 + (ry * wave) / 3, y0 - 128 + ry * 10, 10, 10);
            }
          }
          ctx.save();
          ctx.shadowColor = "#ffe97a"; ctx.shadowBlur = 12;
          ctx.fillStyle = "#ffe97a"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center";
          ctx.fillText("FINISH", x0, y0 - 138);
          ctx.restore();
        }
      }

      S.players.forEach((pl) => drawBike(pl, P));

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
        if (x0 < -80 || x0 > CW + 80) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, tx.life / tx.max);
        ctx.shadowColor = tx.color; ctx.shadowBlur = 8;
        ctx.fillStyle = tx.color; ctx.font = "bold 14px monospace"; ctx.textAlign = "center";
        ctx.fillText(tx.str, x0, y0);
        ctx.restore();
      });

      // HUD
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
      ctx.fillRect(10, vy0 + 8, 172, 22);
      ctx.shadowColor = pov.neon; ctx.shadowBlur = 8;
      ctx.fillStyle = pov.neon; ctx.font = "bold 12px monospace"; ctx.textAlign = "left";
      ctx.fillText(`P${pov.id + 1}`, 16, vy0 + 23);
      ctx.shadowBlur = 0;
      ctx.fillStyle = pos === "1st" ? "#ffe97a" : "#dfe6ef";
      ctx.fillText(pos, 46, vy0 + 23);
      ctx.fillStyle = "#fff";
      ctx.fillText(`⏱ ${S.raceT.toFixed(1)}s`, 82, vy0 + 23);
      ctx.restore();
      const spd = pov.loop ? pov.v : (pov.grounded ? Math.abs(pov.v) : Math.hypot(pov.vx, pov.vy));
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(CW - 150, vy0 + 8, 140, 18);
      ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1;
      ctx.strokeRect(CW - 150, vy0 + 8, 140, 18);
      ctx.save();
      const hot = spd > LOOP_MIN_V;
      ctx.shadowColor = hot ? "#7dffb0" : pov.neon; ctx.shadowBlur = 8;
      ctx.fillStyle = hot ? "#7dffb0" : pov.neon;
      ctx.fillRect(CW - 148, vy0 + 10, 136 * Math.min(1, spd / (MAX_V + 240)), 14);
      ctx.restore();
      ctx.fillStyle = "#0a0f18"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center";
      ctx.fillText(`${Math.round(spd)} ${hot ? "· LOOP OK ⚡" : ""}`, CW - 80, vy0 + 20);

      ctx.restore();
    };

    // ---------------- BIKE ----------------
    const drawBike = (p, P) => {
      p.trail.forEach((tr) => {
        const [tx0, ty0] = P(tr.x, tr.y);
        ctx.save();
        ctx.globalAlpha = (tr.life / tr.max) * 0.35;
        ctx.shadowColor = p.neon; ctx.shadowBlur = 8;
        ctx.strokeStyle = p.neon; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(tx0 - 14, ty0); ctx.lineTo(tx0 + 10, ty0); ctx.stroke();
        ctx.restore();
      });

      const [x0, y0] = P(p.x, p.y);
      if (x0 < -80 || x0 > CW + 80) return;
      if (p.crashT > 0) {
        ctx.save();
        ctx.translate(x0, y0 - 14);
        ctx.rotate(S.t * 9);
        ctx.strokeStyle = p.neon; ctx.lineWidth = 4; ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
        ctx.restore();
        return;
      }

      // LED underglow
      ctx.save();
      ctx.translate(x0, y0);
      ctx.rotate(p.angle);
      ctx.shadowColor = p.neon; ctx.shadowBlur = 18;
      ctx.fillStyle = p.neon; ctx.globalAlpha = 0.22;
      ctx.beginPath(); ctx.ellipse(0, -4, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(x0, y0);
      ctx.rotate(p.angle);
      ctx.translate(0, -13);

      // headlight beam
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "#fff8d0";
      ctx.beginPath();
      ctx.moveTo(20, -14);
      ctx.lineTo(70, -22);
      ctx.lineTo(70, -2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      const wheel = (wx) => {
        ctx.save();
        ctx.shadowColor = p.neon; ctx.shadowBlur = 10;
        ctx.strokeStyle = p.neon; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(wx, 0, 12, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 2;
        for (let s2 = 0; s2 < 2; s2++) {
          const a = p.wheelSpin + s2 * Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(wx - Math.cos(a) * 9, -Math.sin(a) * 9);
          ctx.lineTo(wx + Math.cos(a) * 9, Math.sin(a) * 9);
          ctx.stroke();
        }
      };
      wheel(-21); wheel(21);

      ctx.save();
      ctx.shadowColor = p.neon; ctx.shadowBlur = 8;
      ctx.strokeStyle = "#e8eef5"; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-21, 0); ctx.lineTo(-4, -12); ctx.lineTo(12, -12); ctx.lineTo(21, 0);
      ctx.moveTo(12, -12); ctx.lineTo(17, -20);
      ctx.stroke();
      ctx.strokeStyle = p.neon; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(-16, -4); ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = "#f4f7fb"; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-2, -14); ctx.lineTo(2, -4);
      ctx.moveTo(-2, -14); ctx.lineTo(-8, -3);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-2, -14); ctx.lineTo(6, -32); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, -32); ctx.lineTo(17, -21); ctx.stroke();
      ctx.save();
      ctx.shadowColor = p.neon; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(9, -40, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = p.neon; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(9, -40, 9, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.restore();

      const k = p.id === 0 ? KEYS.p1 : KEYS.p2;
      if (S.keys[k.gas] && (p.grounded || p.loop)) {
        ctx.save();
        ctx.shadowColor = "#ffb85c"; ctx.shadowBlur = 10;
        ctx.fillStyle = Math.sin(S.t * 30) > 0 ? "#ffb85c" : "#ff7a3c";
        ctx.beginPath();
        ctx.moveTo(-16, -4); ctx.lineTo(-26 - Math.random() * 6, -2); ctx.lineTo(-16, 0);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // stabilizer gyro rings
      if (p.stabFx > 0 && !p.grounded) {
        ctx.save();
        ctx.translate(x0, y0 - 24);
        ctx.rotate(S.t * 6);
        ctx.shadowColor = "#7de8ff"; ctx.shadowBlur = 12;
        ctx.strokeStyle = "#7de8ff"; ctx.lineWidth = 3;
        ctx.globalAlpha = 0.85;
        for (let a2 = 0; a2 < 2; a2++) {
          ctx.beginPath();
          ctx.arc(0, 0, 36, a2 * Math.PI, a2 * Math.PI + 1.15);
          ctx.stroke();
        }
        ctx.restore();
      }
    };

    // ---------------- progress strip ----------------
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

    // ---------------- main loop ----------------
    let raf, last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;
      S.t += dt;

      if (S.mode === "countdown") {
        S.modeT += dt;
        const n = Math.ceil(3 - S.modeT);
        if (n !== S.lastBeep && n >= 0) { S.lastBeep = n; SFX.beep(n === 0); }
        if (S.modeT >= 3) { S.mode = "race"; }
      } else if (S.mode === "race") {
        S.raceT += dt;
      }

      S.players.forEach((p) => updateRider(p, dt));

      // smooth cameras — follow rider so downhill sections stay on screen
      S.players.forEach((p, i) => {
        const c = S.cams[i];
        const tx = p.x - CW * 0.4;
        let ty = p.y - 158;
        const camYMin = p.y - (VIEW_H - 36);
        const camYMax = p.y - 36;
        ty = Math.max(camYMin, Math.min(camYMax, ty));
        ty = Math.max(-320, Math.min(DEATH_Y - 80, ty));
        if (!c.init) { c.x = tx; c.y = ty; c.init = true; }
        c.x += (tx - c.x) * Math.min(1, 16 * dt);
        c.y += (ty - c.y) * Math.min(1, 7 * dt);
      });

      if (S.particles.length > 320) S.particles.splice(0, S.particles.length - 320);
      S.particles = S.particles.filter((pt) => {
        pt.life -= dt;
        pt.vy += 900 * dt;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        return pt.life > 0;
      });
      S.texts = S.texts.filter((tx) => { tx.life -= dt; tx.y += tx.vy * dt; tx.vy *= 0.94; return tx.life > 0; });

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
        fontSize: 19, fontWeight: "bold", userSelect: "none", WebkitUserSelect: "none",
        touchAction: "none", boxShadow: `0 0 12px ${color}66`, zIndex: 5, ...style,
      }}
    >{label}</div>
  );

  if (phase === "menu" || phase === "matchEnd") {
    return (
      <div style={wrap}>
        <h1 style={{ letterSpacing: 5, margin: "26px 0 2px", fontSize: 34 }}>
          <span style={neonText("#3aa0ff")}>STICKMAN</span>{" "}
          <span style={{ opacity: 0.9 }}>🏍️</span>{" "}
          <span style={neonText("#ff3b4d")}>MOTO RACE</span>
        </h1>
        <p style={{ opacity: 0.65, marginTop: 4 }}>10 neon tracks · GRAND 8s · corkscrews · flips · first to the flag</p>

        {phase === "matchEnd" && result && (
          <div style={{
            margin: "8px 0 16px", padding: "14px 36px", borderRadius: 10,
            background: result.winner === 1 ? "rgba(58,160,255,0.12)" : "rgba(255,59,77,0.12)",
            border: `2px solid ${result.winner === 1 ? "#3aa0ff" : "#ff3b4d"}`,
            boxShadow: `0 0 24px ${result.winner === 1 ? "rgba(58,160,255,0.35)" : "rgba(255,59,77,0.35)"}`,
            fontSize: 22, fontWeight: "bold", textAlign: "center",
          }}>
            🏆 PLAYER {result.winner} IS THE MOTO CHAMPION — {result.time.toFixed(2)}s
            <div style={{ fontSize: 13, opacity: 0.75, fontWeight: "normal", marginTop: 4 }}>
              rival was {result.gap}m behind
            </div>
          </div>
        )}

        <p style={{ marginBottom: 8, opacity: 0.85 }}>Pick a track (warm-up → finale):</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", maxWidth: 940 }}>
          {MAPS.map((m, i) => (
            <button key={m.name} onClick={() => startRace(i)}
              style={{
                cursor: "pointer", width: 168, padding: 0, borderRadius: 10, overflow: "hidden",
                border: "2px solid rgba(255,255,255,0.18)", background: "#10141d", color: "#e8eef5",
                fontFamily: "monospace", transition: "transform .15s, box-shadow .15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 6px 24px ${m.card.acc}44`; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
              <div style={{ height: 70, background: `linear-gradient(${m.card.top}, ${m.card.bot})`, position: "relative" }}>
                <div style={{ position: "absolute", top: 6, left: 8, fontSize: 18 }}>{m.card.emoji}</div>
                <div style={{ position: "absolute", bottom: 8, left: 10, right: 10, height: 4, background: m.card.acc, borderRadius: 2, boxShadow: `0 0 10px ${m.card.acc}` }} />
                <div style={{
                  position: "absolute", bottom: 14, right: 40, width: 24, height: 24,
                  border: `3px solid ${m.card.acc}`, borderRadius: "50%", boxShadow: `0 0 8px ${m.card.acc}`,
                }} />
                <div style={{
                  position: "absolute", bottom: 14, right: 24, width: 24, height: 24,
                  border: `3px solid ${m.card.acc}`, borderRadius: "50%", boxShadow: `0 0 8px ${m.card.acc}`, opacity: 0.7,
                }} />
                <div style={{ position: "absolute", bottom: 8, right: 6, fontSize: 10 }}>🏁</div>
                <div style={{ position: "absolute", bottom: 12, left: 26, fontSize: 12 }}>🏍️</div>
              </div>
              <div style={{ padding: "8px 0 2px", fontWeight: "bold", letterSpacing: 0.5, fontSize: 12 }}>{m.name}</div>
              <div style={{ padding: "0 6px 9px", fontSize: 9, opacity: 0.55 }}>{m.desc}</div>
            </button>
          ))}
        </div>

        <div style={{
          marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30,
          fontSize: 13, lineHeight: 1.85, background: "#10141d", padding: "16px 28px",
          borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div>
            <b style={neonText("#3aa0ff")}>PLAYER 1 — top screen</b><br />
            D — gas <span style={{ opacity: 0.6 }}>(hold in AIR = 🛡️ stabilize)</span><br />
            A — brake / reverse<br />
            W — tap = HOP · hold in air = flip · S — lean fwd
          </div>
          <div>
            <b style={neonText("#ff3b4d")}>PLAYER 2 — bottom screen</b><br />
            → — gas <span style={{ opacity: 0.6 }}>(hold in AIR = 🛡️ stabilize)</span><br />
            ← — brake / reverse<br />
            ↑ — tap = HOP · hold in air = flip · ↓ — lean fwd
          </div>
        </div>

        <div style={{
          marginTop: 12, fontSize: 12, background: "#10141d", padding: "12px 26px",
          borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", maxWidth: 720, lineHeight: 2, textAlign: "center",
        }}>
          <b>🎢 Acrobatics:</b> <span style={neonText("#ffe97a")}>GRAND 8</span> = two overlapping rings — hit the LED charge pad between them! ·
          <span style={neonText("#4fd8ff")}> DOUBLE LOOP</span> = two full revolutions on one ring<br />
          <b>🤸 Tricks:</b> flip mid-air for landing boosts · <b>🛡️ Stabilizer:</b> hold GAS airborne to auto-level<br />
          <b>🦘 Hop</b> clears spikes · whoops = rhythm bumps, stay smooth · step-jumps land HIGHER · drop-jumps = huge air<br />
          <span style={{ opacity: 0.6 }}>loops need ⚡{LOOP_MIN_V}+ speed · hold brake at a stop to reverse · ~2 min tracks</span>
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
        <span style={{ opacity: 0.7, fontSize: 13 }}>{MAPS[mapIdx].name} · first to the flag 🏁</span>
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
          style={{ width: "100%", display: "block", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "#000", boxShadow: "0 0 40px rgba(80,140,255,0.12)" }} />
        {touchUI && (
          <>
            <TouchBtn label="⟲" code={KEYS.p1.back} color="#3aa0ff" style={{ left: 10, top: "26%" }} />
            <TouchBtn label="⟳" code={KEYS.p1.fwd} color="#3aa0ff" style={{ left: 74, top: "26%" }} />
            <TouchBtn label="✋" code={KEYS.p1.brake} color="#3aa0ff" style={{ right: 74, top: "26%" }} />
            <TouchBtn label="⚡" code={KEYS.p1.gas} color="#7dffb0" style={{ right: 10, top: "26%" }} />
            <TouchBtn label="⟲" code={KEYS.p2.back} color="#ff3b4d" style={{ left: 10, top: "78%" }} />
            <TouchBtn label="⟳" code={KEYS.p2.fwd} color="#ff3b4d" style={{ left: 74, top: "78%" }} />
            <TouchBtn label="✋" code={KEYS.p2.brake} color="#ff3b4d" style={{ right: 74, top: "78%" }} />
            <TouchBtn label="⚡" code={KEYS.p2.gas} color="#7dffb0" style={{ right: 10, top: "78%" }} />
          </>
        )}
      </div>
      <p style={{ opacity: 0.5, fontSize: 12, marginTop: 8 }}>
        {touchUI
          ? "⚡ gas (hold in air = STABILIZE) · ✋ brake/reverse · ⟲ tap = HOP, hold = flip · ⟳ lean — P1 top · P2 bottom"
          : "gas in AIR = 🛡️ stabilize · tap lean-back = HOP · hold lean = flip · GRAND 8: hit the charge pad between the rings!"}
      </p>
    </div>
  );
}
