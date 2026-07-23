import React, { useRef, useEffect, useState } from "react";

// ============ STICKMAN SWORD DUEL — NEON EDITION v3 ============
// ATTACK MOVESET:
//   tap attack        → 3-hit combo chain: slash → backslash → SPIN finisher (launches)
//   hold attack ~0.4s → CHARGED HEAVY: huge damage, crushes a raised guard
//   attack while dashing → LUNGE THRUST: long-reach stab
//   attack in mid-air → PLUNGE: downward slam + shockwave
//   kick              → guard break (P1: H · P2: J)
//   block             → hold; perfect timing = PARRY (stuns attacker, beats everything)

const W = 900, H = 500;
const GRAV = 2600;
const MOVE = 340, JUMP = 900;
const MAX_HP = 100;

const ATTACKS = {
  slash1: { startup: 0.12, active: 0.10, recovery: 0.16, dmg: 7,  kb: 260, reach: 48, label: null },
  slash2: { startup: 0.08, active: 0.09, recovery: 0.16, dmg: 7,  kb: 260, reach: 48, label: null },
  spin:   { startup: 0.13, active: 0.16, recovery: 0.26, dmg: 13, kb: 380, reach: 62, launch: -430, label: "SPIN FINISHER!" },
  thrust: { startup: 0.05, active: 0.12, recovery: 0.22, dmg: 10, kb: 380, reach: 68, label: "LUNGE!" },
  heavy:  { startup: 0.24, active: 0.12, recovery: 0.32, dmg: 20, kb: 440, reach: 54, launch: -240, guardCrush: true, label: "HEAVY!" },
};
const CHAIN_WINDOW = 0.32;      // time after a light attack to chain the next
const CHARGE_TIME = 0.4;        // hold this long → heavy on release
const KICK = { startup: 0.06, active: 0.1, recovery: 0.14, dmg: 5, cd: 0.9 };
const PLUNGE = { dmg: 16, radius: 95, fallSpeed: 1150 };
const PARRY_WINDOW = 0.15;
const DASH = { speed: 920, time: 0.14, cd: 0.7 };
const STUN_TIME = 0.95;

const MAPS = [
  {
    name: "Colosseum", desc: "torch-lit arena · roaring crowd",
    sky: ["#12080f", "#3a1a22"], ground: "#6e4526", plat: "#a97b45", accent: "#ffb85c",
    deathY: H + 120,
    platforms: [
      { x: 60, y: H - 60, w: W - 120, h: 60 },
      { x: 130, y: 300, w: 160, h: 14 },
      { x: W - 290, y: 300, w: 160, h: 14 },
      { x: W / 2 - 80, y: 195, w: 160, h: 14, move: { axis: "x", range: 170, speed: 1.1, phase: 0 } },
    ],
  },
  {
    name: "Sky Shrine", desc: "floating isles · aurora night",
    sky: ["#050916", "#14244a"], ground: "#8fa9cf", plat: "#c6d8f2", accent: "#8fe0ff",
    deathY: H + 60,
    platforms: [
      { x: W / 2 - 130, y: H - 90, w: 260, h: 18 },
      { x: 80, y: 330, w: 150, h: 14, move: { axis: "y", range: 90, speed: 1.3, phase: 0 } },
      { x: W - 230, y: 330, w: 150, h: 14, move: { axis: "y", range: 90, speed: 1.3, phase: Math.PI } },
      { x: W / 2 - 70, y: 210, w: 140, h: 14, move: { axis: "x", range: 230, speed: 0.9, phase: 1.5 } },
    ],
  },
  {
    name: "Lava Forge", desc: "molten pit · rising embers",
    sky: ["#0d0202", "#3d0b06"], ground: "#53342c", plat: "#7d4f40", accent: "#ff7a3c",
    lava: true, deathY: H - 28,
    platforms: [
      { x: 0, y: H - 60, w: 320, h: 60 },
      { x: W - 320, y: H - 60, w: 320, h: 60 },
      { x: W / 2 - 70, y: H - 150, w: 140, h: 16, move: { axis: "x", range: 150, speed: 1.4, phase: 0 } },
      { x: 200, y: 260, w: 140, h: 14 },
      { x: W - 340, y: 260, w: 140, h: 14 },
      { x: W / 2 - 65, y: 170, w: 130, h: 14, move: { axis: "y", range: 60, speed: 1.7, phase: 2 } },
    ],
  },
];

const KEYS = {
  p1: { left: "KeyA", right: "KeyD", jump: "KeyW", dash: "KeyS", attack: "KeyF", block: "KeyG", kick: "KeyH" },
  p2: { left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp", dash: "ArrowDown", attack: "KeyK", block: "KeyL", kick: "KeyJ" },
};

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
    swing: (step = 0) => noise(0.12, 1800 + step * 400, 0.22, 2),
    spin: () => { noise(0.2, 1400, 0.26, 1.5); tone(500, 0.2, "sawtooth", 0.1, 300); },
    thrust: () => noise(0.09, 2600, 0.24, 3),
    heavySwing: () => { noise(0.22, 800, 0.32, 1); tone(150, 0.22, "sawtooth", 0.16, -60); },
    chargeTick: () => tone(1050, 0.1, "sine", 0.16, 200),
    kick: () => noise(0.09, 500, 0.3, 1),
    hit: (big = false) => { noise(big ? 0.2 : 0.15, big ? 500 : 700, big ? 0.42 : 0.35, 1); tone(big ? 90 : 120, 0.16, "square", 0.22, -60); },
    block: () => { tone(700, 0.08, "square", 0.16, -200); noise(0.06, 3200, 0.16, 3); },
    parry: () => { tone(1400, 0.32, "triangle", 0.26, 700); tone(2100, 0.26, "sine", 0.16, 500); },
    guardbreak: () => { tone(220, 0.26, "sawtooth", 0.26, -140); noise(0.2, 900, 0.32, 1); },
    dash: () => noise(0.15, 900, 0.16, 0.8),
    jump: () => tone(300, 0.12, "sine", 0.13, 220),
    land: () => noise(0.07, 300, 0.14, 0.7),
    plunge: () => { noise(0.28, 380, 0.42, 0.8); tone(80, 0.28, "sine", 0.3, -40); },
    ko: () => { tone(420, 0.55, "sawtooth", 0.26, -340); noise(0.4, 500, 0.3, 0.7); },
    beep: (final) => tone(final ? 880 : 440, 0.13, "square", 0.16),
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.26, "triangle", 0.2, 0, i * 0.13)),
    fanfare: () => [392, 523, 659, 784, 1046, 1319].forEach((f, i) => tone(f, 0.3, "triangle", 0.2, 0, i * 0.15)),
  };
}
const SFX = makeSFX();

function MapFighter({ color, facing = 1, delay = 0 }) {
  // Draw facing-right locally, then mirror for P2 so limbs stay connected
  const d = `${delay}s`;
  return (
    <svg width="48" height="56" viewBox="0 0 48 56" style={{ display: "block", overflow: "visible" }}>
      <g transform={facing === -1 ? "translate(48,0) scale(-1,1)" : undefined}>
        {/* legs — rotate around hip */}
        <g transform="translate(22, 34)">
          <g>
            <animateTransform attributeName="transform" type="rotate"
              values="-18;16;-18" dur="0.5s" begin={d} repeatCount="indefinite" />
            <line x1="0" y1="0" x2="-8" y2="18" stroke="#f4f7fb" strokeWidth="2.6" strokeLinecap="round" />
          </g>
          <g>
            <animateTransform attributeName="transform" type="rotate"
              values="16;-18;16" dur="0.5s" begin={d} repeatCount="indefinite" />
            <line x1="0" y1="0" x2="9" y2="18" stroke="#f4f7fb" strokeWidth="2.6" strokeLinecap="round" />
          </g>
        </g>

        <line x1="22" y1="34" x2="22" y2="16" stroke="#f4f7fb" strokeWidth="2.8" strokeLinecap="round" />

        <circle cx="22" cy="10" r="5.5" fill="none" stroke="#f4f7fb" strokeWidth="2.5" />
        <path d="M16.8 8.2 A5.5 5.5 0 0 1 27.2 8.2" fill="none" stroke={color} strokeWidth="2"
          style={{ filter: `drop-shadow(0 0 3px ${color})` }} />

        <line x1="22" y1="18" x2="13" y2="28" stroke="#f4f7fb" strokeWidth="2.4" strokeLinecap="round" />

        {/* sword arm — rotate around shoulder */}
        <g transform="translate(22, 18)">
          <g>
            <animateTransform attributeName="transform" type="rotate"
              values="-55;45;-55" dur="1.05s" begin={d} repeatCount="indefinite"
              keyTimes="0;0.42;1" calcMode="spline"
              keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />
            <line x1="0" y1="0" x2="11" y2="8" stroke="#f4f7fb" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="8" y1="5" x2="14" y2="12" stroke="#2a2f38" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="10" y1="7" x2="24" y2="-8" stroke={color} strokeWidth="3.4" strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
            <line x1="11" y1="6" x2="23" y2="-7" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" />
          </g>
        </g>
      </g>
    </svg>
  );
}

