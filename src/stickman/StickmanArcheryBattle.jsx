import React, { useRef, useEffect, useState } from "react";

// ========== STICKMAN ARCHERY BATTLE 🏹 — NEON EDITION v2 ==========
// Turn-based shooting, LIVE movement: both archers can run & jump on their
// own hill at any time — dodge incoming arrows! Shooter aims & fires on
// their turn, with a 20s shot clock.
//
//   P1: A/D move · W jump · R/F aim up/down · SPACE hold-draw, release-fire
//   P2: ←/→ move · ↑ jump · K/J aim up/down · ENTER hold-draw, release-fire
//
// 3 maps: Moonlit Meadow (open) · Fortress Walls (arc over cover) ·
// Storm Peaks (rain, lightning, brutal wind, a MOVING barrier)
// Balloons grant: ⁂ triple · 💥 explosive · ❄ ice (freezes = no dodge + skip)

const W = 900, H = 500;
const GROUND_Y = H - 46;
const HILL = { w: 200, h: 104 };
const ARROW_G = 620;
const MAX_HP = 100;
const DMG = { body: 20, head: 34, iceBody: 12, explSplash: 24, explRadius: 90 };
const POWER_TIME = 1.15;
const SPEED_MIN = 320, SPEED_MAX = 1000;
const ANGLE_MIN = 8 * Math.PI / 180, ANGLE_MAX = 84 * Math.PI / 180;
const ROUNDS_TO_WIN = 2;
const SHOT_CLOCK = 20;
const P_MOVE = 170, P_JUMP = 590, P_GRAV = 1750;

const PUPS = {
  triple: { icon: "⁂", name: "TRIPLE ARROWS", color: "#8fe0ff" },
  explosive: { icon: "💥", name: "EXPLOSIVE ARROW", color: "#ffb347" },
  ice: { icon: "❄", name: "ICE ARROW", color: "#a9e6ff" },
};

const MAPS = [
  {
    name: "Moonlit Meadow", desc: "open field · fireflies · fair winds",
    windMult: 1, theme: "meadow",
    barriers: [],
    balloonZone: [300, 600],
  },
  {
    name: "Fortress Walls", desc: "stone cover · arc your shots",
    windMult: 1.1, theme: "fortress",
    barriers: [
      { x: 380, y: GROUND_Y - 150, w: 26, h: 150 },                 // left wall (ground)
      { x: 494, y: GROUND_Y - 150, w: 26, h: 150 },                 // right wall (ground)
      { x: 404, y: GROUND_Y - 260, w: 92, h: 20 },                  // floating slab = window between
    ],
    balloonZone: [340, 560],
  },
  {
    name: "Storm Peaks", desc: "rain · lightning · savage wind · moving gate",
    windMult: 1.45, theme: "storm",
    barriers: [
      { x: 300, y: GROUND_Y - 120, w: 22, h: 120 },
      { x: 578, y: GROUND_Y - 120, w: 22, h: 120 },
      { x: 428, y: 150, w: 44, h: 120, move: { axis: "y", range: 85, speed: 1.0, phase: 0 } }, // moving gate
    ],
    balloonZone: [330, 570],
  },
];

const KEYS = {
  p1: { left: "KeyA", right: "KeyD", jump: "KeyW", aimUp: "KeyR", aimDown: "KeyF", fire: "Space" },
  p2: { left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp", aimUp: "KeyK", aimDown: "KeyJ", fire: "Enter" },
};
const ALL_KEYS = [...Object.values(KEYS.p1), ...Object.values(KEYS.p2), "ArrowDown"];

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
    creak: (k) => tone(180 + k * 260, 0.06, "sawtooth", 0.05),
    shoot: () => { tone(220, 0.12, "square", 0.16, -120); noise(0.14, 2400, 0.22, 2); },
    thud: () => { noise(0.12, 500, 0.35, 1); tone(110, 0.14, "square", 0.2, -50); },
    headshot: () => { noise(0.12, 600, 0.35, 1); tone(1200, 0.22, "triangle", 0.2, 400); },
    stick: () => noise(0.06, 900, 0.18, 1.5),
    clank: () => { tone(800, 0.08, "square", 0.14, -300); noise(0.05, 3000, 0.15, 3); },
    pop: () => { tone(600, 0.1, "square", 0.2, 500); noise(0.08, 2000, 0.2, 2); },
    boom: () => { noise(0.4, 240, 0.5, 0.6); tone(70, 0.4, "sine", 0.35, -30); },
    freeze: () => { tone(1600, 0.3, "sine", 0.18, -900); tone(2200, 0.25, "sine", 0.12, -1200); },
    shatter: () => noise(0.2, 3000, 0.25, 3),
    jump: () => tone(300, 0.1, "sine", 0.1, 200),
    turn: () => tone(520, 0.1, "square", 0.12),
    tick: () => tone(700, 0.05, "square", 0.1),
    windy: () => noise(0.35, 700, 0.08, 0.5),
    thunder: () => { noise(0.7, 150, 0.4, 0.4); tone(55, 0.7, "sine", 0.3, -20); },
    ko: () => { tone(420, 0.55, "sawtooth", 0.26, -340); noise(0.4, 500, 0.3, 0.7); },
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.26, "triangle", 0.2, 0, i * 0.13)),
    fanfare: () => [392, 523, 659, 784, 1046, 1319].forEach((f, i) => tone(f, 0.3, "triangle", 0.2, 0, i * 0.15)),
  };
}
const SFX = makeSFX();

// Each archer is confined to their own hill top
const hillRange = (id) => {
  if (id === 0) return [40 + 26, 40 + HILL.w - 26];
  return [W - 40 - HILL.w + 26, W - 40 - 26];
};
const HILL_TOP = GROUND_Y - HILL.h;

const groundYAt = (x) => {
  if (x <= 40 + HILL.w) return HILL_TOP;
  if (x >= W - 40 - HILL.w) return HILL_TOP;
  return GROUND_Y;
};

function makeArcher(id) {
  const [lo, hi] = hillRange(id);
  return {
    id, x: (lo + hi) / 2, y: HILL_TOP, vx: 0, vy: 0, onGround: true,
    facing: id === 0 ? 1 : -1,
    neon: id === 0 ? "#3aa0ff" : "#ff3b4d",
    glow: id === 0 ? "#7cc8ff" : "#ff8090",
    hp: MAX_HP,
    angle: 45 * Math.PI / 180,
    powerup: null, frozenTurns: 0,
    hurtFlash: 0, runPhase: 0, breathe: Math.random() * 6,
  };
}

