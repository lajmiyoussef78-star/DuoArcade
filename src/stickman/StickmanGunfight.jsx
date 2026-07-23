import React, { useRef, useEffect, useState } from "react";

// ============ STICKMAN GUNFIGHT - NEON ARENA DUEL ============
// Circular side-view arena split by a horizontal diameter.
// P1 owns the upper half | P2 owns the lower half.
// Quick Match (best of 3) or Full Session (5 weapon levels x 3 rounds).
//
//   P1 (upper):  A/D move | W jump | S crouch | Q/E rotate arm | SPACE fire | R reload
//   P2 (lower):  Left/Right move | Up jump | Down crouch | O/P rotate arm | ENTER fire | / reload

const CW = 960, CH = 720;
const CX = CW / 2, CY = CH / 2 + 10;
const ARENA_R = 310;
const MID_GAP = 10;
const GRAV = 1650;
const MAX_RUN = 255;
const GROUND_ACCEL = 34;
const AIR_ACCEL = 14;
const GROUND_FRICTION = 16;
const AIR_DRAG = 3;
const JUMP = -560;
const JUMP_BUFFER = 0.12;
const PHYS_STEP = 1 / 180;
const FOOT_OFF = 20;
const FOOT_OFF_CROUCH = 18;
const TORSO_OFF = 22;
const TORSO_OFF_CROUCH = 14;
const HEAD_OFF = 40;
const HEAD_OFF_CROUCH = 28;
const ROUND_TIME = 90;
const MAX_HP = 100;

const E = {
  gun: "\u{1F52B}", boom: "\u{1F4A5}", fire: "\u{1F525}", target: "\u{1F3AF}", bomb: "\u{1F4A3}",
  heart: "\u2764\uFE0F", zap: "\u26A1", jump: "\u23EB", sword: "\u{1F5E1}\uFE0F", shield: "\u{1F6E1}\uFE0F",
  reload: "\u{1F504}", armor: "\u{1F9BA}", rico: "\u21A9\uFE0F", snow: "\u2744\uFE0F", radar: "\u{1F4E1}",
  inf: "\u221E", trophy: "\u{1F3C6}", crown: "\u{1F451}", shake: "\u{1F91D}", stadium: "\u{1F3DF}\uFE0F",
  gift: "\u{1F381}", clock: "\u23F1\uFE0F", mute: "\u{1F507}", sound: "\u{1F50A}", left: "\u2190",
  right: "\u2192", up: "\u2191", down: "\u2193",
};

const WEAPON_IDS = ["pistol", "shotgun", "mg", "sniper", "grenade"];
const WEAPON_META = {
  pistol:  { name: "Pistols",      emoji: E.gun,    color: "#7cc8ff", desc: "precise | ricochet 3x | infinite ammo" },
  shotgun: { name: "Shotguns",     emoji: E.boom,   color: "#ffb85c", desc: "close-range power | knockback | pellet spray" },
  mg:      { name: "Machine Guns", emoji: E.fire,   color: "#ff7a3c", desc: "suppressive fire | recoil climbs | big mag" },
  sniper:  { name: "Snipers",      emoji: E.target, color: "#b08cff", desc: "one shot | laser sight | headshot = out" },
  grenade: { name: "Grenades",     emoji: E.bomb,   color: "#7dff9a", desc: "long lobs | bounce | timed boom | blast jumps" },
};

const WEAPON_STATS = {
  pistol:  { dmg: 14, speed: 920, rate: 0.28, reload: 0.35, mag: Infinity, spread: 0.03, pellets: 1, knock: 40, ricochet: 3, auto: false, infinite: true },
  shotgun: { dmg: 9,  speed: 780, rate: 0.85, reload: 1.1,  mag: 6,        spread: 0.22, pellets: 6, knock: 220, ricochet: 0, auto: false, infinite: false },
  mg:      { dmg: 6,  speed: 1000, rate: 0.08, reload: 1.4, mag: 36,       spread: 0.06, pellets: 1, knock: 30, ricochet: 0, auto: true, infinite: false, recoilGrow: 0.018 },
  sniper:  { dmg: 70, speed: 1600, rate: 0.2, reload: 1.6,  mag: 1,        spread: 0.0,  pellets: 1, knock: 80, ricochet: 0, auto: false, infinite: false, headshot: true, laser: true },
  grenade: { dmg: 70, speed: 780, rate: 0.9, reload: 0,    mag: Infinity, spread: 0.02, pellets: 1, knock: 340, ricochet: 0, auto: false, infinite: true, isGrenade: true, fuse: 2.15, blastR: 82 },
};

const UTIL_DEFS = [
  { id: "health",   name: "Health Pack",   emoji: E.heart,  color: "#ff6b8a", dur: 0 },
  { id: "speed",    name: "Speed Boost",   emoji: E.zap,    color: "#ffe45c", dur: 8 },
  { id: "jump",     name: "Jump Boost",    emoji: E.jump,   color: "#7de8ff", dur: 8 },
  { id: "damage",   name: "Double Damage", emoji: E.sword,  color: "#ff7a3c", dur: 7 },
  { id: "shield",   name: "Shield",        emoji: E.shield, color: "#7cc8ff", dur: 6 },
  { id: "reload",   name: "Fast Reload",   emoji: E.reload, color: "#b08cff", dur: 10 },
  { id: "armor",    name: "Armor",         emoji: E.armor,  color: "#9aa4b2", dur: 12 },
  { id: "ricochet", name: "Ricochet Ammo", emoji: E.rico,   color: "#ffd27a", dur: 10 },
  { id: "freeze",   name: "Freeze Effect", emoji: E.snow,   color: "#a8e6ff", dur: 5 },
  { id: "radar",    name: "Radar Vision",  emoji: E.radar,  color: "#5dff8a", dur: 9 },
  { id: "infammo",  name: "Infinite Ammo", emoji: E.inf,    color: "#ff6ad4", dur: 6 },
];

const ARENA_THEMES = [
  { name: "Neon Ring",    top: "#0b1630", bot: "#1a0a2e", acc: "#3aa0ff", rim: "#7cc8ff" },
  { name: "Crimson Pit",  top: "#2a0a10", bot: "#1a0818", acc: "#ff3b4d", rim: "#ff8090" },
  { name: "Voltage Dome", top: "#12140a", bot: "#0e1a14", acc: "#ffe45c", rim: "#ffb85c" },
  { name: "Aurora Bowl",  top: "#03101f", bot: "#0a1a28", acc: "#7de8ff", rim: "#4fd8ff" },
  { name: "Toxic Circle", top: "#06140a", bot: "#0a1e12", acc: "#5dff8a", rim: "#7dff9a" },
  { name: "Void Arena",   top: "#0a0318", bot: "#140a22", acc: "#b08cff", rim: "#d0a8ff" },
];

function makeArenas() {
  const plat = (x, y, w, h = 12, opts = {}) => ({
    x: CX + x, y: CY + y, w, h, hp: opts.hp ?? 0, ramp: opts.ramp || 0, wall: !!opts.wall,
  });
  return [
    {
      name: "Twin Balconies",
      plats: [
        plat(-160, -120, 140), plat(40, -150, 110), plat(-40, -70, 160),
        plat(-180, -200, 80), plat(120, -90, 70),
        plat(-160, 120, 140), plat(40, 150, 110), plat(-40, 70, 160),
        plat(-180, 200, 80), plat(120, 90, 70),
        plat(-20, -20, 40, 8), plat(-20, 12, 40, 8),
        plat(-90, -110, 14, 50, { wall: true, hp: 40 }),
        plat(70, 90, 14, 50, { wall: true, hp: 40 }),
      ],
    },
    {
      name: "Ramp Wars",
      plats: [
        plat(-190, -90, 100), plat(-60, -140, 120), plat(90, -100, 90),
        plat(-140, -180, 80), plat(20, -60, 100, 12, { ramp: -0.25 }),
        plat(-190, 90, 100), plat(-60, 140, 120), plat(90, 100, 90),
        plat(-140, 180, 80), plat(20, 60, 100, 12, { ramp: 0.25 }),
        plat(-10, -18, 50, 8), plat(-10, 10, 50, 8),
        plat(-40, -100, 16, 55, { wall: true, hp: 35 }),
        plat(30, 80, 16, 55, { wall: true, hp: 35 }),
        plat(130, -160, 60, 10, { hp: 25 }),
        plat(-170, 150, 60, 10, { hp: 25 }),
      ],
    },
    {
      name: "Fort Split",
      plats: [
        plat(-200, -110, 90), plat(-80, -160, 100), plat(50, -120, 130),
        plat(-150, -60, 80), plat(120, -180, 70), plat(-30, -30, 60, 10),
        plat(-200, 110, 90), plat(-80, 160, 100), plat(50, 120, 130),
        plat(-150, 60, 80), plat(120, 180, 70), plat(-30, 20, 60, 10),
        plat(-100, -130, 14, 70, { wall: true, hp: 50 }),
        plat(90, 100, 14, 70, { wall: true, hp: 50 }),
        plat(0, -80, 50, 10, { hp: 20 }),
        plat(-20, 70, 50, 10, { hp: 20 }),
      ],
    },
    {
      name: "Sky Steps",
      plats: [
        plat(-170, -70, 80), plat(-90, -120, 80), plat(-10, -170, 80),
        plat(80, -130, 90), plat(-200, -200, 60),
        plat(-170, 70, 80), plat(-90, 120, 80), plat(-10, 170, 80),
        plat(80, 130, 90), plat(-200, 200, 60),
        plat(-40, -14, 80, 8), plat(-40, 6, 80, 8),
        plat(40, -90, 12, 45, { wall: true, hp: 30 }),
        plat(-60, 85, 12, 45, { wall: true, hp: 30 }),
      ],
    },
    {
      name: "Crossfire",
      plats: [
        plat(-180, -100, 120), plat(40, -140, 140), plat(-60, -180, 90),
        plat(-120, -50, 70), plat(100, -80, 80),
        plat(-180, 100, 120), plat(40, 140, 140), plat(-60, 180, 90),
        plat(-120, 50, 70), plat(100, 80, 80),
        plat(-25, -22, 50, 8), plat(-25, 14, 50, 8),
        plat(-70, -110, 18, 40, { wall: true, hp: 45 }),
        plat(60, 90, 18, 40, { wall: true, hp: 45 }),
        plat(150, -160, 40, 10, { hp: 15 }),
        plat(-200, 155, 40, 10, { hp: 15 }),
      ],
    },
  ];
}
const ARENAS = makeArenas();

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
    } catch { /* audio unavailable */ }
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
    } catch { /* audio unavailable */ }
  };
  return {
    setMuted: (m) => { muted = m; },
    unlock: () => ctx(),
    shoot: (kind) => {
      if (kind === "sniper") { noise(0.18, 900, 0.35, 0.6); tone(180, 0.2, "sawtooth", 0.18, -80); }
      else if (kind === "shotgun") { noise(0.22, 500, 0.4, 0.5); tone(120, 0.15, "square", 0.15, -40); }
      else if (kind === "mg") { noise(0.05, 1400, 0.18, 0.8); tone(320, 0.05, "square", 0.08); }
      else if (kind === "grenade") { tone(200, 0.08, "triangle", 0.12, -60); }
      else { noise(0.06, 1600, 0.2, 1); tone(440, 0.06, "square", 0.1, -120); }
    },
    hit: () => { noise(0.08, 700, 0.25, 0.8); tone(160, 0.08, "sawtooth", 0.12); },
    headshot: () => { tone(880, 0.1, "square", 0.2); tone(1320, 0.15, "square", 0.16, 0, 0.08); },
    reload: () => { tone(220, 0.08, "triangle", 0.1); tone(330, 0.1, "triangle", 0.08, 0, 0.08); },
    explode: () => { noise(0.4, 280, 0.5, 0.5); tone(80, 0.35, "sawtooth", 0.3, -40); },
    pickup: () => { tone(660, 0.1, "sine", 0.14); tone(990, 0.12, "sine", 0.12, 0, 0.08); },
    jump: () => tone(280, 0.1, "sine", 0.1, 200),
    beep: (final) => tone(final ? 880 : 440, 0.14, "square", 0.16),
    win: () => [523, 659, 784, 1046, 1319].forEach((f, i) => tone(f, 0.28, "triangle", 0.2, 0, i * 0.12)),
    draw: () => { tone(300, 0.2, "triangle", 0.15); tone(250, 0.25, "triangle", 0.12, 0, 0.15); },
    tick: () => tone(700, 0.05, "square", 0.08),
  };
}
const SFX = makeSFX();