function MapIconPreview({ map, index }) {
  return (
    <div
      className="map-icon"
      style={{ "--sky0": map.sky[0], "--sky1": map.sky[1], "--plat": map.plat, "--accent": map.accent }}
    >
      {/* map-specific ambient layers */}
      {index === 0 && (
        <div className="map-icon__layer">
          <div className="map-crowd">
            {Array.from({ length: 12 }, (_, i) => <span key={i} />)}
          </div>
          <div className="map-banner" style={{ left: 28, background: "#8a1f2d" }} />
          <div className="map-banner" style={{ right: 28, background: "#1f3f8a", animationDelay: "0.4s" }} />
          <div className="map-torch" style={{ left: 16 }} />
          <div className="map-torch" style={{ right: 16 }} />
        </div>
      )}
      {index === 1 && (
        <div className="map-icon__layer">
          <div className="map-aurora" />
          {[
            [18, 14, 0], [48, 22, 0.4], [86, 12, 0.8], [120, 28, 1.2],
            [155, 16, 0.2], [172, 34, 1.5], [70, 40, 0.6],
          ].map(([x, y, d], i) => (
            <div key={i} className="map-star" style={{ left: x, top: y, animationDelay: `${d}s` }} />
          ))}
          <div className="map-cloud" style={{ top: 48, left: 10, width: 46, animationDuration: "9s" }} />
          <div className="map-cloud" style={{ top: 58, left: 90, width: 34, animationDuration: "11s", animationDelay: "-3s" }} />
          <div className="map-lantern" style={{ left: 36, animationDelay: "0s" }} />
          <div className="map-lantern" style={{ left: 120, animationDelay: "1.6s" }} />
          <div className="map-lantern" style={{ left: 160, animationDelay: "3s" }} />
        </div>
      )}
      {index === 2 && (
        <div className="map-icon__layer">
          <div className="map-volcano" />
          <div className="map-lava" />
          {[
            [40, 0], [70, 0.4], [100, 0.9], [130, 0.2], [160, 1.3], [55, 1.7], [145, 0.6],
          ].map(([x, d], i) => (
            <div key={i} className="map-ember" style={{ left: x, animationDelay: `${d}s`, animationDuration: `${1.8 + (i % 3) * 0.4}s` }} />
          ))}
        </div>
      )}

      <div className="map-icon__ground" style={index === 2 ? { left: 8, right: "auto", width: 54 } : undefined} />
      {index === 2 && <div className="map-icon__ground" style={{ left: "auto", right: 8, width: 54 }} />}
      <div
        className="map-icon__plat"
        style={{
          bottom: index === 2 ? 36 : 42,
          left: index === 1 ? 70 : 62,
          width: index === 1 ? 54 : 48,
          animationDuration: index === 1 ? "2.6s" : "3.2s",
        }}
      />

      <div className="map-icon__fighters">
        <div className="map-icon__fighter map-icon__fighter--p1">
          <MapFighter color="#3aa0ff" facing={1} delay={0} />
        </div>
        <div className="map-icon__spark" />
        <div className="map-icon__fighter map-icon__fighter--p2">
          <MapFighter color="#ff3b4d" facing={-1} delay={0} />
        </div>
      </div>
    </div>
  );
}

function makePlayer(id, x, facing) {
  return {
    id, x, y: 200, vx: 0, vy: 0, facing,
    body: "#f4f7fb",
    neon: id === 0 ? "#3aa0ff" : "#ff3b4d",
    glow: id === 0 ? "#7cc8ff" : "#ff8090",
    hp: MAX_HP, onGround: false, wasGround: false, groundVX: 0,
    atk: null, attackCd: 0,          // atk = { type, t, hasHit }
    chargeT: -1, chargeTicked: false,
    chainT: 0, chainNext: null,      // combo chaining
    kickT: -1, kickCd: 0, kickHit: false,
    plunging: false,
    blocking: false, blockStart: -99, guardBreakT: 0,
    stunT: 0, dashT: 0, dashCd: 0, hurtFlash: 0,
    runPhase: 0, dead: false, deathT: 0, victory: false,
    wobble: Math.random() * 6, trail: [],
  };
}