function MiniMenuArcher({ side, neon }) {
  return (
    <div className={`map-mini-archer ${side}`} style={{ "--neon": neon }} aria-hidden="true">
      <div className="hop">
        <svg viewBox="0 0 18 28" width="18" height="28">
          {/* stance legs */}
          <line x1="9" y1="16" x2="5" y2="26" stroke="#f4f7fb" strokeWidth="2" strokeLinecap="round" />
          <line x1="9" y1="16" x2="13" y2="26" stroke="#f4f7fb" strokeWidth="2" strokeLinecap="round" />
          {/* torso */}
          <line x1="9" y1="16" x2="9" y2="8" stroke="#f4f7fb" strokeWidth="2" strokeLinecap="round" />
          {/* head */}
          <circle cx="9" cy="5" r="3.4" fill="none" stroke="#f4f7fb" strokeWidth="1.8" />
          <path d="M6.6 4.4 Q9 2.2 11.4 4.4" fill="none" stroke={neon} strokeWidth="1.5" strokeLinecap="round" />
          {/* rear arm */}
          <line x1="9" y1="10" x2="5.5" y2="13" stroke="#f4f7fb" strokeWidth="1.8" strokeLinecap="round" />
          {/* bow arm */}
          <line x1="9" y1="10" x2="13.5" y2="11" stroke="#f4f7fb" strokeWidth="1.8" strokeLinecap="round" />
          {/* neon bow */}
          <path d="M13.5 5.5 Q16.8 11 13.5 16.5" fill="none" stroke={neon} strokeWidth="2" strokeLinecap="round" />
          <line x1="13.5" y1="5.5" x2="11.2" y2="11" stroke="rgba(255,255,255,0.8)" strokeWidth="0.9" />
          <line x1="13.5" y1="16.5" x2="11.2" y2="11" stroke="rgba(255,255,255,0.8)" strokeWidth="0.9" />
          {/* arrow */}
          <line x1="11.2" y1="11" x2="16.2" y2="10.4" stroke={neon} strokeWidth="1.3" strokeLinecap="round" />
          <path d="M16.2 10.4 L14.8 9.4 L14.8 11.4 Z" fill={neon} />
        </svg>
      </div>
    </div>
  );
}

function MapCardPreview({ map, colors, index }) {
  const theme = map.theme;
  return (
    <div className="map-preview" style={{ background: `linear-gradient(${colors.top}, ${colors.bot})` }}>
      <div className="sky">
        {theme === "meadow" && (
          <>
            <div className="moon" />
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="star" style={{
                left: `${12 + n * 13}%`, top: `${10 + (n % 3) * 12}px`,
                animationDelay: `${n * 0.35}s`,
              }} />
            ))}
            <div className="cloud" style={{ top: 22, width: 36, animationDuration: "14s" }} />
            <div className="cloud" style={{ top: 36, width: 28, animationDuration: "19s", animationDelay: "-7s", opacity: 0.5 }} />
            {[0, 1, 2, 3].map((n) => (
              <div key={`f${n}`} className="firefly" style={{
                left: `${30 + n * 12}%`, bottom: `${18 + (n % 2) * 10}px`,
                animationDelay: `${n * 0.55}s`,
              }} />
            ))}
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <div key={`g${n}`} className="grass-blade" style={{
                left: `${70 + n * 8}px`, height: `${5 + (n % 3)}px`,
                animationDelay: `${n * 0.2}s`, background: colors.acc,
              }} />
            ))}
          </>
        )}
        {theme === "fortress" && (
          <>
            <div className="sun" />
            {[0, 1, 2, 3, 4].map((n) => (
              <div key={n} className="dust" style={{
                left: `${18 + n * 16}%`, bottom: 12,
                animationDuration: `${3.5 + n * 0.4}s`, animationDelay: `${n * 0.6}s`,
              }} />
            ))}
            {[0, 1, 2].map((n) => (
              <div key={`w${n}`} className="win-light" style={{
                left: `${22 + n * 10}px`, top: `${28 + (n % 2) * 8}px`,
                animationDelay: `${n * 0.45}s`,
              }} />
            ))}
            {[0, 1, 2].map((n) => (
              <div key={`wr${n}`} className="win-light" style={{
                right: `${22 + n * 10}px`, top: `${30 + (n % 2) * 7}px`,
                animationDelay: `${0.3 + n * 0.5}s`,
              }} />
            ))}
          </>
        )}
        {theme === "storm" && (
          <>
            <div className="lightning-flash" />
            <div className="storm-cloud" style={{ top: 10, width: 48, animationDuration: "11s" }} />
            <div className="storm-cloud" style={{ top: 22, width: 40, animationDuration: "15s", animationDelay: "-5s" }} />
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <div key={n} className="raindrop" style={{
                left: `${8 + n * 12}%`,
                animationDuration: `${0.55 + (n % 3) * 0.12}s`,
                animationDelay: `${n * 0.11}s`,
              }} />
            ))}
          </>
        )}
      </div>

      <div className="hill left" style={{ borderTop: `3px solid ${colors.acc}` }} />
      <div className="hill right" style={{ borderTop: `3px solid ${colors.acc}` }} />

      {map.barriers.map((b, bi) => (
        <div
          key={bi}
          className={`barrier${b.move ? " moving" : ""}`}
          style={{
            left: `${(b.x / W) * 100}%`,
            width: `${Math.max(3, (b.w / W) * 100)}%`,
            bottom: `${((H - (b.y + b.h)) / H) * 76 + 8}%`,
            height: `${(b.h / H) * 76}%`,
            border: `1px solid ${colors.acc}`,
            boxShadow: b.move ? `0 0 8px ${colors.acc}` : "none",
          }}
        />
      ))}

      <MiniMenuArcher side="left" neon="#3aa0ff" />
      <MiniMenuArcher side="right" neon="#ff3b4d" />
      {index === 2 && <div style={{ position: "absolute", top: 6, left: 10, fontSize: 11, zIndex: 4 }}>⛈️</div>}
    </div>
  );
}