const KEYS = {
  p1: { left: "KeyA", right: "KeyD", jump: "KeyW", down: "KeyS", aimUp: "KeyQ", aimDn: "KeyE", fire: "Space", reload: "KeyR" },
  p2: { left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp", down: "ArrowDown", aimUp: "KeyO", aimDn: "KeyP", fire: "Enter", reload: "Slash" },
};
const ALL_KEYS = [...Object.values(KEYS.p1), ...Object.values(KEYS.p2)];

function pFootOff(p) { return p.crouch ? FOOT_OFF_CROUCH : FOOT_OFF; }
function pFeetY(p) { return p.y + pFootOff(p); }
function pTorsoY(p) { return p.y - (p.crouch ? TORSO_OFF_CROUCH : TORSO_OFF); }
function pHeadY(p) { return p.y - (p.crouch ? HEAD_OFF_CROUCH : HEAD_OFF); }

function makePlayer(id, weaponId, upper = id === 0) {
  return {
    id,
    upper,
    neon: id === 0 ? "#3aa0ff" : "#ff3b4d",
    glow: id === 0 ? "#7cc8ff" : "#ff8090",
    x: CX + (upper ? -90 : 90),
    y: CY + (upper ? -100 : 100),
    vx: 0, vy: 0,
    facing: upper ? 1 : -1,
    aim: upper ? 0.2 : Math.PI - 0.2,
    grounded: false,
    groundT: 0,
    jumpBuf: 0,
    crouch: false,
    hp: MAX_HP,
    weapon: weaponId,
    ammo: WEAPON_STATS[weaponId].mag,
    reloadT: 0,
    fireCD: 0,
    recoil: 0,
    alive: true,
    invuln: 0,
    powers: {},
    freezeT: 0,
  };
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function len(x, y) { return Math.hypot(x, y); }

function StickFighter({ x, color, facing, delayClass = "" }) {
  const flip = facing < 0 ? -1 : 1;
  return (
    <g transform={`translate(${x}, 0)`}>
      <g className={`bob ${delayClass}`}>
        <g transform={`scale(${flip}, 1)`}>
          <g transform="translate(0, 28)">
            <g className="leg-a">
              <line x1="0" y1="0" x2="-7" y2="16" stroke="#e8eef5" strokeWidth="2.4" strokeLinecap="round" />
            </g>
          </g>
          <g transform="translate(0, 28)">
            <g className="leg-b">
              <line x1="0" y1="0" x2="7" y2="16" stroke="#e8eef5" strokeWidth="2.4" strokeLinecap="round" />
            </g>
          </g>
          <line x1="0" y1="28" x2="0" y2="10" stroke="#e8eef5" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="0" cy="2" r="6.5" fill="none" stroke="#e8eef5" strokeWidth="2.4" />
          <path d="M-5.5,-1 A6.5,6.5 0 0 1 5.5,-1" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <g transform="translate(0, 12)">
            <g className="arm-aim">
              <line x1="0" y1="0" x2="10" y2="4" stroke="#e8eef5" strokeWidth="2.4" strokeLinecap="round" />
            </g>
          </g>
          <g transform="translate(0, 12)">
            <line x1="0" y1="0" x2="-8" y2="6" stroke="#e8eef5" strokeWidth="2.4" strokeLinecap="round" />
          </g>
        </g>
      </g>
    </g>
  );
}

function WeaponDuelPreview() {
  return (
    <svg className="gf-duel" viewBox="0 0 140 78" width="100%" height="100%" aria-hidden
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <g transform="translate(0, 24)">
        <StickFighter x={28} color="#3aa0ff" facing={1} />
        <StickFighter x={112} color="#ff3b4d" facing={-1} delayClass="bob-delay" />
      </g>
    </svg>
  );
}

function TouchAnalog({ color, onMove, style }) {
  const baseRef = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const maxDist = 32;
  const size = 96;

  const updateFromTouch = (clientX, clientY) => {
    const rect = baseRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }
    setKnob({ x: dx, y: dy });
    const nx = dx / maxDist;
    const ny = dy / maxDist;
    const dead = 0.18;
    onMove({
      left: nx < -dead,
      right: nx > dead,
      down: ny > dead,
      ax: nx,
      ay: ny,
    });
  };

  const reset = () => {
    setKnob({ x: 0, y: 0 });
    onMove({ left: false, right: false, down: false, ax: 0, ay: 0 });
  };

  const onTouch = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const t = e.touches[0];
    if (t) updateFromTouch(t.clientX, t.clientY);
  };

  return (
    <div
      ref={baseRef}
      className="gf-touch-analog"
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderColor: color,
        boxShadow: `0 0 16px ${color}55`,
        zIndex: 8,
        ...style,
      }}
      onTouchStart={onTouch}
      onTouchMove={onTouch}
      onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); reset(); }}
      onTouchCancel={(e) => { e.preventDefault(); e.stopPropagation(); reset(); }}
    >
      <div
        className="gf-touch-analog-knob"
        style={{
          transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
          background: `${color}44`,
          borderColor: color,
          boxShadow: `0 0 10px ${color}88`,
        }}
      />
    </div>
  );
}

function TouchAimZone({ playerId, stateRef, style }) {
  const aim = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    if (t && stateRef.current.aimFromScreen) {
      stateRef.current.aimFromScreen(playerId, t.clientX, t.clientY);
    }
  };
  const end = (e) => {
    e.preventDefault();
    if (stateRef.current.endTouchAim) stateRef.current.endTouchAim(playerId);
  };
  return (
    <div
      className="gf-touch-aim"
      style={style}
      onTouchStart={aim}
      onTouchMove={aim}
      onTouchEnd={end}
      onTouchCancel={end}
    />
  );
}

function MobilePlayerPad({ playerId, keys, color, fireColor, stateRef, analogStyle, jumpStyle, fireStyle }) {
  const setMove = (st) => {
    if (stateRef.current.setTouchMove) stateRef.current.setTouchMove(playerId, st);
  };
  const press = (code, down) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (stateRef.current.setKey) stateRef.current.setKey(code, down);
  };
  return (
    <>
      <TouchAnalog color={color} onMove={setMove} style={analogStyle} />
      <div
        className="gf-touch-btn"
        style={{ borderColor: color, boxShadow: `0 0 12px ${color}66`, zIndex: 8, ...jumpStyle }}
        onTouchStart={press(keys.jump, true)}
        onTouchEnd={press(keys.jump, false)}
        onTouchCancel={press(keys.jump, false)}
      >{E.up}</div>
      <div
        className="gf-touch-btn gf-touch-fire"
        style={{ borderColor: fireColor, boxShadow: `0 0 16px ${fireColor}88`, zIndex: 8, ...fireStyle }}
        onTouchStart={press(keys.fire, true)}
        onTouchEnd={press(keys.fire, false)}
        onTouchCancel={press(keys.fire, false)}
      >{E.gun}</div>
    </>
  );
}