export default function StickmanSwordDuel() {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState("menu");
  const [mapIdx, setMapIdx] = useState(0);
  const [score, setScore] = useState([0, 0]);
  const [matchWinner, setMatchWinner] = useState(0);
  const [muted, setMuted] = useState(false);
  const stateRef = useRef({});

  useEffect(() => { SFX.setMuted(muted); }, [muted]);

  const startMatch = (mi) => {
    SFX.unlock();
    setMapIdx(mi); setScore([0, 0]); setMatchWinner(0);
    setPhase("playing");
    stateRef.current.launch = { mapIdx: mi };
  };

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const mi = stateRef.current.launch.mapIdx;
    const map = MAPS[mi];

    const S = {
      map,
      platOffsets: map.platforms.map(() => ({ dx: 0, dy: 0, pdx: 0, pdy: 0 })),
      players: [], keys: {}, pressed: {},
      t: 0, mode: "countdown", modeT: 0, lastBeep: -1,
      round: 1, wins: [0, 0], roundWinner: 0,
      particles: [], texts: [], rings: [], bgParts: [],
      stars: Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * (H * 0.7), r: Math.random() * 1.6 + 0.4, ph: Math.random() * 6 })),
      crowd: Array.from({ length: 46 }, (_, i) => ({ x: 30 + i * 19, ph: Math.random() * 6, h: 10 + Math.random() * 8 })),
      shake: 0, slowmo: 0, banner: "", bannerT: 0, bannerCol: "#ffe97a", flash: 0, done: false,
    };

    const resetRound = () => {
      S.players = [makePlayer(0, 180, 1), makePlayer(1, W - 180, -1)];
      S.mode = "countdown"; S.modeT = 0; S.lastBeep = -1;
      S.particles = []; S.texts = []; S.rings = [];
    };
    resetRound();

    const down = (e) => {
      const all = [...Object.values(KEYS.p1), ...Object.values(KEYS.p2)];
      if (all.includes(e.code)) e.preventDefault();
      if (!S.keys[e.code]) S.pressed[e.code] = true;
      S.keys[e.code] = true;
    };
    const up = (e) => { S.keys[e.code] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    // ---------- fx helpers ----------
    const spark = (x, y, color, n = 10, spd = 260, upBias = 60) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = spd * (0.4 + Math.random() * 0.8);
        S.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - upBias, life: 0.5, max: 0.5, color, r: 2 + Math.random() * 3, glow: true });
      }
    };
    const dust = (x, y, n = 6) => {
      for (let i = 0; i < n; i++) {
        S.particles.push({ x: x + (Math.random() - 0.5) * 24, y, vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 60, life: 0.4, max: 0.4, color: "rgba(220,220,220,0.6)", r: 3 + Math.random() * 3, grav: 0.3 });
      }
    };
    const dmgText = (x, y, str, color, size = 18) => S.texts.push({ x, y, vy: -80, life: 0.8, max: 0.8, str, color, size });
    const ring = (x, y, color, max = 90) => S.rings.push({ x, y, r: 10, max, life: 0.35, t: 0.35, color });
    const setBanner = (str, col = "#ffe97a", t = 0.8) => { S.banner = str; S.bannerCol = col; S.bannerT = t; };

    // ---------- attack helpers ----------
    const startAttack = (p, type) => {
      p.atk = { type, t: 0, hasHit: false };
      p.chainT = 0; p.chainNext = null;
      const A = ATTACKS[type];
      if (type === "slash1") SFX.swing(0);
      if (type === "slash2") SFX.swing(1);
      if (type === "spin") SFX.spin();
      if (type === "thrust") { SFX.thrust(); p.dashT = 0; }
      if (type === "heavy") SFX.heavySwing();
      if (A.label) setBanner(A.label, p.glow, 0.6);
    };

    const swordAngle = (p) => {
      if (p.victory) return -1.9 + Math.sin(S.t * 3) * 0.05;
      if (p.plunging) return 1.35;
      if (p.chargeT >= 0) return -2.15 - Math.min(1, p.chargeT / CHARGE_TIME) * 0.25; // wind further back while charging
      if (p.atk) {
        const A = ATTACKS[p.atk.type], t = p.atk.t;
        const total = A.startup + A.active + A.recovery;
        switch (p.atk.type) {
          case "slash1": {
            if (t < A.startup) return -2.1 + (t / A.startup) * 0.5;
            if (t < A.startup + A.active) return -1.6 + ((t - A.startup) / A.active) * 2.4;
            return 0.8 - ((t - A.startup - A.active) / A.recovery) * 1.0;
          }
          case "slash2": { // reverse cut: low → high
            if (t < A.startup) return 0.9 - (t / A.startup) * 0.3;
            if (t < A.startup + A.active) return 0.6 - ((t - A.startup) / A.active) * 2.3;
            return -1.7 + ((t - A.startup - A.active) / A.recovery) * 1.0;
          }
          case "spin": { // full 360°
            const k = Math.min(1, t / (A.startup + A.active));
            return -1.6 + k * Math.PI * 2;
          }
          case "thrust": {
            if (t < A.startup) return -0.5 + (t / A.startup) * 0.5;
            if (t < A.startup + A.active) return 0.02;
            return 0.02 - ((t - A.startup - A.active) / A.recovery) * 0.6;
          }
          case "heavy": { // huge overhead slam
            if (t < A.startup) return -2.4 + (t / A.startup) * 0.3;
            if (t < A.startup + A.active) return -2.1 + ((t - A.startup) / A.active) * 3.3;
            return 1.2 - ((t - A.startup - A.active) / A.recovery) * 1.9;
          }
          default: return -0.7;
        }
      }
      if (p.blocking) return -1.15;
      return -0.7 + Math.sin(S.t * 2 + p.wobble) * 0.06;
    };

    // ---------- update ----------
    const updatePlayer = (p, foe, dt, keys) => {
      const canAct = S.mode === "fight" && p.stunT <= 0 && !p.dead;
      const attacking = !!p.atk;
      const charging = p.chargeT >= 0;
      const kicking = p.kickT >= 0;

      if (p.attackCd > 0) p.attackCd -= dt;
      if (p.kickCd > 0) p.kickCd -= dt;
      if (p.dashCd > 0) p.dashCd -= dt;
      if (p.stunT > 0) p.stunT -= dt;
      if (p.guardBreakT > 0) p.guardBreakT -= dt;
      if (p.hurtFlash > 0) p.hurtFlash -= dt;
      if (p.chainT > 0) { p.chainT -= dt; if (p.chainT <= 0) p.chainNext = null; }
      if (p.dead) p.deathT += dt;
      if (!canAct) { p.chargeT = -1; p.chargeTicked = false; }

      // block
      const wantBlock = canAct && S.keys[keys.block] && !attacking && !kicking && !charging && p.dashT <= 0 && p.guardBreakT <= 0 && !p.plunging;
      if (wantBlock && !p.blocking) { p.blocking = true; p.blockStart = S.t; }
      if (!wantBlock) p.blocking = false;

      // dash
      if (canAct && S.pressed[keys.dash] && p.dashCd <= 0 && !attacking && !kicking && !charging && !p.blocking && !p.plunging) {
        p.dashT = DASH.time; p.dashCd = DASH.cd;
        SFX.dash();
        spark(p.x, p.y - 30, p.neon, 6, 160);
      }

      // ----- ATTACK INPUT -----
      // press: thrust (if dashing) / plunge (if airborne) / begin charge (ground)
      if (canAct && S.pressed[keys.attack] && !attacking && !kicking && p.attackCd <= 0 && !p.blocking && !p.plunging && !charging) {
        if (p.dashT > 0) {
          startAttack(p, "thrust");
          p.vx = p.facing * 620; // lunge momentum
        } else if (!p.onGround) {
          p.plunging = true; p.vy = PLUNGE.fallSpeed; p.vx *= 0.3;
          SFX.swing(0);
        } else {
          p.chargeT = 0; p.chargeTicked = false;
        }
      }
      // charging: release → light (chain) or heavy
      if (charging) {
        p.chargeT += dt;
        if (p.chargeT >= CHARGE_TIME && !p.chargeTicked) {
          p.chargeTicked = true;
          SFX.chargeTick();
          spark(p.x + p.facing * 20, p.y - 60, "#ffffff", 6, 140, 20);
        }
        // charge sparkles gathering on the blade
        if (Math.random() < 0.35) {
          S.particles.push({
            x: p.x + p.facing * (26 + Math.random() * 30), y: p.y - 70 + Math.random() * 30,
            vx: -p.facing * 60, vy: (Math.random() - 0.5) * 40,
            life: 0.25, max: 0.25, color: p.chargeTicked ? "#ffffff" : p.neon, r: 1.5 + Math.random() * 2, glow: true, grav: 0,
          });
        }
        if (!S.keys[keys.attack]) { // released
          if (p.chargeT >= CHARGE_TIME) startAttack(p, "heavy");
          else if (p.chainNext) startAttack(p, p.chainNext);
          else startAttack(p, "slash1");
          p.chargeT = -1; p.chargeTicked = false;
        }
      }
      // progress attack
      if (p.atk) {
        const A = ATTACKS[p.atk.type];
        p.atk.t += dt;
        if (p.atk.t > A.startup + A.active + A.recovery) {
          // open combo chain window after light hits
          if (p.atk.type === "slash1") { p.chainT = CHAIN_WINDOW; p.chainNext = "slash2"; }
          if (p.atk.type === "slash2") { p.chainT = CHAIN_WINDOW; p.chainNext = "spin"; }
          p.atk = null;
          p.attackCd = 0.05;
        }
      }

      // kick
      if (canAct && S.pressed[keys.kick] && !attacking && !kicking && !charging && p.kickCd <= 0 && !p.blocking && p.dashT <= 0 && !p.plunging) {
        p.kickT = 0; p.kickHit = false;
        SFX.kick();
      }
      if (kicking) {
        p.kickT += dt;
        if (p.kickT > KICK.startup + KICK.active + KICK.recovery) { p.kickT = -1; p.kickCd = KICK.cd; }
      }

      // horizontal movement
      const atkLock = p.atk && p.atk.t < ATTACKS[p.atk.type].startup + ATTACKS[p.atk.type].active && p.atk.type !== "thrust";
      let ax = 0;
      if (p.dashT > 0) {
        p.dashT -= dt;
        p.vx = p.facing * DASH.speed;
      } else if (p.atk && p.atk.type === "thrust") {
        p.vx *= 0.92; // gliding lunge
      } else if (canAct && !p.blocking && !p.plunging && !charging && !atkLock && !(kicking && p.kickT < KICK.startup + KICK.active)) {
        if (S.keys[keys.left]) ax -= 1;
        if (S.keys[keys.right]) ax += 1;
        p.vx = ax * MOVE;
        if (ax !== 0) p.facing = ax > 0 ? 1 : -1;
      } else if (charging) {
        if (S.keys[keys.left]) ax -= 1;
        if (S.keys[keys.right]) ax += 1;
        p.vx = ax * MOVE * 0.35; // slow shuffle while charging
      } else if (!p.plunging) {
        p.vx *= p.onGround ? 0.8 : 0.98;
      }

      if (canAct && ax === 0 && p.dashT <= 0 && !attacking && !kicking && !charging) p.facing = foe.x > p.x ? 1 : -1;

      // jump
      if (canAct && S.pressed[keys.jump] && p.onGround && !p.blocking && !charging && !atkLock) {
        p.vy = -JUMP; p.onGround = false;
        SFX.jump();
        dust(p.x, p.y, 5);
      }

      // physics
      if (p.plunging) p.vy = PLUNGE.fallSpeed;
      else { p.vy += GRAV * dt; if (p.vy > 1250) p.vy = 1250; }
      const prevBottom = p.y;
      p.x += (p.vx + p.groundVX) * dt;
      p.y += p.vy * dt;
      p.x = Math.max(14, Math.min(W - 14, p.x));

      const fallSpeed = p.vy;
      p.wasGround = p.onGround;
      p.onGround = false; p.groundVX = 0;
      S.map.platforms.forEach((pl, i) => {
        const o = S.platOffsets[i];
        const px = pl.x + o.dx, py = pl.y + o.dy;
        if (p.vy >= 0 && p.x > px - 6 && p.x < px + pl.w + 6) {
          if (prevBottom <= py + 6 && p.y >= py && p.y <= py + pl.h + 18) {
            p.y = py; p.vy = 0; p.onGround = true;
            p.groundVX = o.pdx / dt || 0;
            if (o.pdy < 0) p.y += o.pdy;
          }
        }
      });

      // landing
      if (p.onGround && !p.wasGround) {
        if (p.plunging) {
          p.plunging = false;
          SFX.plunge();
          S.shake = 0.32;
          ring(p.x, p.y - 6, p.neon, PLUNGE.radius + 20);
          spark(p.x, p.y - 8, p.neon, 16, 340, 120);
          dust(p.x, p.y, 10);
          const dx = foe.x - p.x, dy = (foe.y - 40) - (p.y - 10);
          if (!foe.dead && Math.sqrt(dx * dx + dy * dy) < PLUNGE.radius) {
            foe.hp = Math.max(0, foe.hp - PLUNGE.dmg);
            foe.hurtFlash = 0.2;
            foe.vx = Math.sign(dx || p.facing) * 380; foe.vy = -420;
            dmgText(foe.x, foe.y - 90, `-${PLUNGE.dmg}`, p.glow);
            SFX.hit(true);
            if (foe.hp <= 0) { foe.dead = true; S.slowmo = 0.5; S.shake = 0.4; SFX.ko(); }
          }
        } else if (fallSpeed > 500) {
          dust(p.x, p.y, 6);
          SFX.land();
        }
      }

      if (p.onGround && Math.abs(p.vx) > 40) p.runPhase += dt * 13;
      else p.runPhase *= 0.9;

      // neon trail during active frames / plunge
      const A = p.atk ? ATTACKS[p.atk.type] : null;
      const activeSlash = (A && p.atk.t >= A.startup && p.atk.t <= A.startup + A.active) || p.plunging;
      if (activeSlash) {
        const ang = swordAngle(p), aF = p.facing;
        const sx = p.x, sy = p.y - 62;
        const heavy = p.atk && p.atk.type === "heavy";
        const blade = heavy ? 50 : 42;
        const hx = sx + Math.cos(ang) * 18 * aF, hy = sy + Math.sin(ang) * 18 + 6;
        const tx = hx + Math.cos(ang) * blade * aF, ty = hy + Math.sin(ang) * blade;
        p.trail.push({ x1: hx, y1: hy, x2: tx, y2: ty, life: heavy ? 0.3 : 0.22, max: heavy ? 0.3 : 0.22, wide: heavy });
      }
      p.trail = p.trail.filter((tr) => { tr.life -= dt; return tr.life > 0; });

      // fall / lava death
      if (p.y > S.map.deathY && !p.dead && S.mode === "fight") {
        p.dead = true; p.hp = 0;
        SFX.ko();
        spark(p.x, Math.min(p.y, H - 20), S.map.lava ? "#ff7a3c" : "#ffffff", 22, 320);
        S.shake = 0.35;
      }
    };

    const resolveHits = () => {
      if (S.mode !== "fight") return;
      for (const p of S.players) {
        const foe = S.players[1 - p.id];
        if (foe.dead) continue;

        // ----- sword attacks -----
        if (p.atk) {
          const A = ATTACKS[p.atk.type];
          const active = p.atk.t >= A.startup && p.atk.t <= A.startup + A.active;
          if (active && !p.atk.hasHit) {
            let hitLanded = false;
            if (p.atk.type === "spin") {
              const dx = foe.x - p.x, dy = (foe.y - 40) - (p.y - 42);
              hitLanded = dx * dx + dy * dy < A.reach * A.reach; // hits both sides!
            } else {
              const hx = p.x + p.facing * A.reach, hy = p.y - 42;
              const dx = hx - foe.x, dy = hy - (foe.y - 40);
              hitLanded = dx * dx + dy * dy < 46 * 46;
            }
            if (hitLanded) {
              p.atk.hasHit = true;
              const facingAttacker = (foe.facing === 1) === (p.x > foe.x);
              if (foe.blocking && facingAttacker) {
                const inParry = S.t - foe.blockStart <= PARRY_WINDOW;
                if (inParry) {
                  // PARRY beats everything, even heavies
                  p.stunT = STUN_TIME; p.atk = null; p.chargeT = -1;
                  p.vx = -p.facing * 280; p.vy = -280;
                  SFX.parry();
                  S.flash = 0.12;
                  spark((p.x + foe.x) / 2, foe.y - 45, "#ffe97a", 20, 400);
                  ring((p.x + foe.x) / 2, foe.y - 45, "#ffe97a", 70);
                  S.shake = 0.3; S.slowmo = 0.35;
                  setBanner(`P${foe.id + 1} PARRY!`, "#ffe97a", 0.9);
                } else if (A.guardCrush) {
                  // heavy smashes through the guard
                  foe.blocking = false;
                  foe.guardBreakT = 0.9; foe.stunT = 0.6;
                  foe.hp = Math.max(0, foe.hp - 10);
                  foe.hurtFlash = 0.15;
                  foe.vx = p.facing * 380; foe.vy = -160;
                  SFX.guardbreak();
                  spark(foe.x, foe.y - 45, "#ffb347", 16, 340);
                  ring(foe.x, foe.y - 45, "#ffb347", 70);
                  dmgText(foe.x, foe.y - 90, "-10 CRUSH", "#ffb347");
                  setBanner("GUARD CRUSHED!", "#ffb347", 0.8);
                  S.shake = 0.25;
                  if (foe.hp <= 0) { foe.dead = true; S.slowmo = 0.5; SFX.ko(); }
                } else {
                  foe.hp = Math.max(0, foe.hp - 2);
                  foe.vx = p.facing * 220;
                  SFX.block();
                  spark(foe.x - foe.facing * 18, foe.y - 45, "#cfd8e3", 8, 200);
                  dmgText(foe.x, foe.y - 90, "-2", "#cfd8e3", 14);
                  S.shake = 0.08;
                }
              } else {
                const big = A.dmg >= 13;
                foe.hp = Math.max(0, foe.hp - A.dmg);
                foe.hurtFlash = 0.18;
                foe.vx = p.facing * A.kb;
                foe.vy = A.launch !== undefined ? A.launch : -180;
                SFX.hit(big);
                spark(foe.x, foe.y - 45, p.glow, big ? 16 : 12, big ? 360 : 300);
                dmgText(foe.x, foe.y - 90, `-${A.dmg}`, p.glow, big ? 22 : 18);
                if (p.atk.type === "spin") ring(p.x, p.y - 42, p.neon, A.reach + 8);
                S.shake = big ? 0.24 : 0.16;
                if (foe.hp <= 0) { foe.dead = true; S.slowmo = 0.5; S.shake = 0.4; SFX.ko(); }
              }
            }
          }
        }

        // ----- kick (guard break) -----
        const kickActive = p.kickT >= KICK.startup && p.kickT <= KICK.startup + KICK.active;
        if (kickActive && !p.kickHit) {
          const hx = p.x + p.facing * 34, hy = p.y - 30;
          const dx = hx - foe.x, dy = hy - (foe.y - 36);
          if (dx * dx + dy * dy < 40 * 40) {
            p.kickHit = true;
            const facingAttacker = (foe.facing === 1) === (p.x > foe.x);
            if (foe.blocking && facingAttacker) {
              foe.blocking = false;
              foe.guardBreakT = 0.9; foe.stunT = 0.7;
              foe.vx = p.facing * 300;
              SFX.guardbreak();
              spark(foe.x, foe.y - 45, "#ffb347", 14, 300);
              ring(foe.x, foe.y - 45, "#ffb347", 60);
              setBanner("GUARD BREAK!", "#ffb347", 0.8);
              S.shake = 0.2;
            } else {
              foe.hp = Math.max(0, foe.hp - KICK.dmg);
              foe.hurtFlash = 0.12;
              foe.vx = p.facing * 420; foe.vy = -160;
              SFX.hit();
              dmgText(foe.x, foe.y - 90, `-${KICK.dmg}`, "#ffffff", 14);
              spark(foe.x, foe.y - 40, "#ffffff", 8, 240);
              S.shake = 0.1;
              if (foe.hp <= 0) { foe.dead = true; S.slowmo = 0.5; SFX.ko(); }
            }
          }
        }
      }
    };

    // ---------- backgrounds ----------
    const drawColosseumBG = () => {
      ctx.save();
      ctx.shadowColor = "#ffe9c9"; ctx.shadowBlur = 40;
      ctx.fillStyle = "#ffeed4";
      ctx.beginPath(); ctx.arc(760, 80, 34, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#0a0508";
      ctx.fillRect(0, 120, W, 60);
      ctx.fillStyle = "#1c0f14";
      S.crowd.forEach((c) => {
        const bob = Math.sin(S.t * 3 + c.ph) * 3;
        ctx.beginPath();
        ctx.arc(c.x, 150 + bob, 8, Math.PI, 0);
        ctx.rect(c.x - 8, 150 + bob, 16, c.h);
        ctx.fill();
      });
      for (let i = 0; i < 6; i++) {
        const tw = Math.sin(S.t * 2.5 + i * 2.1);
        if (tw > 0.7) {
          ctx.fillStyle = "rgba(255,240,200,0.8)";
          ctx.fillRect(60 + i * 140 + Math.sin(i * 9) * 30, 132, 2, 2);
        }
      }
      [[110, H - 60], [W - 110, H - 60]].forEach(([tx, ty], ti) => {
        ctx.strokeStyle = "#3d2415"; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty - 130); ctx.stroke();
        const fy = ty - 138;
        for (let l = 0; l < 3; l++) {
          const fl = Math.sin(S.t * (9 + l * 3) + ti * 3) * 4;
          const r = 16 - l * 4;
          ctx.save();
          ctx.shadowColor = "#ff9a3c"; ctx.shadowBlur = 24;
          ctx.fillStyle = ["#ff5c1a", "#ffa23c", "#ffe08a"][l];
          ctx.beginPath();
          ctx.ellipse(tx + fl * 0.4, fy - l * 5 + fl * 0.3, r * 0.6, r, fl * 0.02, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        if (Math.random() < 0.25) S.bgParts.push({ x: tx + (Math.random() - 0.5) * 12, y: fy, vx: (Math.random() - 0.5) * 20, vy: -50 - Math.random() * 50, life: 1.2, max: 1.2, color: "#ffb85c", r: 1.5 + Math.random() * 1.5, glow: true });
      });
      [[240, 100, "#8a1f2d"], [W - 240, 100, "#1f3f8a"]].forEach(([bx, by, col]) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(bx - 16, by);
        for (let yy = 0; yy <= 70; yy += 10) ctx.lineTo(bx + 16 + Math.sin(S.t * 4 + yy * 0.12) * 5, by + yy);
        for (let yy = 70; yy >= 0; yy -= 10) ctx.lineTo(bx - 16 + Math.sin(S.t * 4 + yy * 0.12) * 5, by + yy);
        ctx.fill();
        ctx.strokeStyle = "#c9a05a"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(bx - 20, by); ctx.lineTo(bx + 20, by); ctx.stroke();
      });
    };

    const drawSkyShrineBG = () => {
      S.stars.forEach((st) => {
        const a = 0.35 + 0.6 * Math.abs(Math.sin(S.t * 1.4 + st.ph));
        ctx.fillStyle = `rgba(220,235,255,${a})`;
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
      });
      for (let rIdx = 0; rIdx < 2; rIdx++) {
        ctx.save();
        ctx.globalAlpha = 0.16;
        const hue = rIdx === 0 ? "140,255,190" : "130,180,255";
        const grad = ctx.createLinearGradient(0, 40, 0, 200);
        grad.addColorStop(0, `rgba(${hue},0.9)`); grad.addColorStop(1, `rgba(${hue},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-20, 70);
        for (let x = 0; x <= W + 20; x += 30) ctx.lineTo(x, 70 + rIdx * 40 + Math.sin(S.t * 0.7 + x * 0.012 + rIdx * 2) * 26);
        for (let x = W + 20; x >= -20; x -= 30) ctx.lineTo(x, 190 + rIdx * 40 + Math.sin(S.t * 0.7 + x * 0.012 + rIdx * 2) * 26);
        ctx.fill();
        ctx.restore();
      }
      for (let i = 0; i < 4; i++) {
        const cx = ((i * 260 + S.t * (14 + i * 4)) % (W + 240)) - 120;
        const cy = 260 + i * 46;
        ctx.fillStyle = "rgba(160,190,230,0.14)";
        ctx.beginPath();
        ctx.ellipse(cx, cy, 90, 18, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 50, cy + 6, 60, 14, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (Math.random() < 0.02) S.bgParts.push({ x: Math.random() * W, y: H + 10, vx: Math.sin(Math.random() * 6) * 8, vy: -22 - Math.random() * 14, life: 14, max: 14, color: "#ffd27a", r: 4, lantern: true, glow: true });
    };

    const drawLavaBG = () => {
      ctx.fillStyle = "#1c0906";
      ctx.beginPath();
      ctx.moveTo(W / 2 - 240, H - 60); ctx.lineTo(W / 2 - 60, 120); ctx.lineTo(W / 2 + 60, 120); ctx.lineTo(W / 2 + 240, H - 60);
      ctx.fill();
      const pulse = 0.5 + 0.5 * Math.sin(S.t * 1.6);
      ctx.save();
      ctx.shadowColor = "#ff5c1a"; ctx.shadowBlur = 30 + pulse * 30;
      ctx.fillStyle = `rgba(255,110,40,${0.5 + pulse * 0.4})`;
      ctx.beginPath(); ctx.ellipse(W / 2, 122, 58, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (Math.random() < 0.12) S.bgParts.push({ x: W / 2 + (Math.random() - 0.5) * 80, y: 118, vx: (Math.random() - 0.5) * 14, vy: -26 - Math.random() * 18, life: 2.6, max: 2.6, color: "rgba(90,60,55,0.5)", r: 8 + Math.random() * 8, smoke: true });
      if (Math.random() < 0.35) S.bgParts.push({ x: Math.random() * W, y: H - 20, vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 70, life: 1.8, max: 1.8, color: Math.random() < 0.5 ? "#ff7a3c" : "#ffb85c", r: 1.5 + Math.random() * 2, glow: true, flicker: true });
    };

    const drawMap = () => {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, map.sky[0]); g.addColorStop(1, map.sky[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      if (mi === 0) drawColosseumBG();
      if (mi === 1) drawSkyShrineBG();
      if (mi === 2) drawLavaBG();

      S.bgParts = S.bgParts.filter((b) => {
        b.life -= 1 / 60;
        b.x += b.vx / 60; b.y += b.vy / 60;
        if (b.smoke) b.r += 0.08;
        const a = Math.max(0, Math.min(1, b.life / b.max));
        ctx.save();
        if (b.glow) { ctx.shadowColor = b.color; ctx.shadowBlur = 10; }
        ctx.globalAlpha = b.flicker ? a * (0.5 + 0.5 * Math.sin(S.t * 20 + b.x)) : a;
        ctx.fillStyle = b.color;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
        if (b.lantern) {
          ctx.strokeStyle = b.color; ctx.lineWidth = 1;
          ctx.strokeRect(b.x - 4, b.y - 6, 8, 10);
        }
        ctx.restore();
        return b.life > 0 && b.y > -30;
      });

      if (map.lava) {
        const ly = H - 26 + Math.sin(S.t * 2) * 3;
        const lg = ctx.createLinearGradient(0, ly, 0, H);
        lg.addColorStop(0, "#ff9a3c"); lg.addColorStop(1, "#c22a12");
        ctx.save();
        ctx.shadowColor = "#ff6a2c"; ctx.shadowBlur = 26;
        ctx.fillStyle = lg; ctx.fillRect(0, ly, W, H - ly);
        ctx.restore();
        ctx.fillStyle = "rgba(255,220,120,0.55)";
        for (let i = 0; i < 9; i++) {
          const bx = (i * 117 + Math.sin(S.t * 3 + i) * 30 + W) % W;
          ctx.beginPath(); ctx.arc(bx, ly + 6, 3 + Math.sin(S.t * 5 + i) * 2, 0, Math.PI * 2); ctx.fill();
        }
      }

      map.platforms.forEach((pl, i) => {
        const o = S.platOffsets[i];
        const px = pl.x + o.dx, py = pl.y + o.dy;
        ctx.fillStyle = pl.h > 30 ? map.ground : map.plat;
        ctx.fillRect(px, py, pl.w, pl.h);
        ctx.save();
        ctx.shadowColor = map.accent; ctx.shadowBlur = 8;
        ctx.fillStyle = map.accent;
        ctx.fillRect(px, py, pl.w, 3);
        ctx.restore();
        if (pl.move) {
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.fillRect(px + 6, py + pl.h - 4, pl.w - 12, 2);
        }
      });
    };

    // ---------- stickman ----------
    const drawStickman = (p) => {
      ctx.save();
      if (p.dead) {
        const k = Math.min(1, p.deathT * 2.2);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.facing * -1 * k * Math.PI / 2);
        ctx.translate(-p.x, -p.y);
        ctx.globalAlpha = 0.85;
      }

      const hy = p.y - 78, hip = p.y - 34, neck = p.y - 66;
      if (p.hurtFlash > 0) ctx.globalAlpha = 0.55 + 0.45 * Math.sin(S.t * 60);

      const bodyCol = p.dead ? "#9aa1ab" : p.body;
      ctx.strokeStyle = bodyCol;
      ctx.lineWidth = 5; ctx.lineCap = "round";

      const isThrust = p.atk && p.atk.type === "thrust";
      const lean = p.dashT > 0 || isThrust ? p.facing * 0.35 : (p.chargeT >= 0 ? -p.facing * 0.15 : 0);
      const airPose = !p.onGround && !p.dead;
      const hx = p.x + lean * 14;

      // legs
      ctx.beginPath();
      if (p.plunging) {
        ctx.moveTo(p.x, hip); ctx.lineTo(p.x - 10, p.y - 12);
        ctx.moveTo(p.x, hip); ctx.lineTo(p.x + 10, p.y - 12);
      } else if (isThrust) { // deep lunge stance
        ctx.moveTo(p.x, hip); ctx.lineTo(p.x + p.facing * 22, p.y);
        ctx.moveTo(p.x, hip); ctx.lineTo(p.x - p.facing * 18, p.y);
      } else if (airPose) {
        ctx.moveTo(p.x, hip); ctx.lineTo(p.x - 9 * p.facing, p.y - 10);
        ctx.moveTo(p.x, hip); ctx.lineTo(p.x + 11 * p.facing, p.y - 6);
      } else {
        const kickLeg = p.kickT >= 0 && p.kickT <= KICK.startup + KICK.active;
        const lp = Math.sin(p.runPhase) * 14;
        ctx.moveTo(p.x, hip); ctx.lineTo(p.x - 8 + lp * 0.6, p.y);
        ctx.moveTo(p.x, hip);
        if (kickLeg) ctx.lineTo(p.x + p.facing * 34, p.y - 28);
        else ctx.lineTo(p.x + 8 - lp * 0.6, p.y);
      }
      ctx.stroke();

      // torso + head
      ctx.beginPath(); ctx.moveTo(p.x, hip); ctx.lineTo(hx, neck); ctx.stroke();
      ctx.save();
      if (!p.dead) { ctx.shadowColor = p.neon; ctx.shadowBlur = 10; }
      ctx.beginPath(); ctx.arc(hx, hy + 2, 11, 0, Math.PI * 2); ctx.stroke();
      if (!p.dead) {
        ctx.strokeStyle = p.neon; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(hx, hy + 2, 11, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      }
      ctx.restore();

      if (p.stunT > 0) {
        ctx.fillStyle = "#ffe97a";
        for (let i = 0; i < 3; i++) {
          const a = S.t * 5 + (i * Math.PI * 2) / 3;
          ctx.beginPath(); ctx.arc(hx + Math.cos(a) * 18, hy - 12 + Math.sin(a) * 6, 2.4, 0, Math.PI * 2); ctx.fill();
        }
      }

      const shoulder = { x: hx, y: neck + 4 };
      ctx.strokeStyle = bodyCol; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y);
      ctx.lineTo(shoulder.x - p.facing * 10, shoulder.y + 16); ctx.stroke();

      // sword arm
      const ang = swordAngle(p);
      const aF = p.facing;
      const armLen = isThrust ? 24 : 18; // fully extended arm on thrust
      const hand = { x: shoulder.x + Math.cos(ang) * armLen * aF, y: shoulder.y + Math.sin(ang) * armLen + 6 };
      ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(hand.x, hand.y); ctx.stroke();

      // ------ NEON LED SWORD ------
      const heavyMove = (p.atk && p.atk.type === "heavy") || (p.chargeT >= CHARGE_TIME);
      const bladeLen = heavyMove ? 50 : 42;
      const chargeK = p.chargeT >= 0 ? Math.min(1, p.chargeT / CHARGE_TIME) : 0;
      const tip = { x: hand.x + Math.cos(ang) * bladeLen * aF, y: hand.y + Math.sin(ang) * bladeLen };
      ctx.save();
      ctx.shadowColor = chargeK >= 1 ? "#ffffff" : p.neon;
      ctx.shadowBlur = 18 + chargeK * 16;
      ctx.strokeStyle = p.neon; ctx.lineWidth = 7 + chargeK * 3; ctx.globalAlpha = 0.55 + chargeK * 0.25;
      ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
      ctx.globalAlpha = 1; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3 + chargeK * 1.5;
      ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = p.dead ? "#666" : "#2a2f38"; ctx.lineWidth = 4;
      const gx = Math.cos(ang + Math.PI / 2) * 6, gy = Math.sin(ang + Math.PI / 2) * 6;
      ctx.beginPath(); ctx.moveTo(hand.x - gx, hand.y - gy); ctx.lineTo(hand.x + gx, hand.y + gy); ctx.stroke();

      // charge aura circle
      if (p.chargeT >= 0) {
        ctx.save();
        ctx.shadowColor = chargeK >= 1 ? "#ffffff" : p.neon; ctx.shadowBlur = 12;
        ctx.strokeStyle = chargeK >= 1 ? "#ffffff" : p.neon;
        ctx.globalAlpha = 0.3 + chargeK * 0.4;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y - 48, 30 + Math.sin(S.t * 10) * 3 * chargeK, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      // neon slash trails
      p.trail.forEach((tr) => {
        const a = tr.life / tr.max;
        ctx.save();
        ctx.shadowColor = p.neon; ctx.shadowBlur = tr.wide ? 20 : 14;
        ctx.strokeStyle = p.neon; ctx.globalAlpha = a * 0.6; ctx.lineWidth = tr.wide ? 8 : 5;
        ctx.beginPath(); ctx.moveTo(tr.x1, tr.y1); ctx.lineTo(tr.x2, tr.y2); ctx.stroke();
        ctx.restore();
      });

      // move-specific arcs
      if (p.atk) {
        const A = ATTACKS[p.atk.type];
        const active = p.atk.t >= A.startup && p.atk.t <= A.startup + A.active;
        if (active) {
          const k = (p.atk.t - A.startup) / A.active;
          ctx.save();
          ctx.shadowColor = p.neon; ctx.shadowBlur = 16;
          ctx.strokeStyle = p.neon;
          const cx = shoulder.x, cy = shoulder.y + 4;
          if (p.atk.type === "spin") {
            ctx.globalAlpha = 0.7 - k * 0.4; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.arc(cx, cy, 56, 0, Math.PI * 2 * Math.min(1, k * 1.3)); ctx.stroke();
          } else if (p.atk.type === "thrust") {
            ctx.globalAlpha = 0.6 - k * 0.4; ctx.lineWidth = 3;
            for (let i = 1; i <= 3; i++) {
              ctx.beginPath();
              ctx.moveTo(hand.x - aF * i * 20, hand.y - 6 + i * 3);
              ctx.lineTo(hand.x - aF * (i * 20 - 14), hand.y - 6 + i * 3);
              ctx.stroke();
            }
          } else if (p.atk.type === "heavy") {
            ctx.globalAlpha = 0.85 - k * 0.5; ctx.lineWidth = 9;
            if (aF === 1) ctx.arc(cx, cy, 58, -2.1, -2.1 + k * 3.3);
            else ctx.arc(cx, cy, 58, Math.PI + 2.1, Math.PI + 2.1 - k * 3.3, true);
            ctx.stroke();
          } else if (p.atk.type === "slash2") {
            ctx.globalAlpha = 0.75 - k * 0.5; ctx.lineWidth = 6;
            ctx.beginPath();
            if (aF === 1) ctx.arc(cx, cy, 52, 0.6, 0.6 - k * 2.3, true);
            else ctx.arc(cx, cy, 52, Math.PI - 0.6, Math.PI - 0.6 + k * 2.3);
            ctx.stroke();
          } else {
            ctx.globalAlpha = 0.75 - k * 0.5; ctx.lineWidth = 6;
            ctx.beginPath();
            if (aF === 1) ctx.arc(cx, cy, 52, -1.4, -1.4 + k * 2.2);
            else ctx.arc(cx, cy, 52, Math.PI + 1.4, Math.PI + 1.4 - k * 2.2, true);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // combo-ready hint: small glowing pip when a chain is available
      if (p.chainT > 0 && !p.atk && !p.dead) {
        ctx.save();
        ctx.shadowColor = p.neon; ctx.shadowBlur = 8;
        ctx.fillStyle = p.neon; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.arc(p.x, hy - 18, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // block shield
      if (p.blocking) {
        const inParry = S.t - p.blockStart <= PARRY_WINDOW;
        ctx.save();
        ctx.shadowColor = inParry ? "#ffe97a" : p.neon; ctx.shadowBlur = 14;
        ctx.strokeStyle = inParry ? "#ffe97a" : "rgba(210,225,255,0.9)";
        ctx.lineWidth = inParry ? 6 : 4;
        ctx.beginPath();
        const c = aF === 1 ? 0 : Math.PI;
        ctx.arc(p.x + aF * 26, p.y - 46, 22, c - 1.2, c + 1.2);
        ctx.stroke();
        ctx.restore();
      }

      if (p.guardBreakT > 0 && !p.dead) {
        ctx.fillStyle = "rgba(255,179,71,0.9)";
        ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
        ctx.fillText("GUARD ✕", p.x, p.y - 96);
      }

      // dash afterimages
      if (p.dashT > 0) {
        ctx.save();
        ctx.shadowColor = p.neon; ctx.shadowBlur = 8;
        ctx.strokeStyle = p.neon; ctx.lineWidth = 5;
        for (let i = 1; i <= 3; i++) {
          ctx.globalAlpha = 0.35 / i;
          ctx.beginPath();
          ctx.moveTo(p.x - aF * i * 18, hip); ctx.lineTo(hx - aF * i * 18, neck);
          ctx.stroke();
        }
        ctx.restore();
      }

      // plunge streaks
      if (p.plunging) {
        ctx.save();
        ctx.shadowColor = p.neon; ctx.shadowBlur = 12;
        ctx.strokeStyle = p.neon; ctx.globalAlpha = 0.45; ctx.lineWidth = 4;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath(); ctx.moveTo(p.x - 8, p.y - 80 - i * 22); ctx.lineTo(p.x - 8, p.y - 60 - i * 22);
          ctx.moveTo(p.x + 8, p.y - 74 - i * 22); ctx.lineTo(p.x + 8, p.y - 54 - i * 22);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.restore();
    };

    // ---------- HUD ----------
    const drawHUD = () => {
      const bw = 320;
      const bar = (x, p, flip) => {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(x, 18, bw, 20);
        const w = (p.hp / MAX_HP) * (bw - 4);
        ctx.save();
        ctx.shadowColor = p.neon; ctx.shadowBlur = 10;
        ctx.fillStyle = p.neon;
        ctx.fillRect(flip ? x + 2 + (bw - 4 - w) : x + 2, 20, w, 16);
        ctx.restore();
        ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1.5;
        ctx.strokeRect(x, 18, bw, 20);
      };
      bar(24, S.players[0], false);
      bar(W - 24 - bw, S.players[1], true);
      ctx.fillStyle = "#fff"; ctx.font = "bold 12px monospace";
      ctx.textAlign = "left"; ctx.fillText("P1", 24, 52);
      ctx.textAlign = "right"; ctx.fillText("P2", W - 24, 52);

      ctx.textAlign = "center";
      for (let s = 0; s < 2; s++) {
        for (let i = 0; i < 3; i++) {
          const x = W / 2 + (s === 0 ? -1 : 1) * (26 + i * 20);
          ctx.save();
          if (i < S.wins[s]) { ctx.shadowColor = S.players[s].neon; ctx.shadowBlur = 8; }
          ctx.beginPath(); ctx.arc(x, 28, 6, 0, Math.PI * 2);
          ctx.fillStyle = i < S.wins[s] ? S.players[s].neon : "rgba(255,255,255,0.18)";
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.fillStyle = "#fff"; ctx.font = "bold 11px monospace";
      ctx.fillText(`ROUND ${S.round}`, W / 2, 52);

      const cds = (p, x, flip) => {
        const dir = flip ? -1 : 1;
        ctx.fillStyle = p.dashCd <= 0 ? "#7dffb0" : "rgba(255,255,255,0.25)";
        ctx.beginPath(); ctx.arc(x, 66, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = p.kickCd <= 0 ? "#ffb347" : "rgba(255,255,255,0.25)";
        ctx.beginPath(); ctx.arc(x + dir * 16, 66, 5, 0, Math.PI * 2); ctx.fill();
      };
      cds(S.players[0], 30, false); cds(S.players[1], W - 30, true);

      if (S.mode === "countdown") {
        const n = Math.ceil(3 - S.modeT);
        ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.shadowColor = "#fff"; ctx.shadowBlur = 20;
        ctx.fillStyle = "#fff"; ctx.font = "bold 90px monospace";
        ctx.fillText(n > 0 ? n : "FIGHT!", W / 2, H / 2);
        ctx.restore();
        ctx.font = "16px monospace";
        ctx.fillText(map.name, W / 2, H / 2 + 44);
      }
      if (S.bannerT > 0) {
        ctx.save();
        ctx.shadowColor = S.bannerCol; ctx.shadowBlur = 16;
        ctx.fillStyle = S.bannerCol; ctx.font = "bold 32px monospace";
        ctx.fillText(S.banner, W / 2, 130);
        ctx.restore();
      }
      if (S.mode === "roundEnd") {
        ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, W, H);
        const p = S.players[S.roundWinner];
        ctx.save();
        ctx.shadowColor = p.neon; ctx.shadowBlur = 24;
        ctx.fillStyle = p.neon; ctx.font = "bold 52px monospace";
        ctx.fillText(`P${S.roundWinner + 1} WINS ROUND ${S.round}`, W / 2, H / 2 - 10);
        ctx.restore();
        ctx.fillStyle = "#fff"; ctx.font = "16px monospace";
        ctx.fillText(`${S.wins[0]} — ${S.wins[1]}`, W / 2, H / 2 + 30);
      }
      if (S.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${S.flash * 3})`;
        ctx.fillRect(0, 0, W, H);
      }
    };

    // ---------- main loop ----------
    let raf, last = performance.now();
    const loop = (now) => {
      let dt = Math.min((now - last) / 1000, 0.033);
      last = now;
      if (S.slowmo > 0) { S.slowmo -= dt; dt *= 0.35; }
      S.t += dt;
      if (S.bannerT > 0) S.bannerT -= dt;
      if (S.flash > 0) S.flash -= dt;

      S.map.platforms.forEach((pl, i) => {
        const o = S.platOffsets[i];
        o.pdx = 0; o.pdy = 0;
        if (pl.move) {
          const v = Math.sin(S.t * pl.move.speed + pl.move.phase) * pl.move.range;
          if (pl.move.axis === "x") { o.pdx = v - o.dx; o.dx = v; }
          else { o.pdy = v - o.dy; o.dy = v; }
        }
      });

      if (S.mode === "countdown") {
        S.modeT += dt;
        const n = Math.ceil(3 - S.modeT);
        if (n !== S.lastBeep && n >= 0) { S.lastBeep = n; SFX.beep(n === 0); }
        if (S.modeT >= 3) { S.mode = "fight"; S.modeT = 0; }
      } else if (S.mode === "fight") {
        const d0 = S.players[0].hp <= 0 || S.players[0].dead;
        const d1 = S.players[1].hp <= 0 || S.players[1].dead;
        if (d0 || d1) {
          S.roundWinner = d0 ? 1 : 0;
          S.wins[S.roundWinner]++;
          S.players[S.roundWinner].victory = true;
          setScore([...S.wins]);
          SFX.win();
          S.mode = "roundEnd"; S.modeT = 0;
        }
      } else if (S.mode === "roundEnd") {
        S.modeT += dt;
        if (Math.random() < 0.3) {
          const p = S.players[S.roundWinner];
          spark(p.x, p.y - 90, p.neon, 3, 200, 160);
        }
        if (S.modeT >= 2.4) {
          if (S.wins[0] >= 3 || S.wins[1] >= 3) {
            if (!S.done) {
              S.done = true;
              SFX.fanfare();
              setMatchWinner(S.wins[0] >= 3 ? 1 : 2);
              setPhase("matchEnd");
            }
          } else {
            S.round++;
            resetRound();
          }
        }
      }

      S.players.forEach((p, i) =>
        updatePlayer(p, S.players[1 - i], dt, i === 0 ? KEYS.p1 : KEYS.p2)
      );
      resolveHits();

      S.particles = S.particles.filter((pt) => {
        pt.life -= dt;
        pt.vy += (pt.grav === undefined ? 1 : pt.grav) * 900 * dt;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        return pt.life > 0;
      });
      S.rings = S.rings.filter((r) => {
        r.life -= dt;
        r.r += (r.max - r.r) * 12 * dt;
        return r.life > 0;
      });
      S.texts = S.texts.filter((tx) => {
        tx.life -= dt; tx.y += tx.vy * dt; tx.vy *= 0.94;
        return tx.life > 0;
      });

      ctx.save();
      if (S.shake > 0) {
        S.shake -= dt;
        ctx.translate((Math.random() - 0.5) * S.shake * 30, (Math.random() - 0.5) * S.shake * 30);
      }
      drawMap();
      S.rings.forEach((r) => {
        ctx.save();
        ctx.shadowColor = r.color; ctx.shadowBlur = 16;
        ctx.strokeStyle = r.color; ctx.globalAlpha = r.life / r.t; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      });
      S.players.forEach(drawStickman);
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
      ctx.restore();
      drawHUD();

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

  if (phase === "menu" || phase === "matchEnd") {
    return (
      <div style={wrap}>
        <h1 style={{ letterSpacing: 5, margin: "26px 0 2px", fontSize: 34 }}>
          <span style={neonText("#3aa0ff")}>STICKMAN</span>{" "}
          <span style={{ opacity: 0.9 }}>⚔️</span>{" "}
          <span style={neonText("#ff3b4d")}>SWORD DUEL</span>
        </h1>
        <p style={{ opacity: 0.65, marginTop: 4 }}>neon edition · local 2-player · best of 5</p>

        {phase === "matchEnd" && (
          <div style={{
            margin: "8px 0 16px", padding: "14px 36px", borderRadius: 10,
            background: matchWinner === 1 ? "rgba(58,160,255,0.12)" : "rgba(255,59,77,0.12)",
            border: `2px solid ${matchWinner === 1 ? "#3aa0ff" : "#ff3b4d"}`,
            boxShadow: `0 0 24px ${matchWinner === 1 ? "rgba(58,160,255,0.35)" : "rgba(255,59,77,0.35)"}`,
            fontSize: 24, fontWeight: "bold",
          }}>
            🏆 PLAYER {matchWinner} WINS {score[0]}–{score[1]}
          </div>
        )}

        <p style={{ marginBottom: 8, opacity: 0.85 }}>Choose your arena:</p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          {MAPS.map((m, i) => (
            <button key={m.name} onClick={() => startMatch(i)}
              style={{
                cursor: "pointer", width: 220, padding: 0, borderRadius: 10, overflow: "hidden",
                border: "2px solid rgba(255,255,255,0.18)", background: "#10141d", color: "#e8eef5",
                fontFamily: "monospace", transition: "transform .15s, box-shadow .15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(120,180,255,0.25)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
              <MapIconPreview map={m} index={i} />
              <div style={{ padding: "9px 0 2px", fontWeight: "bold", letterSpacing: 1 }}>{m.name}</div>
              <div style={{ padding: "0 0 10px", fontSize: 10, opacity: 0.55 }}>{m.desc}</div>
            </button>
          ))}
        </div>

        <div style={{
          marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30,
          fontSize: 13, lineHeight: 1.85, background: "#10141d", padding: "16px 28px",
          borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div>
            <b style={neonText("#3aa0ff")}>PLAYER 1</b><br />
            A / D — move · W — jump<br />
            S — dash · F — attack · H — kick<br />
            G — block <span style={{ opacity: 0.6 }}>(perfect timing = parry)</span>
          </div>
          <div>
            <b style={neonText("#ff3b4d")}>PLAYER 2</b><br />
            ← / → — move · ↑ — jump<br />
            ↓ — dash · K — attack · J — kick<br />
            L — block <span style={{ opacity: 0.6 }}>(perfect timing = parry)</span>
          </div>
        </div>

        <div style={{
          marginTop: 12, fontSize: 12, background: "#10141d", padding: "12px 24px",
          borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", maxWidth: 660, lineHeight: 1.9,
        }}>
          <b style={{ letterSpacing: 1 }}>⚔️ MOVE LIST</b><br />
          <b>Combo chain</b> — tap attack up to 3×: slash → backslash → <span style={neonText("#8fe0ff")}>spin finisher</span> (hits both sides, launches)<br />
          <b>Charged heavy</b> — hold attack until the blade flashes white, release: 20 dmg, <span style={{ color: "#ffb347" }}>crushes guards</span><br />
          <b>Lunge thrust</b> — attack during a dash: long-reach piercing stab<br />
          <b>Plunge</b> — attack in mid-air: slam down with an AOE shockwave<br />
          <b>Kick</b> — breaks a raised guard · <b>Parry</b> — beats every attack, even heavies
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
        <span style={{ opacity: 0.7, fontSize: 13 }}>{MAPS[mapIdx].name} · first to 3</span>
        <button onClick={() => setMuted((m) => !m)}
          style={{ cursor: "pointer", background: "none", border: "1px solid rgba(255,255,255,0.3)", color: "#e8eef5", borderRadius: 6, padding: "4px 10px", fontFamily: "monospace", fontSize: 12 }}>
          {muted ? "🔇" : "🔊"}
        </button>
        <button onClick={() => setPhase("menu")}
          style={{ cursor: "pointer", background: "none", border: "1px solid rgba(255,255,255,0.3)", color: "#e8eef5", borderRadius: 6, padding: "4px 12px", fontFamily: "monospace", fontSize: 12 }}>
          quit to menu
        </button>
      </div>
      <canvas ref={canvasRef} width={W} height={H}
        style={{ maxWidth: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "#000", boxShadow: "0 0 40px rgba(80,140,255,0.12)" }} />
      <p style={{ opacity: 0.5, fontSize: 12, marginTop: 8 }}>
        tap attack ×3 = combo · hold attack = heavy · dash + attack = lunge · air + attack = plunge
      </p>
    </div>
  );
}
