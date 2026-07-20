// src/pages/MagnetHearts.jsx — Magnet Hearts (mounted by the magnethearts engine).
// Host-authoritative over the shell RT channel. 90s highest bank wins.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  recordMagnetHearts, mhInitial, mhStep, MH, ZONES
} from '../lib/magnethearts.js';
import '../styles/magnethearts.css';

function toShellWinner(w) {
  return w === 'D' ? 'draw' : w;
}

export default function MagnetHearts({ myRole, names = {}, rt, code, onComplete }) {
  const me = myRole;
  const nm = { A: names.A || 'A', B: names.B || 'B' };

  const [phase, setPhase] = useState('wait'); // wait | play | done
  const [hud, setHud] = useState({ a: 0, b: 0, left: MH.MATCH_SECONDS });
  const [winner, setWinner] = useState(null);

  const canvasRef = useRef(null);
  const meRef = useRef(me);
  const stRef = useRef(mhInitial(1));
  const dirRef = useRef({ x: 0, y: 0 });
  const throwEdgeRef = useRef(false);
  const guestInRef = useRef({ x: 0, y: 0, throw: false });
  const keysRef = useRef({});
  const fxRef = useRef([]);
  const prevScoreRef = useRef({ A: 0, B: 0 });
  const startedRef = useRef(false);
  const endedRef = useRef(false);
  const phaseRef = useRef('wait');
  meRef.current = me;
  phaseRef.current = phase;

  const finish = useCallback((w, iRecord) => {
    if (endedRef.current && phaseRef.current === 'done') return;
    endedRef.current = true;
    setWinner(w);
    setPhase('done');
    if (iRecord) {
      onComplete?.(toShellWinner(w));
      recordMagnetHearts(code, w).catch(() => {});
    }
  }, [code, onComplete]);

  const begin = useCallback((seed) => {
    if (startedRef.current) return;
    startedRef.current = true;
    endedRef.current = false;
    stRef.current = mhInitial(seed);
    fxRef.current = [];
    prevScoreRef.current = { A: 0, B: 0 };
    dirRef.current = { x: 0, y: 0 };
    throwEdgeRef.current = false;
    guestInRef.current = { x: 0, y: 0, throw: false };
    setWinner(null);
    setHud({ a: 0, b: 0, left: MH.MATCH_SECONDS });
    setPhase('play');
  }, []);

  useEffect(() => {
    const dirFromKeys = () => {
      const k = keysRef.current;
      let x = 0, y = 0;
      if (k.ArrowLeft || k.a) x -= 1;
      if (k.ArrowRight || k.d) x += 1;
      if (k.ArrowUp || k.w) y -= 1;
      if (k.ArrowDown || k.s) y += 1;
      dirRef.current = { x, y };
    };
    const down = e => {
      if (e.key === ' ') { e.preventDefault(); throwEdgeRef.current = true; return; }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(key)) {
        e.preventDefault();
        keysRef.current[key] = true;
        dirFromKeys();
      }
    };
    const up = e => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keysRef.current[key] = false;
      dirFromKeys();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    if (!rt?.on) return undefined;
    rt.on(m => {
      if (!m?.k) return;
      if (m.k === 'needstart') {
        if (meRef.current === 'A' && startedRef.current && stRef.current) {
          rt.send({ k: 'start', seed: stRef.current.seed });
        }
        return;
      }
      if (m.k === 'start') {
        begin(m.seed ?? ((Date.now() >>> 0) ^ 0x4EA47));
        return;
      }
      if (m.k === 'st') {
        stRef.current = m.st;
        return;
      }
      if (m.k === 'in') {
        guestInRef.current.x = m.x;
        guestInRef.current.y = m.y;
        if (m.throw) guestInRef.current.throw = true;
        return;
      }
      if (m.k === 'over') {
        finish(m.winner, false);
      }
    });
    return undefined;
  }, [rt, begin, finish]);

  useEffect(() => {
    if (me === 'A') {
      const seed = (Date.now() >>> 0) ^ 0x4EA47;
      const push = () => rt?.send({ k: 'start', seed });
      begin(seed);
      push();
      const t1 = setTimeout(push, 400);
      const t2 = setTimeout(push, 1200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    const ask = () => { if (!startedRef.current) rt?.send({ k: 'needstart' }); };
    ask();
    const iv = setInterval(ask, 700);
    return () => clearInterval(iv);
  }, [me, rt, begin]);

  const drawHeart = useCallback((g, x, y, size, fill, glow, t = 0) => {
    // Classic smooth heart (normalized to `size` height).
    const s = size * 0.5;
    g.save();
    g.translate(x, y + s * 0.05);
    if (glow) {
      const pulse = 0.65 + 0.35 * Math.sin(t * 6);
      g.shadowColor = fill;
      g.shadowBlur = 22 + pulse * 18;
      g.fillStyle = `rgba(255,198,110,${0.16 + pulse * 0.12})`;
      g.beginPath();
      g.arc(0, 0, s * (1.15 + pulse * 0.12), 0, 7);
      g.fill();
    }
    g.beginPath();
    g.moveTo(0, s * 0.35);
    g.bezierCurveTo(0, s * 0.12, -s * 0.5, -s * 0.08, -s * 0.5, -s * 0.32);
    g.bezierCurveTo(-s * 0.5, -s * 0.62, -s * 0.08, -s * 0.72, 0, -s * 0.42);
    g.bezierCurveTo(s * 0.08, -s * 0.72, s * 0.5, -s * 0.62, s * 0.5, -s * 0.32);
    g.bezierCurveTo(s * 0.5, -s * 0.08, 0, s * 0.12, 0, s * 0.35);
    g.closePath();
    const sheen = g.createLinearGradient(-s * 0.4, -s * 0.5, s * 0.3, s * 0.4);
    sheen.addColorStop(0, '#FFFFFF');
    sheen.addColorStop(0.18, fill);
    sheen.addColorStop(1, glow ? '#E8A84A' : fill);
    g.fillStyle = sheen;
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = glow ? 'rgba(255,245,200,.85)' : 'rgba(255,255,255,.55)';
    g.lineWidth = Math.max(1.5, size * 0.04);
    g.lineJoin = 'round';
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,.45)';
    g.beginPath();
    g.ellipse(-s * 0.18, -s * 0.22, s * 0.12, s * 0.08, -0.4, 0, 7);
    g.fill();
    if (glow) {
      for (let i = 0; i < 5; i++) {
        const ang = t * 2.8 + i * (Math.PI * 2 / 5);
        const rr = s * (0.85 + 0.12 * Math.sin(t * 5 + i));
        g.fillStyle = `rgba(255,245,200,${0.45 + 0.4 * Math.sin(t * 8 + i)})`;
        g.beginPath();
        g.arc(Math.cos(ang) * rr, Math.sin(ang) * rr * 0.85, 2.2, 0, 7);
        g.fill();
      }
    }
    g.restore();
  }, []);

  const drawMagneteer = useCallback((g, p, col, deep, t, side) => {
    const speed = Math.hypot(p.vx || 0, p.vy || 0);
    const facing = Math.atan2(p.fy, p.fx);
    const flip = Math.cos(facing) >= 0 ? 1 : -1;
    const bob = Math.sin(t * 5.2 + side * 1.7) * 2.2;
    const wobble = Math.sin(t * 3.4 + side) * 0.04;
    const squash = speed > 40 ? Math.min(0.08, speed * 0.0002) : 0;
    const blink = Math.sin(t * 1.05 + side * 2.4) > 0.94;
    const pulse = 0.55 + 0.45 * Math.sin(t * 7 + side);

    g.save();
    g.translate(p.x, p.y);
    g.scale(3, 3);

    // soft shadow
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.beginPath();
    g.ellipse(0, 18, 16 + Math.min(5, speed * 0.012), 5.5, 0, 0, 7);
    g.fill();

    g.translate(0, bob - 4);
    g.rotate(wobble);
    g.scale(1 + squash, 1 - squash);

    // tiny stubby paws (creature, not legs)
    g.fillStyle = deep;
    g.beginPath(); g.ellipse(-9, 14, 5.5, 3.8, -0.2, 0, 7); g.fill();
    g.beginPath(); g.ellipse(9, 14, 5.5, 3.8, 0.2, 0, 7); g.fill();

    // round marshmallow body
    const body = g.createRadialGradient(-6, -8, 3, 0, 0, 22);
    body.addColorStop(0, '#FFFFFF');
    body.addColorStop(0.28, col);
    body.addColorStop(1, deep);
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(0, 0, 20, 18, 0, 0, 7);
    g.fill();

    // soft belly
    g.fillStyle = 'rgba(255,255,255,.28)';
    g.beginPath();
    g.ellipse(0, 4, 11, 9, 0, 0, 7);
    g.fill();

    // ear fluff / magnet nubs on top
    g.fillStyle = col;
    g.beginPath(); g.ellipse(-11, -14, 6, 7, -0.35, 0, 7); g.fill();
    g.beginPath(); g.ellipse(11, -14, 6, 7, 0.35, 0, 7); g.fill();
    g.fillStyle = deep;
    g.beginPath(); g.ellipse(-11, -15, 3.2, 3.8, -0.35, 0, 7); g.fill();
    g.beginPath(); g.ellipse(11, -15, 3.2, 3.8, 0.35, 0, 7); g.fill();

    // face (cute creature — big eyes, no human features)
    g.save();
    g.scale(flip, 1);

    // blush patches
    g.fillStyle = 'rgba(255,140,180,.40)';
    g.beginPath(); g.ellipse(-11, 2, 4, 2.6, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(11, 2, 4, 2.6, 0, 0, 7); g.fill();

    if (!blink) {
      // big shiny eyes
      g.fillStyle = '#1E1A28';
      g.beginPath(); g.ellipse(-6.5, -3, 5.2, 6.2, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(6.5, -3, 5.2, 6.2, 0, 0, 7); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(-4.6, -5.4, 2.1, 0, 7); g.fill();
      g.beginPath(); g.arc(8.2, -5.4, 2.1, 0, 7); g.fill();
      g.beginPath(); g.arc(-7.6, -1.2, 1.1, 0, 7); g.fill();
      g.beginPath(); g.arc(5.2, -1.2, 1.1, 0, 7); g.fill();
    } else {
      g.strokeStyle = '#1E1A28'; g.lineWidth = 2.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-11, -3); g.quadraticCurveTo(-6.5, -1, -2, -3); g.stroke();
      g.beginPath(); g.moveTo(2, -3); g.quadraticCurveTo(6.5, -1, 11, -3); g.stroke();
      g.lineCap = 'butt';
    }

    // tiny cat-like smile
    g.strokeStyle = '#1E1A28'; g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-3, 5); g.quadraticCurveTo(0, 8, 3, 5);
    g.stroke();
    // little fang nubs
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(-1.6, 5.5); g.lineTo(-0.4, 8.2); g.lineTo(0.2, 5.8); g.fill();
    g.beginPath(); g.moveTo(1.6, 5.5); g.lineTo(0.4, 8.2); g.lineTo(-0.2, 5.8); g.fill();
    g.lineCap = 'butt';
    g.restore();

    // tiny arm stubs holding magnet
    g.save();
    g.rotate(facing);
    g.fillStyle = col;
    g.beginPath(); g.ellipse(12, 2, 5, 4, 0.2, 0, 7); g.fill();
    g.beginPath(); g.ellipse(14, 7, 4.5, 3.5, -0.1, 0, 7); g.fill();

    // toy horseshoe magnet — opening faces outward so a catch can sit in it
    g.translate(24, 4);
    g.scale(-1, 1);
    g.shadowColor = col;
    g.shadowBlur = 5 + pulse * 7;
    g.strokeStyle = '#D2D7E0';
    g.lineWidth = 10; g.lineCap = 'round';
    g.beginPath();
    g.arc(0, 0, 10, -Math.PI * 0.7, Math.PI * 0.7);
    g.stroke();
    g.shadowBlur = 0;

    g.fillStyle = '#E2554A';
    g.beginPath();
    g.moveTo(-5, -12); g.lineTo(5, -12); g.lineTo(5, -5); g.lineTo(-5, -5); g.closePath();
    g.fill();
    g.fillStyle = '#4A7BE0';
    g.beginPath();
    g.moveTo(-5, 5); g.lineTo(5, 5); g.lineTo(5, 12); g.lineTo(-5, 12); g.closePath();
    g.fill();

    g.fillStyle = `rgba(255,255,255,${0.4 + pulse * 0.45})`;
    g.beginPath(); g.arc(3, -8, 1.6 + pulse * 0.5, 0, 7); g.fill();
    g.beginPath(); g.arc(3, 8, 1.6 + pulse * 0.5, 0, 7); g.fill();
    g.restore();

    g.restore();
  }, []);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    const st = stRef.current;
    const css = getComputedStyle(document.documentElement);
    const P1 = css.getPropertyValue('--p1').trim() || '#7FA8FF';
    const P2 = css.getPropertyValue('--p2').trim() || '#FF7FA8';
    const CANC = css.getPropertyValue('--candle').trim() || '#FFC66E';

    const t = st.t || 0;

    // Arena floor — soft magnetic field, not a flat checkerboard
    const floor = g.createRadialGradient(MH.W * 0.5, MH.H * 0.45, 40, MH.W * 0.5, MH.H * 0.5, MH.W * 0.72);
    floor.addColorStop(0, '#2A2240');
    floor.addColorStop(0.45, '#1C162C');
    floor.addColorStop(1, '#100E18');
    g.fillStyle = floor;
    g.fillRect(0, 0, MH.W, MH.H);

    // Side color washes from each bank
    const washA = g.createRadialGradient(0, MH.H * 0.5, 20, 220, MH.H * 0.5, 520);
    washA.addColorStop(0, 'rgba(127,168,255,.16)');
    washA.addColorStop(1, 'rgba(127,168,255,0)');
    g.fillStyle = washA;
    g.fillRect(0, 0, MH.W * 0.55, MH.H);
    const washB = g.createRadialGradient(MH.W, MH.H * 0.5, 20, MH.W - 220, MH.H * 0.5, 520);
    washB.addColorStop(0, 'rgba(255,127,168,.14)');
    washB.addColorStop(1, 'rgba(255,127,168,0)');
    g.fillStyle = washB;
    g.fillRect(MH.W * 0.45, 0, MH.W * 0.55, MH.H);

    // Subtle field lines across the middle
    g.save();
    g.strokeStyle = 'rgba(242,237,247,.045)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      const yy = 90 + i * ((MH.H - 180) / 6);
      g.beginPath();
      g.moveTo(160, yy);
      g.bezierCurveTo(MH.W * 0.35, yy - 28 + (i % 2) * 16, MH.W * 0.65, yy + 28 - (i % 2) * 16, MH.W - 160, yy);
      g.stroke();
    }
    g.restore();

    // Soft vignette + rim
    const vig = g.createRadialGradient(MH.W / 2, MH.H / 2, MH.H * 0.25, MH.W / 2, MH.H / 2, MH.W * 0.62);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = vig;
    g.fillRect(0, 0, MH.W, MH.H);

    g.strokeStyle = 'rgba(255,198,110,.22)';
    g.lineWidth = 3;
    g.strokeRect(6, 6, MH.W - 12, MH.H - 12);
    g.strokeStyle = 'rgba(242,237,247,.12)';
    g.lineWidth = 2;
    g.strokeRect(14, 14, MH.W - 28, MH.H - 28);

    // Bank zones — solid magnet shine in player color
    for (const r of ['A', 'B']) {
      const z = ZONES[r];
      const col = r === 'A' ? P1 : P2;
      const pulse = 0.72 + 0.28 * Math.sin(t * 2.4 + (r === 'A' ? 0 : 1.7));

      g.save();
      g.translate(z.x, z.y);

      // Outer bloom
      g.shadowColor = col;
      g.shadowBlur = 28 + pulse * 18;
      const core = g.createRadialGradient(0, 0, 4, 0, 0, MH.ZONE_R);
      core.addColorStop(0, r === 'A' ? 'rgba(200,220,255,.95)' : 'rgba(255,210,230,.95)');
      core.addColorStop(0.28, col);
      core.addColorStop(0.7, r === 'A' ? 'rgba(127,168,255,.55)' : 'rgba(255,127,168,.55)');
      core.addColorStop(1, r === 'A' ? 'rgba(127,168,255,.08)' : 'rgba(255,127,168,.08)');
      g.fillStyle = core;
      g.beginPath();
      g.arc(0, 0, MH.ZONE_R, 0, 7);
      g.fill();
      g.shadowBlur = 0;

      // Magnetic ring bands
      g.strokeStyle = `rgba(255,255,255,${0.2 + pulse * 0.15})`;
      g.lineWidth = 2;
      for (let ring = 0.35; ring < 1; ring += 0.22) {
        g.beginPath();
        g.arc(0, 0, MH.ZONE_R * ring, 0, 7);
        g.stroke();
      }

      // Horseshoe field hint
      g.strokeStyle = `rgba(255,255,255,${0.28 + pulse * 0.2})`;
      g.lineWidth = 5;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(0, 0, MH.ZONE_R * 0.42, -Math.PI * 0.75, Math.PI * 0.75);
      g.stroke();
      g.lineCap = 'butt';

      // Crisp rim
      g.strokeStyle = col;
      g.lineWidth = 3.5;
      g.beginPath();
      g.arc(0, 0, MH.ZONE_R, 0, 7);
      g.stroke();
      g.strokeStyle = `rgba(255,255,255,${0.35 + pulse * 0.25})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(0, 0, MH.ZONE_R - 5, 0, 7);
      g.stroke();

      g.restore();
    }

    const drawItem = (it) => {
      const age = Math.max(0, st.t - (it.born ?? st.t));
      const pop = age < 0.55 ? (() => {
        const k = age / 0.55;
        return 0.35 + 0.65 * (1 - Math.pow(1 - k, 3));
      })() : 1;

      // Spawn burst rings
      if (age < 0.7) {
        const k = age / 0.7;
        const col = it.type === 'bomb' ? '#FF8A8A' : it.type === 'gold' ? CANC : P2;
        g.save();
        g.globalAlpha = (1 - k) * 0.85;
        g.strokeStyle = col;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(it.x, it.y, 18 + k * 52, 0, 7);
        g.stroke();
        g.lineWidth = 2;
        g.beginPath();
        g.arc(it.x, it.y, 8 + k * 34, 0, 7);
        g.stroke();
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2 + age * 4;
          const rr = 12 + k * 40;
          g.fillStyle = col;
          g.globalAlpha = (1 - k) * 0.9;
          g.beginPath();
          g.arc(it.x + Math.cos(ang) * rr, it.y + Math.sin(ang) * rr, 2.8 * (1 - k * 0.5), 0, 7);
          g.fill();
        }
        g.restore();
      }

      g.save();
      g.translate(it.x, it.y);
      g.scale(pop, pop);
      g.translate(-it.x, -it.y);

      if (it.type === 'bomb') {
        const br = MH.ITEM_R;
        g.fillStyle = '#14141C';
        g.beginPath(); g.arc(it.x, it.y, br, 0, 7); g.fill();
        g.strokeStyle = '#34343F'; g.lineWidth = 2.5;
        g.beginPath(); g.arc(it.x, it.y, br, 0, 7); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.22)';
        g.beginPath(); g.arc(it.x - 9, it.y - 11, 7, 0, 7); g.fill();
        g.strokeStyle = '#6B5A44'; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(it.x + 14, it.y - 22); g.quadraticCurveTo(it.x + 26, it.y - 34, it.x + 34, it.y - 28); g.stroke();
        g.fillStyle = CANC;
        const tw = 1.4 + Math.sin(st.t * 14 + it.id) * 1.1;
        g.beginPath(); g.arc(it.x + 34, it.y - 28, 4 + tw, 0, 7); g.fill();
      } else {
        drawHeart(
          g, it.x, it.y, MH.HEART_SIZE,
          it.type === 'gold' ? CANC : P2,
          it.type === 'gold',
          st.t
        );
      }
      g.restore();
    };

    for (const it of st.items) {
      if (!it.held) drawItem(it);
    }

    for (const r of ['A', 'B']) {
      const p = st.pods[r];
      const col = r === 'A' ? P1 : P2;
      const deep = r === 'A' ? '#3A5CA8' : '#B04A72';
      g.strokeStyle = r === 'A' ? 'rgba(127,168,255,.10)' : 'rgba(255,127,168,.10)';
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(p.x, p.y, MH.MAG_R, 0, 7); g.stroke();
      drawMagneteer(g, p, col, deep, st.t, r === 'A' ? 0 : 1);
    }

    // Held catch sits in the magnet mouth (drawn on top).
    for (const it of st.items) {
      if (it.held) drawItem(it);
    }

    for (const fx of fxRef.current) {
      g.globalAlpha = Math.max(0, fx.life);
      g.font = '800 22px Inter, sans-serif';
      g.textAlign = 'center';
      g.fillStyle = fx.neg ? '#FF8A8A' : '#6FDCA8';
      g.fillText(fx.text, fx.x, fx.y);
      g.globalAlpha = 1;
    }
  }, [drawHeart, drawMagneteer]);

  useEffect(() => {
    if (phase !== 'play') return undefined;
    const isHost = meRef.current === 'A';
    let raf, last = performance.now();

    const net = setInterval(() => {
      if (endedRef.current) return;
      if (isHost) rt?.send({ k: 'st', st: stRef.current });
      else {
        rt?.send({
          k: 'in',
          x: dirRef.current.x, y: dirRef.current.y,
          throw: throwEdgeRef.current
        });
        throwEdgeRef.current = false;
      }
    }, 50);

    const loop = now => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (isHost && !endedRef.current) {
        const myThrow = throwEdgeRef.current; throwEdgeRef.current = false;
        const gThrow = guestInRef.current.throw; guestInRef.current.throw = false;
        const next = mhStep(stRef.current, {
          A: { x: dirRef.current.x, y: dirRef.current.y, throw: myThrow },
          B: { x: guestInRef.current.x, y: guestInRef.current.y, throw: gThrow }
        }, dt);
        stRef.current = next;
        if (next.over && !endedRef.current) {
          endedRef.current = true;
          rt?.send({ k: 'st', st: next });
          rt?.send({ k: 'over', winner: next.winner });
          finish(next.winner, true);
        }
      }
      const st = stRef.current;
      setHud({ a: st.score.A, b: st.score.B, left: Math.ceil(st.left) });
      for (const r of ['A', 'B']) {
        const d = st.score[r] - prevScoreRef.current[r];
        if (d !== 0) {
          fxRef.current.push({
            x: ZONES[r].x, y: ZONES[r].y - 30,
            text: (d > 0 ? '+' : '') + d,
            neg: d < 0, life: 1
          });
        }
        prevScoreRef.current[r] = st.score[r];
      }
      fxRef.current.forEach(fx => { fx.life -= dt * 0.8; fx.y -= dt * 34; });
      fxRef.current = fxRef.current.filter(fx => fx.life > 0);
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); clearInterval(net); };
  }, [phase, rt, finish, draw]);

  function padDir(x, y) { dirRef.current = { x, y }; }

  if (!me || phase === 'wait') {
    return <div className="mh-shell"><p className="mh-status">Charging the magnets…</p></div>;
  }

  return (
    <div className="mh-shell">
      <div className="mh-gamewrap">
        <div className="mh-hud">
          <span className="pA">{nm.A} <b>{hud.a}</b></span>
          <span className="mh-clock">{hud.left}s</span>
          <span className="pB"><b>{hud.b}</b> {nm.B}</span>
        </div>
        <div className="mh-canvaswrap">
          <canvas ref={canvasRef} width={MH.W} height={MH.H} className="mh-canvas" />
        </div>

        {phase === 'play' && (
          <div className="mh-touch">
            <div className="mh-pad">
              <button type="button" className="mh-padbtn up" onPointerDown={() => padDir(0, -1)} onPointerUp={() => padDir(0, 0)} onPointerLeave={() => padDir(0, 0)}>{'\u25B2'}</button>
              <button type="button" className="mh-padbtn left" onPointerDown={() => padDir(-1, 0)} onPointerUp={() => padDir(0, 0)} onPointerLeave={() => padDir(0, 0)}>{'\u25C0'}</button>
              <button type="button" className="mh-padbtn right" onPointerDown={() => padDir(1, 0)} onPointerUp={() => padDir(0, 0)} onPointerLeave={() => padDir(0, 0)}>{'\u25B6'}</button>
              <button type="button" className="mh-padbtn down" onPointerDown={() => padDir(0, 1)} onPointerUp={() => padDir(0, 0)} onPointerLeave={() => padDir(0, 0)}>{'\u25BC'}</button>
            </div>
            <button type="button" className="mh-throw" onPointerDown={() => { throwEdgeRef.current = true; }}>
              THROW
            </button>
          </div>
        )}

        {phase === 'done' && winner && (
          <div className="mh-done">
            <div className="mh-winline">
              {winner === 'D' ? 'Dead even \u2014 a draw' : `${nm[winner]} wins the harvest`}
            </div>
            <div className="mh-final">{hud.a} {'\u2013'} {hud.b}</div>
          </div>
        )}
      </div>
    </div>
  );
}