export default function StickmanGunfight() {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState("menu");
  const [hud, setHud] = useState(null);
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

  const beginQuick = () => { SFX.unlock(); setPhase("weaponSelect"); setResult(null); };
  const beginSession = () => {
    SFX.unlock();
    setResult(null);
    stateRef.current.launch = {
      mode: "session", weaponIdx: 0, roundInLevel: 1, score: [0, 0], sessionWins: [0, 0],
      arenaIdx: Math.floor(Math.random() * ARENAS.length),
      themeIdx: Math.floor(Math.random() * ARENA_THEMES.length),
    };
    setPhase("playing");
  };
  const startQuickWith = (wid) => {
    SFX.unlock();
    stateRef.current.launch = {
      mode: "quick", weaponId: wid, weaponIdx: WEAPON_IDS.indexOf(wid),
      roundInLevel: 1, score: [0, 0], sessionWins: [0, 0],
      arenaIdx: Math.floor(Math.random() * ARENAS.length),
      themeIdx: Math.floor(Math.random() * ARENA_THEMES.length),
    };
    setPhase("playing");
  };

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const L = stateRef.current.launch;
    let weaponId = L.mode === "quick" ? L.weaponId : WEAPON_IDS[L.weaponIdx];
    let arenaIdx = L.arenaIdx;
    let themeIdx = L.themeIdx;
    let score = [...L.score];
    let sessionWins = [...L.sessionWins];
    let roundInLevel = L.roundInLevel;
    let weaponIdx = L.weaponIdx;

    const cloneArena = (idx) => {
      const base = ARENAS[idx];
      return { name: base.name, plats: base.plats.map((p) => ({ ...p })) };
    };

    const S = {
      players: [makePlayer(0, weaponId), makePlayer(1, weaponId)],
      keys: {}, pressed: {},
      bullets: [], grenades: [], utilities: [], particles: [], texts: [], confetti: [], fireworks: [],
      t: 0, mode: "countdown", modeT: 0, lastBeep: -1,
      timer: ROUND_TIME,
      arena: cloneArena(arenaIdx),
      theme: ARENA_THEMES[themeIdx],
      utilSpawnT: 4,
      slowMo: 0,
      ended: false,
      endMsg: "",
      endWinner: -1,
      hudTick: 0,
      touchMove: [
        { left: false, right: false, down: false, ax: 0, ay: 0 },
        { left: false, right: false, down: false, ax: 0, ay: 0 },
      ],
      touchAim: [null, null],
      touchAimActive: [false, false],
    };
    S.arena.plats.forEach((p) => { if (p.hp > 0) p._breakable = true; });

    const grenadeSidesSwapped = () => weaponId === "grenade" && roundInLevel % 2 === 0;

    const placePlayers = () => {
      const swap = grenadeSidesSwapped();
      const upperPlats = S.arena.plats.filter((p) => !p.wall && p.y < CY - 30);
      const lowerPlats = S.arena.plats.filter((p) => !p.wall && p.y > CY + 30);
      const up = upperPlats[Math.floor(Math.random() * upperPlats.length)] || { x: CX - 80, y: CY - 100, w: 80 };
      const lo = lowerPlats[Math.floor(Math.random() * lowerPlats.length)] || { x: CX + 80, y: CY + 100, w: 80 };
      const slots = [
        { id: 0, upper: !swap, plat: !swap ? up : lo },
        { id: 1, upper: swap, plat: swap ? up : lo },
      ];
      slots.forEach(({ id, upper, plat }) => {
        Object.assign(S.players[id], makePlayer(id, weaponId, upper));
        S.players[id].x = plat.x + plat.w * (id === 0 ? 0.3 : 0.7);
        S.players[id].y = plat.y - 20;
      });
      S.players[0].facing = S.players[1].x > S.players[0].x ? 1 : -1;
      S.players[1].facing = S.players[0].x > S.players[1].x ? 1 : -1;
      S.players[0].aim = S.players[0].facing > 0 ? 0.2 : Math.PI - 0.2;
      S.players[1].aim = S.players[1].facing > 0 ? 0.2 : Math.PI - 0.2;
    };
    placePlayers();

    const down = (e) => {
      if (ALL_KEYS.includes(e.code)) e.preventDefault();
      if (!S.keys[e.code]) S.pressed[e.code] = true;
      S.keys[e.code] = true;
    };
    const upKey = (e) => { S.keys[e.code] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", upKey);
    stateRef.current.setKey = (code, isDown) => {
      if (isDown && !S.keys[code]) S.pressed[code] = true;
      S.keys[code] = isDown;
    };
    stateRef.current.setTouchMove = (id, st) => {
      S.touchMove[id] = st;
    };
    stateRef.current.aimFromScreen = (id, clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = ((clientX - rect.left) / rect.width) * CW;
      const y = ((clientY - rect.top) / rect.height) * CH;
      const p = S.players[id];
      if (!p) return;
      S.touchAim[id] = Math.atan2(y - (p.y - pFootOff(p)), x - p.x);
      S.touchAimActive[id] = true;
    };
    stateRef.current.endTouchAim = (id) => {
      S.touchAimActive[id] = false;
    };

    const spark = (x, y, color, n = 8, spd = 220) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = spd * (0.4 + Math.random() * 0.8);
        S.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.4 + Math.random() * 0.3, max: 0.55, color, r: 2 + Math.random() * 3, glow: true });
      }
    };
    const worldText = (x, y, str, color) => S.texts.push({ x, y, vy: -60, life: 1.1, max: 1.1, str, color });

    const insideArena = (x, y, pad = 16) => len(x - CX, y - CY) < ARENA_R - pad;
    const pushIntoArena = (ent, pad = 16) => {
      const dx = ent.x - CX, dy = ent.y - CY;
      const d = len(dx, dy);
      const max = ARENA_R - pad;
      if (d > max) {
        const k = max / d;
        ent.x = CX + dx * k;
        ent.y = CY + dy * k;
        const nx = dx / d, ny = dy / d;
        const dot = (ent.vx || 0) * nx + (ent.vy || 0) * ny;
        if (dot > 0) {
          ent.vx = (ent.vx || 0) - nx * dot * 1.4;
          ent.vy = (ent.vy || 0) - ny * dot * 1.4;
        }
        return true;
      }
      return false;
    };

    const feetY = (p) => pFeetY(p);

    const resolvePlayerCollisions = (p, subDt) => {
      p.grounded = collidePlats(p, subDt, true);
      if (collideArenaWall(p)) p.grounded = true;
      enforceHalf(p);
      if (!p.grounded && collidePlats(p, 0, true)) p.grounded = true;
      if (!p.grounded && collideArenaWall(p)) p.grounded = true;
      if (p.grounded && onArenaFloor(p)) alignArenaFloor(p);
    };

    const collideArenaWall = (p) => {
      const pad = 18;
      const dx = p.x - CX, dy = p.y - CY;
      const d = len(dx, dy);
      const max = ARENA_R - pad;
      if (d > max) {
        const nx = dx / d, ny = dy / d;
        p.x = CX + nx * max;
        p.y = CY + ny * max;
        const dot = p.vx * nx + p.vy * ny;
        if (dot > 0) {
          p.vx -= nx * dot * 1.05;
          p.vy -= ny * dot * 1.05;
        }
      }
      if (p.vy < 0) return false;
      const fdx = p.x - CX;
      const fdy = feetY(p) - CY;
      const fd = len(fdx, fdy);
      if (fd < ARENA_R - 14) return false;
      const fny = fdy / fd;
      if (p.upper && fny < -0.35) {
        if (p.vy > 0) p.vy = 0;
        return true;
      }
      if (!p.upper && fny > 0.35) {
        if (p.vy > 0) p.vy = 0;
        return true;
      }
      return false;
    };

    const onArenaFloor = (p) => len(p.x - CX, feetY(p) - CY) >= ARENA_R - 16;

    const alignArenaFloor = (p) => {
      const footOff = pFootOff(p);
      const dx = p.x - CX;
      const feetR = ARENA_R - 6;
      if (Math.abs(dx) >= feetR - 2) return false;
      const dySq = feetR * feetR - dx * dx;
      if (dySq <= 0) return false;
      if (!p.upper) {
        const fy = CY + Math.sqrt(dySq);
        if (fy < CY + MID_GAP + 4) return false;
        p.x = CX + dx;
        p.y = fy - footOff;
        return true;
      }
      const fy = CY - Math.sqrt(dySq);
      if (fy > CY - MID_GAP - 4) return false;
      p.x = CX + dx;
      p.y = fy - footOff;
      return true;
    };

    const enforceHalf = (p) => {
      const feet = pFeetY(p);
      const footOff = pFootOff(p);
      if (p.upper) {
        if (feet > CY - MID_GAP) {
          p.y = CY - MID_GAP - footOff;
          if (p.vy > 0) p.vy = -Math.abs(p.vy) * 0.35;
          if (Math.abs(p.vy) < 120) p.grounded = true;
        }
      } else if (feet < CY + MID_GAP) {
        p.y = CY + MID_GAP - footOff;
        if (p.vy < 0) p.vy = 0;
      }
    };

    const platTop = (pl, x) => pl.y + (x - pl.x) * pl.ramp;

    const collidePlats = (ent, dt, isPlayer = false) => {
      let grounded = false;
      for (const pl of S.arena.plats) {
        if (pl._breakable && pl.hp <= 0) continue;
        if (pl.wall) {
          const left = pl.x, right = pl.x + pl.w, top = pl.y, bot = pl.y + pl.h;
          if (ent.x > left - 10 && ent.x < right + 10 && ent.y > top - 6 && ent.y < bot + 6) {
            const mid = (left + right) / 2;
            if (ent.x < mid) { ent.x = left - 10; if (ent.vx > 0) ent.vx *= -0.15; }
            else { ent.x = right + 10; if (ent.vx < 0) ent.vx *= -0.15; }
          }
          continue;
        }
        const footOff = isPlayer ? pFootOff(ent) : 4;
        const top = platTop(pl, ent.x);
        if (!(ent.x > pl.x - 4 && ent.x < pl.x + pl.w + 4)) continue;
        const feet = ent.y + footOff;
        const prevFeet = feet - (ent.vy || 0) * dt;
        if (ent.vy >= 0 && prevFeet <= top + 4 && feet >= top - 2 && ent.y < top + 30) {
          ent.y = top - footOff;
          ent.vy = 0;
          grounded = true;
        }
      }
      return grounded;
    };

    const damagePlat = (pl, dmg) => {
      if (!pl._breakable) return;
      pl.hp -= dmg;
      if (pl.hp <= 0) {
        spark(pl.x + pl.w / 2, pl.y + pl.h / 2, "#ffd27a", 14, 280);
        worldText(pl.x + pl.w / 2, pl.y - 20, "COVER DOWN!", "#ffd27a");
      }
    };

    const segmentCircleHit = (x0, y0, x1, y1, cx, cy, r) => {
      const dx = x1 - x0, dy = y1 - y0;
      const segLen2 = dx * dx + dy * dy;
      if (segLen2 < 0.01) {
        if (len(x0 - cx, y0 - cy) >= r) return null;
        return { x: x0, y: y0 };
      }
      let t = ((cx - x0) * dx + (cy - y0) * dy) / segLen2;
      t = clamp(t, 0, 1);
      const nx = x0 + dx * t, ny = y0 + dy * t;
      if (len(nx - cx, ny - cy) >= r) return null;
      return { x: nx, y: ny };
    };

    const bulletPlayerHit = (b, x0, y0, x1, y1) => {
      for (const p of S.players) {
        if (p.id === b.owner || !p.alive) continue;
        const hx = p.x;
        const hy = pTorsoY(p);
        const headY = pHeadY(p);
        const bodyR = (p.crouch ? 16 : 18) + b.r;
        const headR = 11 + b.r;
        if (b.headshot) {
          const headHit = segmentCircleHit(x0, y0, x1, y1, hx, headY, headR);
          if (headHit) return { p, headshot: true, x: headHit.x, y: headHit.y };
        }
        const bodyHit = segmentCircleHit(x0, y0, x1, y1, hx, hy, bodyR);
        if (bodyHit) return { p, headshot: false, x: bodyHit.x, y: bodyHit.y };
      }
      return null;
    };

    const applyKnockback = (p, knockDir, knock) => {
      const gMul = p.grounded ? 1 : 1.2;
      const vMul = p.grounded ? 0.5 : 0.72;
      p.vx += Math.cos(knockDir) * knock * gMul;
      p.vy += Math.sin(knockDir) * knock * vMul - (p.grounded ? 36 : 18);
      p.grounded = false;
    };

    const applyDamage = (p, dmg, knockDir, knock, headshot = false) => {
      if (!p.alive || p.invuln > 0) return;
      if (p.powers.shield > 0) dmg *= 0.35;
      if (p.powers.armor > 0) dmg *= 0.7;
      p.hp -= dmg;
      applyKnockback(p, knockDir, knock);
      SFX.hit();
      spark(p.x, pTorsoY(p), p.neon, 10, 260);
      if (headshot) {
        SFX.headshot();
        worldText(p.x, p.y - 70, "HEADSHOT!", "#ffe97a");
        p.hp = 0;
      }
      if (p.hp <= 0) {
        p.hp = 0;
        p.alive = false;
        spark(p.x, pTorsoY(p), "#fff", 22, 360);
        worldText(p.x, p.y - 90, "ELIMINATED!", "#ff6b8a");
      }
    };

    const spawnUtil = () => {
      const angle = (Math.random() - 0.5) * 1.2;
      const r = 40 + Math.random() * 70;
      const x = CX + Math.cos(angle) * r * (Math.random() > 0.5 ? 1 : -1);
      const y = CY + (Math.random() - 0.5) * 36;
      if (!insideArena(x, y, 40)) return;
      const def = UTIL_DEFS[Math.floor(Math.random() * UTIL_DEFS.length)];
      S.utilities.push({ ...def, x, y, life: 10, bob: 0 });
    };

    const giveUtil = (p, u) => {
      SFX.pickup();
      worldText(p.x, p.y - 60, u.name.toUpperCase(), u.color);
      spark(u.x, u.y, u.color, 12, 200);
      if (u.id === "health") { p.hp = Math.min(MAX_HP, p.hp + 25); return; }
      if (u.id === "freeze") {
        const foe = S.players[1 - p.id];
        foe.freezeT = 3.2;
        worldText(foe.x, foe.y - 50, "FROZEN!", "#a8e6ff");
        return;
      }
      p.powers[u.id] = u.dur;
    };

    const fireWeapon = (p) => {
      const st = WEAPON_STATS[p.weapon];
      if (p.fireCD > 0 || p.reloadT > 0 || !p.alive) return;
      const inf = st.infinite || p.powers.infammo > 0;
      if (!inf && p.ammo <= 0) {
        p.reloadT = st.reload * (p.powers.reload > 0 ? 0.45 : 1);
        SFX.reload();
        return;
      }
      const dmgMul = p.powers.damage > 0 ? 2 : 1;
      const ricExtra = p.powers.ricochet > 0 ? 2 : 0;
      let aim = p.aim;
      if (st.recoilGrow) aim += (Math.random() - 0.5) * p.recoil;
      SFX.shoot(p.weapon);

      if (st.isGrenade) {
        const spd = st.speed * (0.88 + Math.random() * 0.18);
        const ang = aim;
        const lobBoost = Math.sin(ang) < -0.2 ? 120 : 45;
        const sx = p.x + Math.cos(ang) * 42;
        const sy = p.y - pFootOff(p) + Math.sin(ang) * 24;
        S.grenades.push({
          x: sx, y: sy,
          spawnX: sx, spawnY: sy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - lobBoost,
          owner: p.id, fuse: st.fuse, r: 7, hitCD: 0, ownerGrace: 0.45,
          dmg: st.dmg * dmgMul, knock: st.knock, blastR: st.blastR,
        });
        p.fireCD = st.rate;
        return;
      }

      for (let i = 0; i < st.pellets; i++) {
        const spread = (Math.random() - 0.5) * st.spread * 2 + (st.recoilGrow ? p.recoil * (Math.random() - 0.5) : 0);
        const ang = aim + spread;
        S.bullets.push({
          x: p.x + Math.cos(ang) * 20,
          y: p.y - pFootOff(p) + Math.sin(ang) * 14,
          vx: Math.cos(ang) * st.speed,
          vy: Math.sin(ang) * st.speed,
          owner: p.id, dmg: st.dmg * dmgMul, knock: st.knock,
          life: 1.4, r: p.weapon === "sniper" ? 3.5 : 2.5,
          ricochet: (st.ricochet || 0) + ricExtra,
          headshot: !!st.headshot, color: p.neon,
        });
      }
      if (!inf) p.ammo -= 1;
      p.fireCD = st.rate;
      if (st.recoilGrow) p.recoil = Math.min(0.35, p.recoil + st.recoilGrow);
      p.vx -= Math.cos(aim) * (st.knock * 0.015);
      if (!inf && p.ammo <= 0) {
        p.reloadT = st.reload * (p.powers.reload > 0 ? 0.45 : 1);
        SFX.reload();
      }
    };

    const explode = (g) => {
      SFX.explode();
      spark(g.x, g.y, "#ffb85c", 28, 420);
      spark(g.x, g.y, "#ff3b4d", 16, 300);
      worldText(g.x, g.y - 40, "BOOM!", "#ff7a3c");
      S.players.forEach((p) => {
        if (!p.alive) return;
        const d = len(p.x - g.x, pTorsoY(p) - g.y);
        if (d >= g.blastR) return;
        const falloff = Math.max(0, 1 - d / g.blastR);
        const ang = Math.atan2(pTorsoY(p) - g.y, p.x - g.x);
        const dmg = g.dmg * falloff;
        if (dmg >= 2) {
          applyDamage(p, dmg, ang, g.knock * falloff);
          if (falloff > 0.55) worldText(p.x, p.y - 65, "DIRECT HIT!", "#ff7a3c");
          else if (falloff > 0.25) worldText(p.x, p.y - 65, "SHRAPNEL!", "#ffb85c");
        }
        if (d < g.blastR * 0.9) {
          const push = (1 - d / g.blastR) * 340;
          applyKnockback(p, ang, push * 0.85);
        }
      });
      S.arena.plats.forEach((pl) => {
        if (!pl._breakable || pl.hp <= 0) return;
        const px = pl.x + pl.w / 2, py = pl.y + pl.h / 2;
        if (len(px - g.x, py - g.y) < g.blastR) damagePlat(pl, 40);
      });
    };

    const pushHud = (force) => {
      S.hudTick += 1;
      if (!force && S.hudTick % 4 !== 0) return;
      setHud({
        timer: Math.max(0, Math.ceil(S.timer)),
        weapon: WEAPON_META[weaponId],
        weaponId,
        levelNum: L.mode === "session" ? weaponIdx + 1 : WEAPON_IDS.indexOf(weaponId) + 1,
        roundInLevel,
        score: [...score],
        sessionWins: [...sessionWins],
        mode: L.mode,
        p: S.players.map((p) => ({
          hp: Math.max(0, Math.round(p.hp)),
          ammo: p.ammo,
          mag: WEAPON_STATS[p.weapon].mag,
          reloadT: p.reloadT,
          fireCD: p.fireCD,
          powers: { ...p.powers },
          alive: p.alive,
          neon: p.neon,
        })),
        arena: S.arena.name,
        phase: S.mode,
        endMsg: S.endMsg,
        endWinner: S.endWinner,
      });
    };

    const endRound = (winner, reason) => {
      if (S.ended) return;
      S.ended = true;
      S.mode = "roundEnd";
      S.modeT = 0;
      S.endWinner = winner;
      S.endMsg = reason;
      S.slowMo = 1.2;
      if (winner >= 0) {
        score[winner] += 1;
        sessionWins[winner] += 1;
        SFX.win();
        for (let i = 0; i < 60; i++) {
          S.confetti.push({
            x: CW * Math.random(), y: -20 - Math.random() * 80,
            vx: (Math.random() - 0.5) * 120, vy: 80 + Math.random() * 160,
            life: 2.5, color: Math.random() > 0.5 ? S.players[winner].neon : "#ffe97a",
            w: 4 + Math.random() * 5, h: 6 + Math.random() * 8, rot: Math.random() * 6,
          });
        }
        for (let i = 0; i < 5; i++) {
          S.fireworks.push({ x: 120 + Math.random() * (CW - 240), y: 80 + Math.random() * 120, t: -i * 0.25, color: S.players[winner].neon });
        }
      } else SFX.draw();
      pushHud(true);
    };

    const resetRoundState = () => {
      S.arena = cloneArena(arenaIdx);
      S.theme = ARENA_THEMES[themeIdx];
      S.arena.plats.forEach((p) => { if (p.hp > 0) p._breakable = true; });
      S.bullets = []; S.grenades = []; S.utilities = []; S.particles = []; S.texts = [];
      S.confetti = []; S.fireworks = [];
      S.timer = ROUND_TIME;
      S.ended = false; S.endMsg = ""; S.endWinner = -1;
      S.mode = "countdown"; S.modeT = 0; S.lastBeep = -1; S.slowMo = 0;
      S.utilSpawnT = 4;
      placePlayers();
      pushHud(true);
    };

    const nextAfterRound = () => {
      if (S.endWinner < 0) {
        arenaIdx = (arenaIdx + 1) % ARENAS.length;
        themeIdx = (themeIdx + 1) % ARENA_THEMES.length;
        resetRoundState();
        return;
      }
      if (L.mode === "quick") {
        if (score[0] >= 2 || score[1] >= 2) {
          setResult({ mode: "quick", winner: score[0] >= 2 ? 1 : 2, score, weapon: WEAPON_META[weaponId] });
          setPhase("matchEnd");
          return;
        }
        roundInLevel += 1;
      } else {
        if (roundInLevel >= 3) {
          if (weaponIdx >= WEAPON_IDS.length - 1) {
            const w = sessionWins[0] === sessionWins[1] ? 0 : (sessionWins[0] > sessionWins[1] ? 1 : 2);
            setResult({ mode: "session", winner: w, sessionWins: [...sessionWins], score: [...sessionWins] });
            setPhase("matchEnd");
            return;
          }
          weaponIdx += 1;
          roundInLevel = 1;
          weaponId = WEAPON_IDS[weaponIdx];
        } else roundInLevel += 1;
      }
      arenaIdx = (arenaIdx + 1) % ARENAS.length;
      themeIdx = (themeIdx + 1) % ARENA_THEMES.length;
      stateRef.current.launch = {
        ...L, weaponId, weaponIdx, roundInLevel, score: [...score], sessionWins: [...sessionWins], arenaIdx, themeIdx,
      };
      resetRoundState();
    };

    const updatePlayer = (p, dt) => {
      const k = p.id === 0 ? KEYS.p1 : KEYS.p2;
      const st = WEAPON_STATS[p.weapon];
      if (!p.alive) {
        p.vy += GRAV * dt; p.y += p.vy * dt;
        pushIntoArena(p, 18); enforceHalf(p);
        return;
      }
      Object.keys(p.powers).forEach((key) => {
        p.powers[key] -= dt;
        if (p.powers[key] <= 0) delete p.powers[key];
      });
      if (p.invuln > 0) p.invuln -= dt;
      if (p.freezeT > 0) p.freezeT -= dt;
      if (p.fireCD > 0) p.fireCD -= dt;
      if (p.reloadT > 0) {
        p.reloadT -= dt;
        if (p.reloadT <= 0) { p.ammo = st.mag; p.recoil = 0; }
      }
      if (!st.auto || !S.keys[k.fire]) p.recoil = Math.max(0, p.recoil - dt * 0.25);

      const frozen = p.freezeT > 0;
      const can = S.mode === "fight" && !frozen;
      const speedMul = p.powers.speed > 0 ? 1.45 : 1;
      const jumpMul = p.powers.jump > 0 ? 1.35 : 1;
      const tm = S.touchMove[p.id];
      p.crouch = can && (S.keys[k.down] || !!tm?.down);

      if (can) {
        if (S.pressed[k.jump] && !p.crouch) p.jumpBuf = JUMP_BUFFER;
        if (!S.keys[k.jump] && p.vy < -90) p.vy *= 0.52;

        let move = 0;
        if (S.keys[k.left] || tm?.left) move -= 1;
        if (S.keys[k.right] || tm?.right) move += 1;
        const onGround = p.grounded || p.groundT > 0;
        const targetVx = move * MAX_RUN * speedMul;
        const accel = onGround ? GROUND_ACCEL : AIR_ACCEL;
        if (move !== 0) {
          p.vx += (targetVx - p.vx) * Math.min(1, accel * dt);
        } else if (onGround) {
          p.vx *= Math.max(0, 1 - GROUND_FRICTION * dt);
        } else {
          p.vx *= Math.max(0, 1 - AIR_DRAG * dt);
        }

        if (S.touchAim[p.id] != null) {
          p.aim = S.touchAim[p.id];
        } else if (Math.abs(tm?.ax || 0) > 0.28 || Math.abs(tm?.ay || 0) > 0.28) {
          p.aim = Math.atan2(tm.ay, tm.ax);
        } else {
          if (S.keys[k.aimUp]) p.aim -= 3.2 * dt;
          if (S.keys[k.aimDn]) p.aim += 3.2 * dt;
        }
        if (p.aim > Math.PI) p.aim -= Math.PI * 2;
        if (p.aim < -Math.PI) p.aim += Math.PI * 2;
        p.facing = Math.cos(p.aim) >= 0 ? 1 : -1;
        if (S.keys[k.fire]) {
          if (st.auto) fireWeapon(p);
          else if (S.pressed[k.fire]) fireWeapon(p);
        }
        if (S.pressed[k.reload] && !st.infinite && !(p.powers.infammo > 0) && p.reloadT <= 0 && p.ammo < st.mag) {
          p.reloadT = st.reload * (p.powers.reload > 0 ? 0.45 : 1);
          SFX.reload();
        }
      }

      p.jumpBuf = Math.max(0, p.jumpBuf - dt);
      p.vx = clamp(p.vx, -420, 420);

      let rem = dt;
      while (rem > 0) {
        const subDt = Math.min(PHYS_STEP, rem);
        rem -= subDt;
        p.vy += GRAV * subDt;
        p.x += p.vx * subDt;
        p.y += p.vy * subDt;
        resolvePlayerCollisions(p, subDt);
        if (p.jumpBuf > 0 && p.grounded) {
          p.vy = JUMP * jumpMul;
          p.grounded = false;
          p.groundT = 0;
          p.jumpBuf = 0;
          SFX.jump();
        }
      }

      if (p.grounded) p.groundT = 0.12;
      else p.groundT = Math.max(0, p.groundT - dt);

      S.utilities = S.utilities.filter((u) => {
        if (len(u.x - p.x, u.y - pTorsoY(p)) < 28) { giveUtil(p, u); return false; }
        return true;
      });
    };

    const updateBullets = (dt) => {
      S.bullets = S.bullets.filter((b) => {
        b.life -= dt;
        if (b.life <= 0) return false;
        const spd = len(b.vx, b.vy);
        const steps = Math.max(4, Math.ceil(spd * dt / 10));
        for (let s = 0; s < steps; s++) {
          const step = dt / steps;
          const px = b.x, py = b.y;
          b.x += b.vx * step;
          b.y += b.vy * step;

          const playerHit = bulletPlayerHit(b, px, py, b.x, b.y);
          if (playerHit) {
            b.x = playerHit.x;
            b.y = playerHit.y;
            applyDamage(
              playerHit.p, b.dmg, Math.atan2(b.vy, b.vx), b.knock, playerHit.headshot,
            );
            spark(b.x, b.y, playerHit.headshot ? "#ffe97a" : playerHit.p.neon, playerHit.headshot ? 14 : 8, playerHit.headshot ? 300 : 220);
            return false;
          }

          const dx = b.x - CX, dy = b.y - CY;
          const d = len(dx, dy);
          if (d > ARENA_R - 6) {
            if (b.ricochet > 0) {
              const nx = dx / d, ny = dy / d;
              const dot = b.vx * nx + b.vy * ny;
              b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny;
              b.ricochet -= 1;
              b.x = CX + nx * (ARENA_R - 8); b.y = CY + ny * (ARENA_R - 8);
              spark(b.x, b.y, "#fff", 4, 140);
            } else return false;
          }
          for (const pl of S.arena.plats) {
            if (pl._breakable && pl.hp <= 0) continue;
            if (pl.wall) {
              if (b.x > pl.x && b.x < pl.x + pl.w && b.y > pl.y && b.y < pl.y + pl.h) {
                if (pl._breakable) damagePlat(pl, b.dmg * 0.8);
                if (b.ricochet > 0) { b.vx *= -1; b.ricochet -= 1; spark(b.x, b.y, "#ffd27a", 5, 160); }
                else return false;
              }
            } else {
              const top = platTop(pl, b.x);
              if (b.x > pl.x && b.x < pl.x + pl.w && b.y > top - 4 && b.y < top + pl.h + 2) {
                if (pl._breakable) damagePlat(pl, b.dmg);
                if (b.ricochet > 0) { b.vy *= -1; b.ricochet -= 1; b.y = top - 5; spark(b.x, b.y, "#ffd27a", 5, 160); }
                else return false;
              }
            }
          }
        }
        return true;
      });
    };

    const isNeutralMidPlat = (pl) => !pl.wall && Math.abs((pl.y + pl.h * 0.5) - CY) < 26;

    const bumpPlayerWithGrenade = (g, p) => {
      if (!p.alive) return;
      const px = p.x, py = pTorsoY(p);
      const dist = len(g.x - px, g.y - py);
      const hitR = g.r + (p.crouch ? 14 : 18);
      const maxDist = hitR + 6;
      if (dist >= maxDist) return;
      const ownReturn = g.owner === p.id;
      if (ownReturn) {
        if ((g.ownerGrace || 0) > 0) return;
        if (len(g.x - g.spawnX, g.y - g.spawnY) < 55) return;
        const toG = Math.atan2(g.y - py, g.x - px);
        const approaching = (g.vx - p.vx) * Math.cos(toG) + (g.vy - p.vy) * Math.sin(toG) > 0;
        if (!approaching) return;
      }
      const ang = Math.atan2(py - g.y, px - g.x);
      const proximity = Math.max(0, 1 - dist / maxDist);
      const knock = ownReturn ? 720 + proximity * 180 : 240 + proximity * 80;
      p.vx += Math.cos(ang) * knock;
      p.vy += Math.sin(ang) * knock * (ownReturn ? 0.85 : 0.6) - (ownReturn ? 220 : 90) * proximity;
      p.grounded = false;
      g.vx = Math.cos(ang) * (ownReturn ? 340 : 260) - g.vx * 0.35;
      g.vy = Math.sin(ang) * (ownReturn ? 300 : 220) - g.vy * 0.35;
      g.x -= Math.cos(ang) * 12;
      g.y -= Math.sin(ang) * 12;
      g.hitCD = ownReturn ? 0.22 : 0.18;
      spark(g.x, g.y, ownReturn ? "#ffe97a" : p.neon, ownReturn ? 16 : 8, ownReturn ? 360 : 220);
      if (ownReturn) worldText(p.x, p.y - 55, "GRENADE BOUNCE!", "#ffe97a");
      SFX.hit();
    };

    const updateGrenades = (dt) => {
      S.grenades = S.grenades.filter((g) => {
        g.fuse -= dt;
        if (g.hitCD > 0) g.hitCD -= dt;
        if (g.ownerGrace > 0) g.ownerGrace -= dt;
        g.vy += GRAV * 0.76 * dt;
        g.x += g.vx * dt; g.y += g.vy * dt;
        const dx = g.x - CX, dy = g.y - CY;
        const d = len(dx, dy);
        if (d > ARENA_R - 10) {
          const nx = dx / d, ny = dy / d;
          const dot = g.vx * nx + g.vy * ny;
          g.vx = (g.vx - 2 * dot * nx) * 0.72;
          g.vy = (g.vy - 2 * dot * ny) * 0.72;
          g.x = CX + nx * (ARENA_R - 12); g.y = CY + ny * (ARENA_R - 12);
        }
        for (const pl of S.arena.plats) {
          if (pl._breakable && pl.hp <= 0) continue;
          if (isNeutralMidPlat(pl) && g.vy < 0) continue;
          if (pl.wall) {
            if (g.x > pl.x - 4 && g.x < pl.x + pl.w + 4 && g.y > pl.y - 4 && g.y < pl.y + pl.h + 4) {
              g.vx *= -0.7; g.x += g.vx * dt * 2;
            }
          } else {
            const top = platTop(pl, g.x);
            if (g.x > pl.x && g.x < pl.x + pl.w && g.y > top - 8 && g.y < top + 10 && g.vy > 0) {
              g.y = top - 8; g.vy *= -0.65; g.vx *= 0.85;
            }
          }
        }
        if (g.hitCD <= 0) {
          S.players.forEach((p) => bumpPlayerWithGrenade(g, p));
        }
        if (g.fuse <= 0) { explode(g); return false; }
        return true;
      });
    };

    const drawBackground = () => {
      const g = ctx.createRadialGradient(CX, CY, 40, CX, CY, ARENA_R + 80);
      g.addColorStop(0, S.theme.bot);
      g.addColorStop(0.55, S.theme.top);
      g.addColorStop(1, "#05070c");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CW, CH);
      for (let i = 0; i < 18; i++) {
        const a = S.t * (0.15 + (i % 5) * 0.03) + i * 1.7;
        const rr = ARENA_R + 40 + (i % 4) * 28;
        ctx.fillStyle = `rgba(255,255,255,${0.03 + (i % 3) * 0.02})`;
        ctx.beginPath();
        ctx.arc(CX + Math.cos(a) * rr, CY + Math.sin(a * 0.8) * rr * 0.55, 2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.save();
      ctx.beginPath(); ctx.arc(CX, CY, ARENA_R, 0, Math.PI * 2); ctx.clip();
      const ag = ctx.createLinearGradient(CX, CY - ARENA_R, CX, CY + ARENA_R);
      ag.addColorStop(0, "rgba(58,160,255,0.08)");
      ag.addColorStop(0.5, "rgba(0,0,0,0.15)");
      ag.addColorStop(1, "rgba(255,59,77,0.08)");
      ctx.fillStyle = ag;
      ctx.fillRect(CX - ARENA_R, CY - ARENA_R, ARENA_R * 2, ARENA_R * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1;
      for (let x = CX - ARENA_R; x < CX + ARENA_R; x += 36) {
        ctx.beginPath(); ctx.moveTo(x, CY - ARENA_R); ctx.lineTo(x, CY + ARENA_R); ctx.stroke();
      }
      for (let y = CY - ARENA_R; y < CY + ARENA_R; y += 36) {
        ctx.beginPath(); ctx.moveTo(CX - ARENA_R, y); ctx.lineTo(CX + ARENA_R, y); ctx.stroke();
      }
      ctx.restore();
      ctx.save();
      ctx.shadowColor = S.theme.rim; ctx.shadowBlur = 18;
      ctx.strokeStyle = S.theme.rim; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(CX, CY, ARENA_R, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(CX, CY, ARENA_R - 5, 0, Math.PI * 2); ctx.stroke();
      ctx.save();
      ctx.shadowColor = "#ffe97a"; ctx.shadowBlur = 10;
      ctx.strokeStyle = "rgba(255,233,122,0.85)"; ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(CX - ARENA_R + 4, CY); ctx.lineTo(CX + ARENA_R - 4, CY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.fillStyle = "rgba(58,160,255,0.55)";
      ctx.font = "bold 11px monospace"; ctx.textAlign = "left";
      ctx.fillText("P1 ZONE", CX - ARENA_R + 18, CY - 10);
      ctx.fillStyle = "rgba(255,59,77,0.55)"; ctx.textAlign = "right";
      ctx.fillText("P2 ZONE", CX + ARENA_R - 18, CY + 18);
    };

    const drawPlats = () => {
      for (const pl of S.arena.plats) {
        if (pl._breakable && pl.hp <= 0) continue;
        ctx.save();
        if (pl.wall) {
          ctx.fillStyle = pl._breakable ? "rgba(255,210,122,0.35)" : "rgba(180,200,230,0.25)";
          ctx.strokeStyle = pl._breakable ? "#ffd27a" : "rgba(200,220,255,0.5)";
          ctx.lineWidth = 2;
          ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
          ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
          if (pl._breakable) {
            ctx.fillStyle = "rgba(255,100,80,0.5)";
            ctx.fillRect(pl.x, pl.y, pl.w * clamp(pl.hp / 50, 0, 1), 3);
          }
        } else {
          const y0 = platTop(pl, pl.x), y1 = platTop(pl, pl.x + pl.w);
          ctx.beginPath();
          ctx.moveTo(pl.x, y0); ctx.lineTo(pl.x + pl.w, y1);
          ctx.lineTo(pl.x + pl.w, y1 + pl.h); ctx.lineTo(pl.x, y0 + pl.h);
          ctx.closePath();
          ctx.fillStyle = pl._breakable ? "rgba(255,180,100,0.55)" : "rgba(120,160,220,0.45)";
          ctx.fill();
          ctx.strokeStyle = pl._breakable ? "#ffb85c" : S.theme.acc;
          ctx.lineWidth = 2; ctx.shadowColor = S.theme.acc; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.moveTo(pl.x, y0); ctx.lineTo(pl.x + pl.w, y1); ctx.stroke();
        }
        ctx.restore();
      }
    };

    const drawStickman = (p) => {
      const x = p.x, y = p.y, crouch = p.crouch;
      ctx.save();
      if (!p.alive) ctx.globalAlpha = 0.35;
      if (p.invuln > 0 && Math.floor(S.t * 20) % 2 === 0) ctx.globalAlpha = 0.5;
      if (p.powers.shield > 0) {
        ctx.save();
        ctx.strokeStyle = "#7cc8ff"; ctx.lineWidth = 2;
        ctx.shadowColor = "#7cc8ff"; ctx.shadowBlur = 12; ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.arc(x, y - 18, 30, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      const hipY = y - (crouch ? 6 : 4);
      const shY = y - (crouch ? 22 : 28);
      const ang = p.aim;
      const handX = x + Math.cos(ang) * 22;
      const handY = shY + Math.sin(ang) * 22;
      if (p.alive && WEAPON_STATS[p.weapon].laser && S.mode === "fight") {
        ctx.save();
        ctx.strokeStyle = "rgba(255,80,80,0.55)"; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.moveTo(handX, handY);
        ctx.lineTo(handX + Math.cos(ang) * 420, handY + Math.sin(ang) * 420); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
      }
      ctx.strokeStyle = "#e8eef5"; ctx.lineWidth = 3.5; ctx.lineCap = "round";
      ctx.shadowColor = p.neon; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(x - 8, y + (crouch ? 8 : 18)); ctx.lineTo(x, hipY); ctx.lineTo(x + 8, y + (crouch ? 8 : 18));
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, hipY); ctx.lineTo(x, shY); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, shY - 11, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = p.neon; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, shY - 11, 9, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.strokeStyle = "#e8eef5"; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(x, shY); ctx.lineTo(handX, handY); ctx.stroke();
      ctx.save();
      ctx.translate(handX, handY); ctx.rotate(ang);
      ctx.fillStyle = p.neon; ctx.shadowColor = p.neon; ctx.shadowBlur = 10;
      const w = p.weapon;
      if (w === "shotgun") { ctx.fillRect(0, -3, 26, 6); ctx.fillRect(18, -5, 10, 3); }
      else if (w === "mg") { ctx.fillRect(0, -3, 28, 5); ctx.fillRect(8, 2, 10, 4); }
      else if (w === "sniper") { ctx.fillRect(0, -2.5, 34, 5); ctx.fillRect(10, -6, 8, 3); }
      else if (w === "grenade") { ctx.beginPath(); ctx.arc(8, 0, 6, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(0, -2.5, 18, 5);
      ctx.restore();
      if (p.freezeT > 0) {
        ctx.fillStyle = "rgba(168,230,255,0.25)";
        ctx.beginPath(); ctx.arc(x, y - 16, 26, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0; ctx.fillStyle = p.neon;
      ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
      ctx.fillText(`P${p.id + 1}`, x, y - 58);
      ctx.restore();
    };

    let raf, last = performance.now();
    pushHud(true);

    const loop = (now) => {
      let dt = Math.min((now - last) / 1000, 0.033);
      last = now;
      if (S.slowMo > 0) { S.slowMo -= dt; dt *= 0.35; }
      S.t += dt;

      if (S.mode === "countdown") {
        S.modeT += dt;
        const n = Math.ceil(3 - S.modeT);
        if (n !== S.lastBeep && n >= 0) { S.lastBeep = n; SFX.beep(n === 0); }
        if (S.modeT >= 3) { S.mode = "fight"; S.modeT = 0; }
      } else if (S.mode === "fight") {
        S.timer -= dt;
        if (Math.floor(S.timer) !== Math.floor(S.timer + dt) && S.timer <= 10 && S.timer > 0) SFX.tick();
        S.players.forEach((p) => updatePlayer(p, dt));
        updateBullets(dt);
        updateGrenades(dt);
        S.utilSpawnT -= dt;
        if (S.utilSpawnT <= 0 && S.utilities.length < 2) {
          spawnUtil();
          S.utilSpawnT = 7 + Math.random() * 5;
        }
        S.utilities = S.utilities.filter((u) => { u.life -= dt; u.bob += dt * 4; return u.life > 0; });
        const alive = S.players.filter((p) => p.alive);
        if (alive.length === 1) endRound(alive[0].id, `P${alive[0].id + 1} WINS THE ROUND`);
        else if (S.timer <= 0) {
          const h0 = S.players[0].hp, h1 = S.players[1].hp;
          if (h0 > h1) endRound(0, "TIME UP - P1 HIGHER HP");
          else if (h1 > h0) endRound(1, "TIME UP - P2 HIGHER HP");
          else endRound(-1, "DRAW - REPLAY ROUND");
        }
      } else if (S.mode === "roundEnd") {
        S.modeT += dt / (S.slowMo > 0 ? 0.35 : 1);
        S.players.forEach((p) => updatePlayer(p, dt * 0.3));
        updateBullets(dt * 0.3);
        if (S.modeT > 2.8) nextAfterRound();
      }

      S.particles = S.particles.filter((pt) => {
        pt.life -= dt; pt.vy += 600 * dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        return pt.life > 0;
      });
      S.texts = S.texts.filter((tx) => { tx.life -= dt; tx.y += tx.vy * dt; tx.vy *= 0.94; return tx.life > 0; });
      S.confetti = S.confetti.filter((c) => {
        c.life -= dt; c.vy += 200 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += dt * 5;
        return c.life > 0 && c.y < CH + 40;
      });
      S.fireworks.forEach((f) => {
        f.t += dt;
        if (f.t > 0 && f.t < dt * 2) spark(f.x, f.y, f.color, 20, 380);
      });

      ctx.clearRect(0, 0, CW, CH);
      drawBackground();
      drawPlats();
      S.utilities.forEach((u) => {
        const yy = u.y + Math.sin(u.bob) * 4;
        ctx.save();
        ctx.shadowColor = u.color; ctx.shadowBlur = 14;
        ctx.fillStyle = u.color;
        ctx.beginPath(); ctx.arc(u.x, yy, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#0a0c12"; ctx.font = "12px monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowBlur = 0;
        ctx.fillText(u.emoji, u.x, yy + 1);
        ctx.restore();
      });
      S.bullets.forEach((b) => {
        ctx.save();
        ctx.shadowColor = b.color; ctx.shadowBlur = 8;
        ctx.fillStyle = b.color;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); ctx.stroke();
        ctx.restore();
      });
      S.grenades.forEach((g) => {
        ctx.save();
        ctx.fillStyle = "#5dff8a"; ctx.shadowColor = "#5dff8a"; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = g.fuse < 0.4 && Math.floor(S.t * 20) % 2 === 0 ? "#ff3b4d" : "#1a2a1a";
        ctx.beginPath(); ctx.arc(g.x, g.y - 3, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      S.players.forEach(drawStickman);
      if (S.players.some((p) => p.alive && p.weapon === "sniper" && S.mode === "fight")) {
        const grd = ctx.createRadialGradient(CX, CY, ARENA_R * 0.35, CX, CY, ARENA_R + 20);
        grd.addColorStop(0, "rgba(0,0,0,0)");
        grd.addColorStop(1, "rgba(0,0,0,0.35)");
        ctx.fillStyle = grd; ctx.fillRect(0, 0, CW, CH);
      }
      S.players.forEach((p) => {
        if (!(p.powers.radar > 0)) return;
        const foe = S.players[1 - p.id];
        ctx.save();
        ctx.strokeStyle = p.neon; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 20); ctx.lineTo(foe.x, foe.y - 20); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = foe.neon;
        ctx.beginPath(); ctx.arc(foe.x, foe.y - 50, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      S.particles.forEach((pt) => {
        ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
        ctx.fillStyle = pt.color;
        if (pt.glow) { ctx.shadowColor = pt.color; ctx.shadowBlur = 8; }
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      });
      S.texts.forEach((tx) => {
        ctx.globalAlpha = clamp(tx.life / tx.max, 0, 1);
        ctx.fillStyle = tx.color; ctx.font = "bold 14px monospace"; ctx.textAlign = "center";
        ctx.fillText(tx.str, tx.x, tx.y); ctx.globalAlpha = 1;
      });
      S.confetti.forEach((c) => {
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
        ctx.fillStyle = c.color; ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); ctx.restore();
      });

      if (S.mode === "countdown") {
        const n = Math.ceil(3 - S.modeT);
        ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(0, 0, CW, CH);
        ctx.save();
        ctx.shadowColor = "#fff"; ctx.shadowBlur = 22;
        ctx.fillStyle = "#fff"; ctx.font = "bold 90px monospace"; ctx.textAlign = "center";
        ctx.fillText(n > 0 ? n : "FIGHT!", CW / 2, CH / 2 + 20);
        ctx.restore();
        ctx.font = "16px monospace"; ctx.fillStyle = WEAPON_META[weaponId].color;
        ctx.fillText(`${WEAPON_META[weaponId].emoji} ${WEAPON_META[weaponId].name}`, CW / 2, CH / 2 + 70);
        ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "13px monospace";
        ctx.fillText(S.arena.name, CW / 2, CH / 2 + 94);
        if (grenadeSidesSwapped()) {
          ctx.fillStyle = "#ffe97a";
          ctx.fillText("SIDES SWAPPED — P1 lower | P2 upper", CW / 2, CH / 2 + 118);
        }
      }
      if (S.mode === "roundEnd") {
        ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, CW, CH);
        ctx.save();
        const col = S.endWinner >= 0 ? S.players[S.endWinner].neon : "#ffe97a";
        ctx.shadowColor = col; ctx.shadowBlur = 22; ctx.fillStyle = col;
        ctx.font = "bold 36px monospace"; ctx.textAlign = "center";
        ctx.fillText(S.endMsg, CW / 2, CH / 2);
        ctx.restore();
        ctx.fillStyle = "#fff"; ctx.font = "14px monospace";
        ctx.fillText(`Score  P1 ${score[0]} - ${score[1]} P2`, CW / 2, CH / 2 + 40);
      }

      S.pressed = {};
      pushHud(false);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", upKey);
      stateRef.current.setTouchMove = null;
      stateRef.current.aimFromScreen = null;
      stateRef.current.endTouchAim = null;
    };
  }, [phase]);

  const wrap = {
    minHeight: "100vh", background: "#07090f", color: "#e8eef5",
    display: "flex", flexDirection: "column", alignItems: "center",
    fontFamily: "monospace", padding: 16, boxSizing: "border-box",
  };
  const neonText = (color) => ({ color, textShadow: `0 0 12px ${color}` });
  const btn = (color) => ({
    cursor: "pointer", padding: "14px 28px", borderRadius: 10, border: `2px solid ${color}`,
    background: `${color}22`, color: "#e8eef5", fontFamily: "monospace", fontWeight: "bold",
    fontSize: 15, boxShadow: `0 0 20px ${color}33`,
  });

  const mobilePlaying = touchUI && phase === "playing";

  const ammoLabel = (p) => {
    const st = WEAPON_STATS[hud.weaponId];
    if (st.isGrenade) return p.fireCD > 0 ? `${E.bomb} ${p.fireCD.toFixed(1)}s` : `${E.bomb} ready`;
    if (st.infinite || p.powers.infammo > 0) return `${E.inf} ammo`;
    if (p.reloadT > 0) return "reloading...";
    return `${Math.max(0, Math.floor(p.ammo))}/${p.mag === Infinity ? E.inf : p.mag}`;
  };

  const powerIcons = {
    speed: E.zap, jump: E.jump, damage: E.sword, shield: E.shield, reload: E.reload,
    armor: E.armor, ricochet: E.rico, radar: E.radar, infammo: E.inf,
  };

  if (phase === "menu" || phase === "matchEnd") {
    return (
      <div style={wrap}>
        <h1 style={{ letterSpacing: 5, margin: "26px 0 2px", fontSize: 34 }}>
          <span style={neonText("#3aa0ff")}>STICKMAN</span>{" "}
          <span style={{ opacity: 0.9 }}>{E.gun}</span>{" "}
          <span style={neonText("#ff3b4d")}>GUNFIGHT</span>
        </h1>
        <p style={{ opacity: 0.65, marginTop: 4, textAlign: "center", maxWidth: 640 }}>
          Circular arena duel | upper vs lower half | 5 weapon levels | utilities | best aim wins
        </p>

        {phase === "matchEnd" && result && (
          <div style={{
            margin: "12px 0 18px", padding: "20px 44px", borderRadius: 12,
            background: result.winner === 1 ? "rgba(58,160,255,0.12)" : result.winner === 2 ? "rgba(255,59,77,0.12)" : "rgba(255,233,122,0.1)",
            border: `2px solid ${result.winner === 1 ? "#3aa0ff" : result.winner === 2 ? "#ff3b4d" : "#ffe97a"}`,
            boxShadow: `0 0 36px ${result.winner === 1 ? "rgba(58,160,255,0.4)" : result.winner === 2 ? "rgba(255,59,77,0.4)" : "rgba(255,233,122,0.3)"}`,
            fontSize: 22, fontWeight: "bold", textAlign: "center",
            animation: "gfPulse 1.4s ease-in-out infinite",
          }}>
            <div style={{ fontSize: 28, letterSpacing: 3, marginBottom: 4 }}>
              {result.winner === 0 ? E.shake : `${E.trophy} ${E.crown} ${E.trophy}`}
            </div>
            {result.winner === 0
              ? "SESSION DRAW — LEGENDARY TIE"
              : `PLAYER ${result.winner} IS THE ${result.mode === "session" ? "SESSION CHAMPION" : "GUNFIGHT CHAMPION"}`}
            <div style={{ fontSize: 13, opacity: 0.75, fontWeight: "normal", marginTop: 8 }}>
              {result.mode === "session"
                ? `Session rounds  P1 ${result.sessionWins[0]} — ${result.sessionWins[1]} P2`
                : `${result.weapon.emoji} ${result.weapon.name}  |  P1 ${result.score[0]} — ${result.score[1]} P2`}
            </div>
            <div style={{ fontSize: 11, opacity: 0.5, fontWeight: "normal", marginTop: 10 }}>
              Play again · switch weapon · or start a new Full Session
            </div>
          </div>
        )}

        <p style={{ marginBottom: 10, opacity: 0.85 }}>Choose your battle mode:</p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={beginQuick} style={{ ...btn("#3aa0ff"), width: 280, textAlign: "left" }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{E.zap} Quick Match</div>
            <div style={{ fontSize: 11, opacity: 0.7, fontWeight: "normal", lineHeight: 1.5 }}>
              Pick one weapon category | best of 3 rounds | first to 2 wins
            </div>
          </button>
          <button onClick={beginSession} style={{ ...btn("#ff3b4d"), width: 280, textAlign: "left" }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{E.crown} Full Session</div>
            <div style={{ fontSize: 11, opacity: 0.7, fontWeight: "normal", lineHeight: 1.5 }}>
              All 5 weapon levels | 3 rounds each | most round wins = champion
            </div>
          </button>
        </div>

        <p style={{ margin: "22px 0 10px", opacity: 0.75, fontSize: 13, letterSpacing: 1 }}>WEAPON LEVELS — tap to play</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", maxWidth: 900 }}>
          {WEAPON_IDS.map((id, i) => {
            const m = WEAPON_META[id];
            return (
              <button key={id} onClick={() => startQuickWith(id)}
                style={{
                  cursor: "pointer", width: 156, padding: 0, borderRadius: 10, overflow: "hidden",
                  border: `2px solid ${m.color}55`, background: "#10141d", color: "#e8eef5",
                  fontFamily: "monospace", transition: "transform .15s, box-shadow .15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 6px 24px ${m.color}44`; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
                <div style={{
                  height: 74, background: `linear-gradient(160deg, ${m.color}33, #0a0e18)`,
                  position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <WeaponDuelPreview />
                  <div style={{ fontSize: 34, filter: `drop-shadow(0 0 10px ${m.color})`, position: "relative", zIndex: 1 }}>{m.emoji}</div>
                  <div style={{
                    position: "absolute", bottom: 8, left: 10, right: 10, height: 3,
                    background: m.color, borderRadius: 2, boxShadow: `0 0 10px ${m.color}`, zIndex: 1,
                  }} />
                </div>
                <div style={{ padding: "8px 6px 2px", fontWeight: "bold", letterSpacing: 0.5, fontSize: 13, color: m.color, textAlign: "center" }}>
                  <span style={{ fontSize: 10, opacity: 0.5, fontWeight: "normal" }}>LVL {i + 1} · </span>{m.name}
                </div>
                <div style={{ padding: "0 8px 10px", fontSize: 9, opacity: 0.55, lineHeight: 1.4, textAlign: "center" }}>{m.desc}</div>
              </button>
            );
          })}
        </div>

        <div style={{
          marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30,
          fontSize: 13, lineHeight: 1.85, background: "#10141d", padding: "16px 28px",
          borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", maxWidth: 720,
        }}>
          <div>
            <b style={neonText("#3aa0ff")}>PLAYER 1 - upper half</b><br />
            A / D - move | W - jump | S - crouch<br />
            Q / E - rotate arm (any direction) | SPACE - fire | R - reload
          </div>
          <div>
            <b style={neonText("#ff3b4d")}>PLAYER 2 - lower half</b><br />
            {E.left} / {E.right} - move | {E.up} - jump | {E.down} - crouch<br />
            O / P - rotate arm (any direction) | ENTER - fire | / - reload
          </div>
        </div>

        <div style={{
          marginTop: 12, fontSize: 12, background: "#10141d", padding: "12px 26px",
          borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", maxWidth: 760, lineHeight: 2, textAlign: "center",
        }}>
          <b>{E.stadium} Arena:</b> circular side-view | horizontal diameter barrier | layouts rotate each round<br />
          <b>{E.gift} Utilities:</b> spawn near the midline - risk it for Health, Speed, Shield, Double Damage & more<br />
          <b>{E.clock} Rounds:</b> 90s timer | most HP wins on timeout | draws replay
        </div>

        <button onClick={() => setMuted((m) => !m)}
          style={{ marginTop: 14, cursor: "pointer", background: "none", border: "1px solid rgba(255,255,255,0.25)", color: "#e8eef5", borderRadius: 6, padding: "5px 14px", fontFamily: "monospace", fontSize: 12 }}>
          {muted ? `${E.mute} sound off` : `${E.sound} sound on`}
        </button>
      </div>
    );
  }

  if (phase === "weaponSelect") {
    return (
      <div style={wrap}>
        <h2 style={{ letterSpacing: 3, marginTop: 28 }}>
          <span style={neonText("#3aa0ff")}>QUICK</span> MATCH - pick a weapon
        </h2>
        <p style={{ opacity: 0.6, marginBottom: 16 }}>Both players use the same category | first to 2 round wins</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", maxWidth: 900 }}>
          {WEAPON_IDS.map((id) => {
            const m = WEAPON_META[id];
            return (
              <button key={id} onClick={() => startQuickWith(id)}
                style={{
                  cursor: "pointer", width: 156, padding: 0, borderRadius: 10, overflow: "hidden",
                  border: `2px solid ${m.color}55`, background: "#10141d", color: "#e8eef5",
                  fontFamily: "monospace", transition: "transform .15s, box-shadow .15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 6px 24px ${m.color}44`; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
                <div style={{
                  height: 74, background: `linear-gradient(160deg, ${m.color}33, #0a0e18)`,
                  position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <WeaponDuelPreview />
                  <div style={{ fontSize: 34, filter: `drop-shadow(0 0 10px ${m.color})`, position: "relative", zIndex: 1 }}>{m.emoji}</div>
                  <div style={{
                    position: "absolute", bottom: 8, left: 10, right: 10, height: 3,
                    background: m.color, borderRadius: 2, boxShadow: `0 0 10px ${m.color}`, zIndex: 1,
                  }} />
                </div>
                <div style={{ padding: "8px 6px 2px", fontWeight: "bold", letterSpacing: 0.5, fontSize: 13, color: m.color }}>{m.name}</div>
                <div style={{ padding: "0 8px 10px", fontSize: 9, opacity: 0.55, lineHeight: 1.4 }}>{m.desc}</div>
              </button>
            );
          })}
        </div>
        <button onClick={() => setPhase("menu")}
          style={{ marginTop: 20, cursor: "pointer", background: "none", border: "1px solid rgba(255,255,255,0.25)", color: "#e8eef5", borderRadius: 6, padding: "6px 16px", fontFamily: "monospace", fontSize: 12 }}>
          {E.left} back to modes
        </button>
      </div>
    );
  }

  // ---- PLAYING ----
  return (
    <div style={wrap}>
      <div style={{
        width: "100%", maxWidth: CW, display: "flex", flexWrap: "wrap", alignItems: "center",
        justifyContent: "space-between", gap: 10, marginBottom: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, opacity: 0.75 }}>
            {hud?.weapon?.emoji} {hud?.weapon?.name}
            {hud?.mode === "session" ? ` · Level ${hud.levelNum}/5` : ""} · Round {hud?.roundInLevel || 1}/3
            {hud?.arena ? ` · ${hud.arena}` : ""}
          </span>
          <button onClick={() => setMuted((m) => !m)}
            style={{ cursor: "pointer", background: "none", border: "1px solid rgba(255,255,255,0.3)", color: "#e8eef5", borderRadius: 6, padding: "4px 10px", fontFamily: "monospace", fontSize: 12 }}>
            {muted ? E.mute : E.sound}
          </button>
          <button onClick={() => { setPhase("menu"); setResult(null); }}
            style={{ cursor: "pointer", background: "none", border: "1px solid rgba(255,255,255,0.3)", color: "#e8eef5", borderRadius: 6, padding: "4px 12px", fontFamily: "monospace", fontSize: 12 }}>
            quit to menu
          </button>
        </div>
        {hud && (
          <div style={{ display: "flex", gap: 16, alignItems: "center", fontWeight: "bold", fontSize: 15 }}>
            <span style={neonText("#3aa0ff")}>Player 1: {hud.mode === "session" ? hud.sessionWins[0] : hud.score[0]}</span>
            <span style={{ opacity: 0.5 }}>—</span>
            <span style={neonText("#ff3b4d")}>Player 2: {hud.mode === "session" ? hud.sessionWins[1] : hud.score[1]}</span>
            {hud.mode === "session" && (
              <span style={{ fontSize: 11, opacity: 0.55, fontWeight: "normal", marginLeft: 4 }}>session wins</span>
            )}
          </div>
        )}
      </div>

      {hud && (
        <div style={{
          width: "100%", maxWidth: CW, display: "grid",
          gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center", marginBottom: 8,
        }}>
          <div style={{
            background: "#10141d", border: "1px solid rgba(58,160,255,0.35)", borderRadius: 10,
            padding: "8px 12px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <b style={neonText("#3aa0ff")}>PLAYER 1</b>
              <span>{hud.p[0].hp} HP · {ammoLabel(hud.p[0])}</span>
            </div>
            <div style={{ height: 10, background: "#1a2230", borderRadius: 5, overflow: "hidden" }}>
              <div style={{
                width: `${clamp(hud.p[0].hp, 0, MAX_HP)}%`, height: "100%",
                background: "linear-gradient(90deg,#1a6ad4,#3aa0ff)",
                boxShadow: "0 0 10px #3aa0ff88", transition: "width .15s",
              }} />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 5, minHeight: 18, flexWrap: "wrap" }}>
              {Object.entries(hud.p[0].powers).map(([k, t]) => (
                <span key={k} style={{
                  fontSize: 10, padding: "1px 6px", borderRadius: 4,
                  background: "rgba(58,160,255,0.15)", border: "1px solid rgba(58,160,255,0.4)",
                }}>{powerIcons[k] || k} {Math.ceil(t)}s</span>
              ))}
            </div>
          </div>

          <div style={{
            minWidth: 92, textAlign: "center", padding: "8px 14px", borderRadius: 12,
            background: hud.timer <= 10 ? "rgba(255,59,77,0.18)" : "#10141d",
            border: `2px solid ${hud.timer <= 10 ? "#ff3b4d" : "rgba(255,233,122,0.55)"}`,
            boxShadow: hud.timer <= 10 ? "0 0 18px rgba(255,59,77,0.35)" : "0 0 14px rgba(255,233,122,0.15)",
          }}>
            <div style={{ fontSize: 10, opacity: 0.55, letterSpacing: 2 }}>{E.clock} TIME</div>
            <div style={{
              fontSize: 28, fontWeight: "bold",
              color: hud.timer <= 10 ? "#ff6b8a" : "#ffe97a",
              textShadow: `0 0 12px ${hud.timer <= 10 ? "#ff3b4d" : "#ffe97a"}`,
            }}>{hud.timer}</div>
          </div>

          <div style={{
            background: "#10141d", border: "1px solid rgba(255,59,77,0.35)", borderRadius: 10,
            padding: "8px 12px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <b style={neonText("#ff3b4d")}>PLAYER 2</b>
              <span>{hud.p[1].hp} HP · {ammoLabel(hud.p[1])}</span>
            </div>
            <div style={{ height: 10, background: "#1a2230", borderRadius: 5, overflow: "hidden" }}>
              <div style={{
                width: `${clamp(hud.p[1].hp, 0, MAX_HP)}%`, height: "100%",
                background: "linear-gradient(90deg,#d41a3a,#ff3b4d)",
                boxShadow: "0 0 10px #ff3b4d88", transition: "width .15s",
              }} />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 5, minHeight: 18, flexWrap: "wrap" }}>
              {Object.entries(hud.p[1].powers).map(([k, t]) => (
                <span key={k} style={{
                  fontSize: 10, padding: "1px 6px", borderRadius: 4,
                  background: "rgba(255,59,77,0.15)", border: "1px solid rgba(255,59,77,0.4)",
                }}>{powerIcons[k] || k} {Math.ceil(t)}s</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {hud?.mode === "session" && (
        <div style={{
          width: "100%", maxWidth: CW, marginBottom: 8, display: "flex", justifyContent: "center", gap: 28,
          fontSize: 12, padding: "6px 14px", borderRadius: 8, background: "#10141d",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <span><b style={neonText("#3aa0ff")}>Player 1:</b> {hud.sessionWins[0]} Wins</span>
          <span style={{ opacity: 0.35 }}>|</span>
          <span><b style={neonText("#ff3b4d")}>Player 2:</b> {hud.sessionWins[1]} Wins</span>
          <span style={{ opacity: 0.45 }}>· weapon round {hud.roundInLevel}/3</span>
        </div>
      )}

      <div className="gf-canvas-wrap" style={{ position: "relative", width: "100%", maxWidth: CW }}>
        <canvas ref={canvasRef} width={CW} height={CH}
          style={{
            width: "100%", display: "block", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.15)", background: "#000",
            boxShadow: "0 0 40px rgba(80,140,255,0.12)",
          }} />
        {mobilePlaying && (
          <>
            <TouchAimZone
              playerId={0}
              stateRef={stateRef}
              style={{ top: 0, left: 100, right: 88, height: "50%" }}
            />
            <TouchAimZone
              playerId={1}
              stateRef={stateRef}
              style={{ bottom: 0, left: 100, right: 88, height: "50%" }}
            />
            <MobilePlayerPad
              playerId={0}
              keys={KEYS.p1}
              color="#3aa0ff"
              fireColor="#7dff9a"
              stateRef={stateRef}
              analogStyle={{ left: 10, top: "6%" }}
              jumpStyle={{ left: 112, top: "8%", width: 52, height: 52, fontSize: 18 }}
              fireStyle={{ right: 12, top: "6%", width: 64, height: 64, fontSize: 22 }}
            />
            <MobilePlayerPad
              playerId={1}
              keys={KEYS.p2}
              color="#ff3b4d"
              fireColor="#7dff9a"
              stateRef={stateRef}
              analogStyle={{ left: 10, top: "56%" }}
              jumpStyle={{ left: 112, top: "58%", width: 52, height: 52, fontSize: 18 }}
              fireStyle={{ right: 12, top: "56%", width: 64, height: 64, fontSize: 22 }}
            />
          </>
        )}
      </div>

      <p style={{ opacity: 0.5, fontSize: 12, marginTop: 8, textAlign: "center", maxWidth: CW }}>
        {mobilePlaying
          ? "P1 top · P2 bottom — analog to move, drag center to aim, jump + fire buttons on the sides"
          : touchUI
            ? "Use landscape for best touch controls · keyboard still works on desktop"
            : "P1: A/D move · W jump · S crouch · Q/E rotate arm · SPACE fire · R reload  |  P2: arrows · O/P rotate arm · ENTER fire · / reload"}
      </p>
    </div>
  );
}