export default function StickmanArcheryBattle() {
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
      barOffsets: map.barriers.map(() => ({ dy: 0 })),
      players: [], arrows: [], balloons: [], stuck: [],
      particles: [], texts: [], rings: [], rain: [],
      keys: {}, pressed: {},
      t: 0, turn: 0, mode: "aim", modeT: 0,
      charging: false, chargeT: 0, power: 0, lastCreak: -1,
      shotClock: SHOT_CLOCK, lastTick: -1,
      wind: 0,
      round: 1, wins: [0, 0], roundWinner: 0,
      banner: "", bannerT: 0, bannerCol: "#ffe97a",
      shake: 0, flash: 0, lightning: 0, nextBolt: 3 + Math.random() * 5, bolt: null, done: false,
      stars: Array.from({ length: 80 }, () => ({ x: Math.random() * W, y: Math.random() * (H * 0.6), r: Math.random() * 1.6 + 0.4, ph: Math.random() * 6 })),
      fireflies: Array.from({ length: 12 }, () => ({ x: 260 + Math.random() * 380, y: GROUND_Y - 20 - Math.random() * 80, ph: Math.random() * 6, sp: 0.4 + Math.random() * 0.6 })),
      grass: Array.from({ length: 40 }, (_, i) => ({ x: 250 + i * 10.2, h: 6 + Math.random() * 8, ph: Math.random() * 6 })),
    };

    const barrierRects = () =>
      map.barriers.map((b, i) => ({ x: b.x, y: b.y + S.barOffsets[i].dy, w: b.w, h: b.h, move: !!b.move }));

    const newWind = () => {
      S.wind = (Math.random() * 2 - 1) * 200 * map.windMult;
      if (Math.abs(S.wind) > 130) SFX.windy();
    };
    const maybeSpawnBalloon = () => {
      if (S.balloons.length >= 2 || Math.random() < 0.35) return;
      const [zlo, zhi] = map.balloonZone;
      const types = Object.keys(PUPS);
      let bx, by, tries = 0;
      do {
        bx = zlo + Math.random() * (zhi - zlo);
        by = 100 + Math.random() * 150;
        tries++;
      } while (tries < 12 && barrierRects().some((r) => bx > r.x - 30 && bx < r.x + r.w + 30 && by > r.y - 120 && by < r.y + r.h + 30));
      S.balloons.push({ x: bx, y: by, baseY: by, ph: Math.random() * 6, type: types[Math.floor(Math.random() * types.length)] });
    };

    const setBanner = (str, col = "#ffe97a", t = 1) => { S.banner = str; S.bannerCol = col; S.bannerT = t; };

    const resetRound = () => {
      S.players = [makeArcher(0), makeArcher(1)];
      S.arrows = []; S.stuck = []; S.balloons = [];
      S.turn = S.round % 2 === 1 ? 0 : 1;
      S.mode = "aim"; S.modeT = 0;
      S.charging = false; S.power = 0;
      S.shotClock = SHOT_CLOCK; S.lastTick = -1;
      newWind();
      maybeSpawnBalloon(); maybeSpawnBalloon();
      setBanner(`ROUND ${S.round} — P${S.turn + 1} SHOOTS FIRST`, "#ffffff", 1.4);
    };
    resetRound();

    const down = (e) => {
      if (ALL_KEYS.includes(e.code)) e.preventDefault();
      if (!S.keys[e.code]) S.pressed[e.code] = true;
      S.keys[e.code] = true;
    };
    const up = (e) => {
      S.keys[e.code] = false;
      // release fire
      [0, 1].forEach((id) => {
        const k = id === 0 ? KEYS.p1 : KEYS.p2;
        if (e.code === k.fire && S.charging && S.mode === "aim" && S.turn === id) fire();
      });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    // ---------- fx ----------
    const spark = (x, y, color, n = 10, spd = 260, up2 = 60) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = spd * (0.4 + Math.random() * 0.8);
        S.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up2, life: 0.5, max: 0.5, color, r: 2 + Math.random() * 3, glow: true });
      }
    };
    const dmgText = (x, y, str, color, size = 18) => S.texts.push({ x, y, vy: -80, life: 0.9, max: 0.9, str, color, size });
    const ring = (x, y, color, max = 90) => S.rings.push({ x, y, r: 10, max, life: 0.4, t: 0.4, color });

    // ---------- shooting ----------
    const bowTip = (p) => ({ bx: p.x + p.facing * 16, by: p.y - 56 });

    const fire = () => {
      const p = S.players[S.turn];
      const speed = SPEED_MIN + (SPEED_MAX - SPEED_MIN) * S.power;
      const a = p.angle;
      const { bx, by } = bowTip(p);
      const dirX = Math.cos(a) * p.facing, dirY = -Math.sin(a);
      const mk = (spread = 0) => {
        const ca = Math.cos(spread), sa = Math.sin(spread);
        const dx = dirX * ca - dirY * sa, dy = dirX * sa + dirY * ca;
        S.arrows.push({
          x: bx + dx * 20, y: by + dy * 20,
          vx: dx * speed, vy: dy * speed,
          owner: p.id, trail: [],
          explosive: p.powerup === "explosive",
          ice: p.powerup === "ice",
          dead: false,
        });
      };
      if (p.powerup === "triple") { mk(-0.1); mk(0); mk(0.1); }
      else mk(0);
      p.powerup = null;
      S.charging = false; S.power = 0;
      S.mode = "flying"; S.modeT = 0;
      SFX.shoot();
    };

    const endTurn = () => {
      S.arrows = [];
      newWind();
      maybeSpawnBalloon();
      let next = 1 - S.turn;
      const foe = S.players[next];
      if (foe.frozenTurns > 0) {
        foe.frozenTurns--;
        setBanner(`P${next + 1} IS FROZEN — TURN SKIPPED!`, "#a9e6ff", 1.3);
        SFX.shatter();
        next = S.turn;
      } else {
        SFX.turn();
      }
      S.turn = next;
      S.mode = "aim"; S.modeT = 0;
      S.shotClock = SHOT_CLOCK; S.lastTick = -1;
      S.charging = false; S.power = 0;
    };

    const damage = (target, amt, label, color, atY) => {
      target.hp = Math.max(0, target.hp - amt);
      target.hurtFlash = 0.25;
      dmgText(target.x, atY || target.y - 95, label, color, amt >= 30 ? 22 : 18);
      if (target.hp <= 0 && S.mode !== "roundEnd") {
        S.roundWinner = 1 - target.id;
        S.wins[S.roundWinner]++;
        setScore([...S.wins]);
        SFX.ko();
        setTimeout(() => SFX.win(), 300);
        S.mode = "roundEnd"; S.modeT = 0;
      }
    };

    const explode = (x, y, owner) => {
      SFX.boom();
      S.shake = 0.4; S.flash = 0.1;
      ring(x, y, "#ffb347", DMG.explRadius + 20);
      spark(x, y, "#ffb347", 22, 420, 100);
      spark(x, y, "#ff5c1a", 14, 320, 60);
      S.players.forEach((pl) => {
        const d = Math.hypot(pl.x - x, (pl.y - 45) - y);
        if (d < DMG.explRadius) {
          const amt = Math.round(DMG.explSplash * (1 - d / DMG.explRadius)) + (pl.id !== owner ? 4 : 0);
          if (amt > 0) damage(pl, amt, `-${amt} 💥`, "#ffb347");
        }
      });
    };

    // ---------- update ----------
    const update = (dt) => {
      // moving barriers
      map.barriers.forEach((b, i) => {
        if (b.move) S.barOffsets[i].dy = Math.sin(S.t * b.move.speed + b.move.phase) * b.move.range;
      });

      const shooter = S.players[S.turn];

      // ---- LIVE MOVEMENT & JUMPING for BOTH archers (dodge!) ----
      S.players.forEach((p) => {
        if (S.mode === "roundEnd") return;
        const k = p.id === 0 ? KEYS.p1 : KEYS.p2;
        const frozen = p.frozenTurns > 0;
        let ax = 0;
        if (!frozen) {
          if (S.keys[k.left]) ax -= 1;
          if (S.keys[k.right]) ax += 1;
        }
        p.vx = ax * P_MOVE;
        if (!frozen && S.pressed[k.jump] && p.onGround) {
          p.vy = -P_JUMP; p.onGround = false;
          SFX.jump();
          for (let i = 0; i < 4; i++) S.particles.push({ x: p.x + (Math.random() - 0.5) * 16, y: p.y, vx: (Math.random() - 0.5) * 80, vy: -30, life: 0.3, max: 0.3, color: "rgba(200,220,200,0.5)", r: 2.5, grav: 0.3 });
        }
        p.vy += P_GRAV * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // confined to own hill
        const [lo, hi] = hillRange(p.id);
        p.x = Math.max(lo, Math.min(hi, p.x));
        if (p.y >= HILL_TOP) { p.y = HILL_TOP; p.vy = 0; p.onGround = true; }
        // facing always toward the enemy
        p.facing = p.id === 0 ? 1 : -1;
        if (p.onGround && Math.abs(p.vx) > 20) p.runPhase += dt * 12;
        else p.runPhase *= 0.9;
        if (p.hurtFlash > 0) p.hurtFlash -= dt;
      });

      // ---- AIM / CHARGE (shooter only) ----
      if (S.mode === "aim" && S.bannerT <= 0.4) {
        const k = S.turn === 0 ? KEYS.p1 : KEYS.p2;
        if (S.keys[k.aimUp]) shooter.angle = Math.min(ANGLE_MAX, shooter.angle + 1.2 * dt);
        if (S.keys[k.aimDown]) shooter.angle = Math.max(ANGLE_MIN, shooter.angle - 1.2 * dt);

        if (S.keys[k.fire]) {
          if (!S.charging) { S.charging = true; S.chargeT = 0; }
          S.chargeT += dt;
          const kk = (S.chargeT / POWER_TIME) % 2;
          S.power = kk <= 1 ? kk : 2 - kk;
          const creakStep = Math.floor(S.power * 6);
          if (creakStep !== S.lastCreak) { S.lastCreak = creakStep; SFX.creak(S.power); }
        }

        // shot clock
        S.shotClock -= dt;
        const secs = Math.ceil(S.shotClock);
        if (secs <= 5 && secs !== S.lastTick && secs > 0) { S.lastTick = secs; SFX.tick(); }
        if (S.shotClock <= 0) {
          setBanner("TIME UP!", "#ff8f6a", 1);
          S.charging = false; S.power = 0;
          endTurn();
        }
      }

      // ---- ARROWS ----
      if (S.mode === "flying") {
        S.modeT += dt;
        const bars = barrierRects();
        S.arrows.forEach((ar) => {
          if (ar.dead) return;
          ar.vx += S.wind * dt;
          ar.vy += ARROW_G * dt;
          ar.x += ar.vx * dt;
          ar.y += ar.vy * dt;
          ar.trail.push({ x: ar.x, y: ar.y, life: 0.35, max: 0.35 });
          if (ar.trail.length > 40) ar.trail.shift();

          // balloons
          S.balloons = S.balloons.filter((b) => {
            if (Math.hypot(ar.x - b.x, ar.y - b.y) < 20) {
              const sh = S.players[ar.owner];
              sh.powerup = b.type;
              SFX.pop();
              spark(b.x, b.y, PUPS[b.type].color, 14, 260);
              dmgText(b.x, b.y - 20, `${PUPS[b.type].icon} ${PUPS[b.type].name}`, PUPS[b.type].color, 14);
              return false;
            }
            return true;
          });

          // barriers
          for (const r of bars) {
            if (ar.dead) break;
            if (ar.x > r.x && ar.x < r.x + r.w && ar.y > r.y && ar.y < r.y + r.h) {
              ar.dead = true;
              if (ar.explosive) explode(ar.x, ar.y, ar.owner);
              else if (r.move) {
                SFX.clank();
                spark(ar.x, ar.y, "#cfd8e3", 8, 220);
              } else {
                SFX.stick();
                S.stuck.push({ x: ar.x, y: ar.y, angle: Math.atan2(ar.vy, ar.vx), owner: ar.owner, life: 6 });
              }
            }
          }
          if (ar.dead) return;

          // players
          for (const pl of S.players) {
            if (pl.id === ar.owner || ar.dead) continue;
            const headX = pl.x, headY = pl.y - 78;
            if (Math.hypot(ar.x - headX, ar.y - headY) < 13) {
              ar.dead = true;
              if (ar.explosive) explode(ar.x, ar.y, ar.owner);
              else if (ar.ice) {
                pl.frozenTurns = 1;
                SFX.freeze();
                spark(pl.x, pl.y - 60, "#a9e6ff", 16, 280);
                damage(pl, DMG.iceBody, `-${DMG.iceBody} ❄ FROZEN`, "#a9e6ff", headY - 16);
                setBanner(`P${pl.id + 1} FROZEN!`, "#a9e6ff", 1);
              } else {
                SFX.headshot();
                S.shake = 0.25;
                spark(ar.x, ar.y, "#ffe97a", 14, 320);
                damage(pl, DMG.head, `-${DMG.head} HEADSHOT!`, "#ffe97a", headY - 16);
              }
              continue;
            }
            if (Math.abs(ar.x - pl.x) < 15 && ar.y > pl.y - 70 && ar.y < pl.y) {
              ar.dead = true;
              if (ar.explosive) explode(ar.x, ar.y, ar.owner);
              else if (ar.ice) {
                pl.frozenTurns = 1;
                SFX.freeze();
                spark(pl.x, pl.y - 45, "#a9e6ff", 16, 280);
                damage(pl, DMG.iceBody, `-${DMG.iceBody} ❄ FROZEN`, "#a9e6ff");
                setBanner(`P${pl.id + 1} FROZEN!`, "#a9e6ff", 1);
              } else {
                SFX.thud();
                S.shake = 0.15;
                spark(ar.x, ar.y, S.players[ar.owner].glow, 10, 260);
                damage(pl, DMG.body, `-${DMG.body}`, S.players[ar.owner].glow);
              }
            }
          }

          // terrain
          if (!ar.dead && ar.y >= groundYAt(ar.x) - 2) {
            ar.dead = true;
            if (ar.explosive) explode(ar.x, groundYAt(ar.x), ar.owner);
            else {
              SFX.stick();
              S.stuck.push({ x: ar.x, y: groundYAt(ar.x), angle: Math.atan2(ar.vy, ar.vx), owner: ar.owner, life: 6 });
            }
          }
          if (!ar.dead && (ar.x < -60 || ar.x > W + 60 || ar.y > H + 40)) ar.dead = true;
        });

        S.arrows.forEach((ar) => ar.trail.forEach((t) => (t.life -= dt)));
        const allDone = S.arrows.every((a) => a.dead && a.trail.every((t) => t.life <= 0));
        if ((allDone || S.modeT > 6) && S.mode === "flying") {
          S.mode = "between"; S.modeT = 0;
        }
      }

      if (S.mode === "between") {
        S.modeT += dt;
        if (S.modeT > 0.5) endTurn();
      }

      if (S.mode === "roundEnd") {
        S.modeT += dt;
        if (Math.random() < 0.3) {
          const wp = S.players[S.roundWinner];
          spark(wp.x, wp.y - 90, wp.neon, 3, 200, 160);
        }
        if (S.modeT >= 2.6) {
          if (S.wins[0] >= ROUNDS_TO_WIN || S.wins[1] >= ROUNDS_TO_WIN) {
            if (!S.done) {
              S.done = true;
              SFX.fanfare();
              setMatchWinner(S.wins[0] >= ROUNDS_TO_WIN ? 1 : 2);
              setPhase("matchEnd");
            }
          } else {
            S.round++;
            resetRound();
          }
        }
      }

      // balloons
      S.balloons.forEach((b) => {
        b.ph += dt;
        b.y = b.baseY + Math.sin(b.ph * 1.4) * 10;
        b.x += (S.wind / 200) * 8 * dt;
        const [zlo, zhi] = map.balloonZone;
        b.x = Math.max(zlo, Math.min(zhi, b.x));
      });

      // storm lightning
      if (map.theme === "storm") {
        S.nextBolt -= dt;
        if (S.nextBolt <= 0) {
          S.nextBolt = 4 + Math.random() * 6;
          S.lightning = 0.18;
          SFX.thunder();
          const bx = 100 + Math.random() * (W - 200);
          const pts = [{ x: bx, y: 0 }];
          let cy = 0, cx = bx;
          while (cy < 200 + Math.random() * 100) {
            cy += 24 + Math.random() * 22;
            cx += (Math.random() - 0.5) * 44;
            pts.push({ x: cx, y: cy });
          }
          S.bolt = { pts, life: 0.18 };
        }
        if (S.lightning > 0) S.lightning -= dt;
        if (S.bolt) { S.bolt.life -= dt; if (S.bolt.life <= 0) S.bolt = null; }
        // rain
        for (let i = 0; i < 4; i++) {
          S.rain.push({ x: Math.random() * (W + 200) - 100, y: -10, vx: S.wind * 0.5, vy: 620 + Math.random() * 140 });
        }
        S.rain = S.rain.filter((r) => {
          r.x += r.vx * dt; r.y += r.vy * dt;
          return r.y < groundYAt(r.x) + 6;
        });
      }

      S.stuck = S.stuck.filter((st) => { st.life -= dt; return st.life > 0; });
      S.particles = S.particles.filter((pt) => {
        pt.life -= dt;
        pt.vy += (pt.grav === undefined ? 1 : pt.grav) * 900 * dt;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        return pt.life > 0;
      });
      S.rings = S.rings.filter((r) => { r.life -= dt; r.r += (r.max - r.r) * 10 * dt; return r.life > 0; });
      S.texts = S.texts.filter((tx) => { tx.life -= dt; tx.y += tx.vy * dt; tx.vy *= 0.94; return tx.life > 0; });
    };

    // ---------- backgrounds ----------
    const drawSkyBase = (top, bottom) => {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, top); g.addColorStop(1, bottom);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    };

    const drawTerrain = (groundCol, topCol, hillCol) => {
      ctx.fillStyle = groundCol;
      ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
      ctx.save();
      ctx.shadowColor = topCol; ctx.shadowBlur = 6;
      ctx.fillStyle = topCol;
      ctx.fillRect(0, GROUND_Y, W, 4);
      ctx.restore();
      [[40], [W - 40 - HILL.w]].forEach(([hx]) => {
        ctx.fillStyle = hillCol;
        ctx.beginPath();
        ctx.moveTo(hx, GROUND_Y);
        ctx.lineTo(hx + 20, HILL_TOP);
        ctx.lineTo(hx + HILL.w - 20, HILL_TOP);
        ctx.lineTo(hx + HILL.w, GROUND_Y);
        ctx.fill();
        ctx.save();
        ctx.shadowColor = topCol; ctx.shadowBlur = 6;
        ctx.fillStyle = topCol;
        ctx.fillRect(hx + 20, HILL_TOP, HILL.w - 40, 4);
        ctx.restore();
        // boundary posts marking the confined zone
        [[hx + 20], [hx + HILL.w - 20]].forEach(([bx2]) => {
          ctx.save();
          ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 6;
          ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(bx2, HILL_TOP); ctx.lineTo(bx2, HILL_TOP - 12); ctx.stroke();
          ctx.restore();
        });
      });
    };

    const drawMeadow = () => {
      drawSkyBase("#070b1c", "#1b2f57");
      ctx.save();
      ctx.shadowColor = "#e8f0ff"; ctx.shadowBlur = 40;
      ctx.fillStyle = "#eef4ff";
      ctx.beginPath(); ctx.arc(W / 2, 78, 30, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      S.stars.forEach((st) => {
        const a = 0.3 + 0.6 * Math.abs(Math.sin(S.t * 1.3 + st.ph));
        ctx.fillStyle = `rgba(220,235,255,${a})`;
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
      });
      for (let i = 0; i < 4; i++) {
        const speed = 10 + i * 5 + (S.wind / 200) * 26;
        const cx = ((i * 260 + S.t * speed) % (W + 260) + W + 260) % (W + 260) - 130;
        const cy = 120 + i * 40;
        ctx.fillStyle = "rgba(150,180,225,0.13)";
        ctx.beginPath();
        ctx.ellipse(cx, cy, 85, 16, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 46, cy + 6, 55, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#0d1730";
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(160, 250); ctx.lineTo(330, GROUND_Y);
      ctx.lineTo(480, 280); ctx.lineTo(640, GROUND_Y);
      ctx.lineTo(760, 265); ctx.lineTo(W, GROUND_Y);
      ctx.fill();
      drawTerrain("#22392b", "#5dd48a", "#2a4a35");
      const sway = (S.wind / 200) * 6;
      ctx.strokeStyle = "#3f7a52"; ctx.lineWidth = 2;
      S.grass.forEach((gr) => {
        const bend = sway + Math.sin(S.t * 2 + gr.ph) * 2;
        ctx.beginPath();
        ctx.moveTo(gr.x, GROUND_Y);
        ctx.quadraticCurveTo(gr.x + bend * 0.5, GROUND_Y - gr.h * 0.6, gr.x + bend, GROUND_Y - gr.h);
        ctx.stroke();
      });
      S.fireflies.forEach((f) => {
        f.x += Math.sin(S.t * f.sp + f.ph) * 0.4;
        f.y += Math.cos(S.t * f.sp * 0.7 + f.ph) * 0.3;
        const a = 0.3 + 0.7 * Math.abs(Math.sin(S.t * 2 + f.ph));
        ctx.save();
        ctx.shadowColor = "#d8ff7a"; ctx.shadowBlur = 8;
        ctx.fillStyle = `rgba(216,255,122,${a})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
    };

    const drawFortress = () => {
      drawSkyBase("#160f08", "#463016");
      // low sun / torch glow sky
      ctx.save();
      ctx.shadowColor = "#ffb85c"; ctx.shadowBlur = 50;
      ctx.fillStyle = "#ffd9a0";
      ctx.beginPath(); ctx.arc(W / 2, 95, 26, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // distant castle silhouettes with flickering windows
      ctx.fillStyle = "#241708";
      [[80, 190], [W - 210, 175]].forEach(([cx, cy]) => {
        ctx.fillRect(cx, cy, 130, GROUND_Y - cy);
        for (let bt = 0; bt < 5; bt++) ctx.fillRect(cx + bt * 28, cy - 14, 16, 14);
      });
      for (let i = 0; i < 6; i++) {
        const wx = (i < 3 ? 100 : W - 190) + (i % 3) * 34;
        const flick = Math.sin(S.t * 5 + i * 2.3) > -0.4;
        if (flick) {
          ctx.save();
          ctx.shadowColor = "#ffb85c"; ctx.shadowBlur = 8;
          ctx.fillStyle = "rgba(255,190,110,0.85)";
          ctx.fillRect(wx, 230 + (i % 2) * 40, 6, 9);
          ctx.restore();
        }
      }
      // floating dust motes
      for (let i = 0; i < 6; i++) {
        const dx = ((i * 170 + S.t * 16) % (W + 60)) - 30;
        const dy = 140 + ((i * 97) % 200) + Math.sin(S.t + i) * 8;
        ctx.fillStyle = "rgba(255,220,170,0.14)";
        ctx.beginPath(); ctx.arc(dx, dy, 2, 0, Math.PI * 2); ctx.fill();
      }
      drawTerrain("#3a2c17", "#ffb85c", "#4a3a1e");
    };

    const drawStorm = () => {
      drawSkyBase("#05070f", "#101b33");
      // storm clouds rolling
      for (let i = 0; i < 5; i++) {
        const speed = 26 + i * 8 + (S.wind / 200) * 40;
        const cx = ((i * 220 + S.t * speed) % (W + 300) + W + 300) % (W + 300) - 150;
        const cy = 55 + i * 26;
        ctx.fillStyle = `rgba(60,75,110,${0.28 - i * 0.03})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 110, 22, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 70, cy + 10, 80, 18, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // lightning flash tint
      if (S.lightning > 0) {
        ctx.fillStyle = `rgba(200,220,255,${S.lightning * 1.4})`;
        ctx.fillRect(0, 0, W, H);
      }
      // bolt
      if (S.bolt) {
        ctx.save();
        ctx.shadowColor = "#cfe4ff"; ctx.shadowBlur = 18;
        ctx.strokeStyle = "#eaf3ff"; ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.globalAlpha = Math.max(0, S.bolt.life / 0.18);
        ctx.beginPath();
        S.bolt.pts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.stroke();
        ctx.restore();
      }
      // jagged dark peaks
      ctx.fillStyle = "#0a1122";
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(130, 220); ctx.lineTo(240, GROUND_Y);
      ctx.lineTo(420, 190); ctx.lineTo(560, GROUND_Y);
      ctx.lineTo(720, 235); ctx.lineTo(W, GROUND_Y);
      ctx.fill();
      drawTerrain("#1d2433", "#8fb6ff", "#28324a");
      // rain
      ctx.strokeStyle = "rgba(160,200,255,0.4)"; ctx.lineWidth = 1.5;
      ctx.beginPath();
      S.rain.forEach((r) => {
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - r.vx * 0.016, r.y - r.vy * 0.016);
      });
      ctx.stroke();
    };

    const drawBarriers = () => {
      const bars = barrierRects();
      const cols = map.theme === "fortress"
        ? { fill: "#6b5230", edge: "#ffb85c", brick: "rgba(0,0,0,0.2)" }
        : { fill: "#3a4763", edge: "#8fb6ff", brick: "rgba(0,0,0,0.25)" };
      bars.forEach((r) => {
        ctx.save();
        if (r.move) { ctx.shadowColor = cols.edge; ctx.shadowBlur = 14; }
        ctx.fillStyle = r.move ? "#4a5a80" : cols.fill;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        // brick lines
        ctx.strokeStyle = cols.brick; ctx.lineWidth = 1.5;
        for (let yy = r.y + 14; yy < r.y + r.h; yy += 14) {
          ctx.beginPath(); ctx.moveTo(r.x, yy); ctx.lineTo(r.x + r.w, yy); ctx.stroke();
        }
        ctx.shadowColor = cols.edge; ctx.shadowBlur = 8;
        ctx.strokeStyle = cols.edge; ctx.lineWidth = 2;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.restore();
        // arrows visual hint for moving barrier
        if (r.move) {
          ctx.save();
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.font = "10px monospace"; ctx.textAlign = "center";
          ctx.fillText("⇕", r.x + r.w / 2, r.y - 6);
          ctx.restore();
        }
      });
    };

    const drawBackground = () => {
      if (map.theme === "meadow") drawMeadow();
      else if (map.theme === "fortress") drawFortress();
      else drawStorm();
      drawBarriers();
    };

    // ---------- archer ----------
    const drawArcher = (p) => {
      const active = S.turn === p.id && S.mode === "aim";
      ctx.save();
      if (p.hurtFlash > 0) ctx.globalAlpha = 0.55 + 0.45 * Math.sin(S.t * 60);

      const hy = p.y - 78, hip = p.y - 34, neck = p.y - 66;
      ctx.strokeStyle = "#f4f7fb"; ctx.lineWidth = 5; ctx.lineCap = "round";

      // legs — run animation while moving, stance otherwise
      ctx.beginPath();
      if (!p.onGround) {
        ctx.moveTo(p.x, hip); ctx.lineTo(p.x - 9 * p.facing, p.y - 10);
        ctx.moveTo(p.x, hip); ctx.lineTo(p.x + 11 * p.facing, p.y - 6);
      } else if (Math.abs(p.vx) > 20) {
        const lp = Math.sin(p.runPhase) * 13;
        ctx.moveTo(p.x, hip); ctx.lineTo(p.x - 8 + lp * 0.6, p.y);
        ctx.moveTo(p.x, hip); ctx.lineTo(p.x + 8 - lp * 0.6, p.y);
      } else {
        ctx.moveTo(p.x, hip); ctx.lineTo(p.x - p.facing * 12, p.y);
        ctx.moveTo(p.x, hip); ctx.lineTo(p.x + p.facing * 12, p.y);
      }
      ctx.stroke();

      const breathe = Math.sin(S.t * 1.6 + p.breathe) * 1.2;
      ctx.beginPath(); ctx.moveTo(p.x, hip); ctx.lineTo(p.x, neck + breathe); ctx.stroke();
      ctx.save();
      ctx.shadowColor = p.neon; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(p.x, hy + 2 + breathe, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = p.neon; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, hy + 2 + breathe, 11, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.restore();

      const a = p.angle;
      const dirX = Math.cos(a) * p.facing, dirY = -Math.sin(a);
      const shoulder = { x: p.x, y: neck + 6 + breathe };
      const pull = active && S.charging ? S.power * 10 : 0;
      const bowC = { x: shoulder.x + dirX * 20, y: shoulder.y + dirY * 20 };

      ctx.strokeStyle = "#f4f7fb"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(bowC.x, bowC.y); ctx.stroke();
      const drawHand = { x: shoulder.x - dirX * (4 + pull), y: shoulder.y - dirY * (4 + pull) + 4 };
      ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(drawHand.x, drawHand.y); ctx.stroke();

      // NEON BOW
      const perpX = -dirY, perpY = dirX;
      const tipA = { x: bowC.x + perpX * 26, y: bowC.y + perpY * 26 };
      const tipB = { x: bowC.x - perpX * 26, y: bowC.y - perpY * 26 };
      ctx.save();
      ctx.shadowColor = p.neon; ctx.shadowBlur = 16;
      ctx.strokeStyle = p.neon; ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(tipA.x, tipA.y);
      ctx.quadraticCurveTo(bowC.x + dirX * 14, bowC.y + dirY * 14, tipB.x, tipB.y);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(tipA.x, tipA.y);
      ctx.lineTo(drawHand.x, drawHand.y);
      ctx.lineTo(tipB.x, tipB.y);
      ctx.stroke();
      ctx.restore();

      if (active) {
        const nock = drawHand;
        const tip = { x: nock.x + dirX * (34 + pull), y: nock.y + dirY * (34 + pull) };
        const pu = p.powerup;
        const arrowCol = pu ? PUPS[pu].color : "#e8eef5";
        ctx.save();
        ctx.shadowColor = arrowCol; ctx.shadowBlur = 8;
        ctx.strokeStyle = arrowCol; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(nock.x, nock.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.setLineDash([3, 7]); ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tip.x, tip.y);
        ctx.lineTo(tip.x + dirX * 46, tip.y + dirY * 46);
        ctx.stroke();
        ctx.restore();
      }

      if (p.frozenTurns > 0) {
        ctx.save();
        ctx.fillStyle = "rgba(169,230,255,0.3)";
        ctx.strokeStyle = "rgba(200,240,255,0.8)";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#a9e6ff"; ctx.shadowBlur = 14;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(p.x - 26, p.y - 96, 52, 100, 6);
        else ctx.rect(p.x - 26, p.y - 96, 52, 100);
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x - 14, p.y - 88); ctx.lineTo(p.x - 4, p.y - 72); ctx.stroke();
        ctx.restore();
      }

      if (p.powerup) {
        const pu = PUPS[p.powerup];
        ctx.save();
        ctx.shadowColor = pu.color; ctx.shadowBlur = 10;
        ctx.fillStyle = pu.color; ctx.font = "bold 15px monospace"; ctx.textAlign = "center";
        ctx.fillText(pu.icon, p.x, p.y - 102);
        ctx.restore();
      }

      if (active) {
        ctx.save();
        ctx.shadowColor = p.neon; ctx.shadowBlur = 10;
        ctx.fillStyle = p.neon;
        const bob = Math.sin(S.t * 5) * 3;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 118 + bob);
        ctx.lineTo(p.x - 7, p.y - 128 + bob);
        ctx.lineTo(p.x + 7, p.y - 128 + bob);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    };

    const drawArrow = (ar) => {
      ar.trail.forEach((t) => {
        if (t.life <= 0) return;
        const a = t.life / t.max;
        ctx.save();
        const col = ar.explosive ? "#ffb347" : ar.ice ? "#a9e6ff" : S.players[ar.owner].neon;
        ctx.shadowColor = col; ctx.shadowBlur = 8;
        ctx.fillStyle = col; ctx.globalAlpha = a * 0.5;
        ctx.beginPath(); ctx.arc(t.x, t.y, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      if (ar.dead) return;
      const ang = Math.atan2(ar.vy, ar.vx);
      const col = ar.explosive ? "#ffb347" : ar.ice ? "#a9e6ff" : "#e8eef5";
      ctx.save();
      ctx.translate(ar.x, ar.y);
      ctx.rotate(ang);
      ctx.shadowColor = ar.explosive ? "#ffb347" : ar.ice ? "#a9e6ff" : S.players[ar.owner].neon;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(10, 0); ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(7, -3.5); ctx.lineTo(7, 3.5); ctx.fill();
      ctx.strokeStyle = S.players[ar.owner].neon; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-14, 0); ctx.lineTo(-18, -4);
      ctx.moveTo(-14, 0); ctx.lineTo(-18, 4);
      ctx.stroke();
      ctx.restore();
    };

    const drawBalloon = (b) => {
      const pu = PUPS[b.type];
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(b.x, b.y + 16); ctx.quadraticCurveTo(b.x + 4, b.y + 28, b.x, b.y + 40); ctx.stroke();
      ctx.shadowColor = pu.color; ctx.shadowBlur = 14;
      ctx.fillStyle = pu.color; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.ellipse(b.x, b.y, 15, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath(); ctx.ellipse(b.x - 5, b.y - 6, 4, 6, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#0a0f18"; ctx.font = "bold 13px monospace"; ctx.textAlign = "center";
      ctx.fillText(pu.icon, b.x, b.y + 4);
      ctx.restore();
    };

    const drawHUD = () => {
      const bw = 300;
      const bar = (x, p, flip) => {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(x, 16, bw, 18);
        const w = (p.hp / MAX_HP) * (bw - 4);
        ctx.save();
        ctx.shadowColor = p.neon; ctx.shadowBlur = 10;
        ctx.fillStyle = p.neon;
        ctx.fillRect(flip ? x + 2 + (bw - 4 - w) : x + 2, 18, w, 14);
        ctx.restore();
        ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.5;
        ctx.strokeRect(x, 16, bw, 18);
      };
      bar(20, S.players[0], false);
      bar(W - 20 - bw, S.players[1], true);
      ctx.fillStyle = "#fff"; ctx.font = "bold 11px monospace";
      ctx.textAlign = "left"; ctx.fillText("P1 🏹", 20, 47);
      ctx.textAlign = "right"; ctx.fillText("🏹 P2", W - 20, 47);

      ctx.textAlign = "center";
      for (let s = 0; s < 2; s++) {
        for (let i = 0; i < ROUNDS_TO_WIN; i++) {
          const x = W / 2 + (s === 0 ? -1 : 1) * (78 + i * 18);
          ctx.save();
          if (i < S.wins[s]) { ctx.shadowColor = S.players[s].neon; ctx.shadowBlur = 8; }
          ctx.beginPath(); ctx.arc(x, 24, 5, 0, Math.PI * 2);
          ctx.fillStyle = i < S.wins[s] ? S.players[s].neon : "rgba(255,255,255,0.18)";
          ctx.fill();
          ctx.restore();
        }
      }

      // WIND
      const wk = S.wind / (200 * map.windMult);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(W / 2 - 58, 12, 116, 26);
      ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1;
      ctx.strokeRect(W / 2 - 58, 12, 116, 26);
      ctx.fillStyle = "#fff"; ctx.font = "9px monospace";
      ctx.fillText(`WIND${map.windMult > 1.2 ? " ⚠" : ""}`, W / 2, 21);
      const wandX = W / 2, wandY = 30;
      const wlen = Math.abs(wk) * 44;
      ctx.save();
      const wcol = Math.abs(wk) > 0.6 ? "#ff8f6a" : "#8fe0ff";
      ctx.shadowColor = wcol; ctx.shadowBlur = 8;
      ctx.strokeStyle = wcol; ctx.lineWidth = 3; ctx.lineCap = "round";
      if (Math.abs(wk) > 0.04) {
        const dir = Math.sign(wk);
        ctx.beginPath();
        ctx.moveTo(wandX - dir * wlen * 0.5, wandY);
        ctx.lineTo(wandX + dir * wlen * 0.5, wandY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(wandX + dir * wlen * 0.5, wandY);
        ctx.lineTo(wandX + dir * (wlen * 0.5 - 6), wandY - 4);
        ctx.moveTo(wandX + dir * wlen * 0.5, wandY);
        ctx.lineTo(wandX + dir * (wlen * 0.5 - 6), wandY + 4);
        ctx.stroke();
      } else {
        ctx.fillStyle = wcol;
        ctx.beginPath(); ctx.arc(wandX, wandY, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // ACTIVE PANEL + SHOT CLOCK
      const p = S.players[S.turn];
      if (S.mode === "aim") {
        const px = p.id === 0 ? 20 : W - 20 - 170;
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(px, 58, 170, 52);
        ctx.strokeStyle = p.neon; ctx.lineWidth = 1;
        ctx.strokeRect(px, 58, 170, 52);
        ctx.fillStyle = "#fff"; ctx.font = "10px monospace"; ctx.textAlign = "left";
        const secs = Math.max(0, Math.ceil(S.shotClock));
        ctx.fillText(`P${p.id + 1} · ANGLE ${(p.angle * 180 / Math.PI).toFixed(0)}°`, px + 8, 72);
        ctx.fillStyle = secs <= 5 ? "#ff8f6a" : "#fff";
        ctx.textAlign = "right";
        ctx.fillText(`⏱ ${secs}s`, px + 162, 72);
        ctx.textAlign = "left"; ctx.fillStyle = "#fff";
        ctx.fillText("POWER", px + 8, 88);
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(px + 8, 93, 154, 10);
        ctx.fillStyle = "rgba(125,255,176,0.25)";
        ctx.fillRect(px + 8 + 154 * 0.72, 93, 154 * 0.28, 10);
        ctx.save();
        ctx.shadowColor = p.neon; ctx.shadowBlur = 8;
        ctx.fillStyle = S.power > 0.72 ? "#7dffb0" : p.neon;
        ctx.fillRect(px + 8, 93, 154 * S.power, 10);
        ctx.restore();
        if (p.powerup) {
          const pu = PUPS[p.powerup];
          ctx.fillStyle = pu.color; ctx.font = "bold 10px monospace";
          ctx.fillText(`NEXT: ${pu.icon} ${pu.name}`, px + 8, 121);
        }
      }

      if (S.bannerT > 0) {
        ctx.save();
        ctx.shadowColor = S.bannerCol; ctx.shadowBlur = 16;
        ctx.fillStyle = S.bannerCol; ctx.font = "bold 26px monospace"; ctx.textAlign = "center";
        ctx.fillText(S.banner, W / 2, 90);
        ctx.restore();
      }
      if (S.mode === "roundEnd") {
        ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, W, H);
        const wp = S.players[S.roundWinner];
        ctx.save();
        ctx.shadowColor = wp.neon; ctx.shadowBlur = 24;
        ctx.fillStyle = wp.neon; ctx.font = "bold 48px monospace"; ctx.textAlign = "center";
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

    // ---------- loop ----------
    let raf, last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;
      S.t += dt;
      if (S.bannerT > 0) S.bannerT -= dt;
      if (S.flash > 0) S.flash -= dt;

      update(dt);

      ctx.save();
      if (S.shake > 0) {
        S.shake -= dt;
        ctx.translate((Math.random() - 0.5) * S.shake * 28, (Math.random() - 0.5) * S.shake * 28);
      }
      drawBackground();

      S.stuck.forEach((st) => {
        ctx.save();
        ctx.globalAlpha = Math.min(1, st.life);
        ctx.translate(st.x, st.y);
        ctx.rotate(st.angle);
        ctx.strokeStyle = "#c9d2dd"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(0, 0); ctx.stroke();
        ctx.strokeStyle = S.players[st.owner].neon; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-16, 0); ctx.lineTo(-20, -4);
        ctx.moveTo(-16, 0); ctx.lineTo(-20, 4);
        ctx.stroke();
        ctx.restore();
      });

      S.balloons.forEach(drawBalloon);
      S.rings.forEach((r) => {
        ctx.save();
        ctx.shadowColor = r.color; ctx.shadowBlur = 16;
        ctx.strokeStyle = r.color; ctx.globalAlpha = r.life / r.t; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      });
      S.players.forEach(drawArcher);
      S.arrows.forEach(drawArrow);
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
  const mapColors = [
    { top: "#070b1c", bot: "#1b2f57", acc: "#5dd48a" },
    { top: "#160f08", bot: "#463016", acc: "#ffb85c" },
    { top: "#05070f", bot: "#101b33", acc: "#8fb6ff" },
  ];

  if (phase === "menu" || phase === "matchEnd") {
    return (
      <div style={wrap}>
        <h1 style={{ letterSpacing: 5, margin: "26px 0 2px", fontSize: 34 }}>
          <span style={neonText("#3aa0ff")}>STICKMAN</span>{" "}
          <span style={{ opacity: 0.9 }}>🏹</span>{" "}
          <span style={neonText("#ff3b4d")}>ARCHERY BATTLE</span>
        </h1>
        <p style={{ opacity: 0.65, marginTop: 4 }}>move · jump · dodge · shoot — best of 3</p>

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

        <p style={{ marginBottom: 8, opacity: 0.85 }}>Choose your battlefield:</p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          {MAPS.map((m, i) => (
            <button key={m.name} onClick={() => startMatch(i)}
              style={{
                cursor: "pointer", width: 205, padding: 0, borderRadius: 10, overflow: "hidden",
                border: "2px solid rgba(255,255,255,0.18)", background: "#10141d", color: "#e8eef5",
                fontFamily: "monospace", transition: "transform .15s, box-shadow .15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(120,180,255,0.25)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
              <MapCardPreview map={m} colors={mapColors[i]} index={i} />
              <div style={{ padding: "9px 0 2px", fontWeight: "bold", letterSpacing: 1 }}>{m.name}</div>
              <div style={{ padding: "0 6px 10px", fontSize: 10, opacity: 0.55 }}>{m.desc}</div>
            </button>
          ))}
        </div>

        <div style={{
          marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30,
          fontSize: 13, lineHeight: 1.85, background: "#10141d", padding: "16px 28px",
          borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div>
            <b style={neonText("#3aa0ff")}>PLAYER 1</b><br />
            A / D — move · W — jump<br />
            R / F — aim up / down<br />
            <b>SPACE</b> — hold-draw · release-fire
          </div>
          <div>
            <b style={neonText("#ff3b4d")}>PLAYER 2</b><br />
            ← / → — move · ↑ — jump<br />
            K / J — aim up / down<br />
            <b>ENTER</b> — hold-draw · release-fire
          </div>
        </div>

        <div style={{
          marginTop: 12, fontSize: 12, background: "#10141d", padding: "12px 26px",
          borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", maxWidth: 660, lineHeight: 2, textAlign: "center",
        }}>
          <b>You can move & jump at ANY time — even to dodge incoming arrows!</b> But you're confined to your own hill.<br />
          ⏱ 20-second shot clock · barriers block arrows (arc over them!) · the ⇕ gate on Storm Peaks moves<br />
          <span style={neonText("#8fe0ff")}>⁂ triple</span> · <span style={{ color: "#ffb347" }}>💥 explosive</span> · <span style={{ color: "#a9e6ff" }}>❄ ice = frozen solid: no dodging + turn skipped</span><br />
          <span style={{ opacity: 0.6 }}>body −{DMG.body} · headshot −{DMG.head} · release power in the green zone for max range</span>
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
        <span style={{ opacity: 0.7, fontSize: 13 }}>{MAPS[mapIdx].name} · best of 3 · dodge & shoot</span>
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
        P1: A/D/W move+jump · R/F aim · SPACE fire — P2: arrows move+jump · K/J aim · ENTER fire — dodge those arrows!
      </p>
    </div>
  );
}
