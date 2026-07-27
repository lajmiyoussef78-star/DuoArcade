// src/pages/MagnetHearts.jsx — Magnet Hearts (FIXBUG).
// Equal seats: both run full mhStep. Independent acts. Soft st for score/holds only.
// Own pose local; peer from pose; never host-puppet; never rewind own acts.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  recordMagnetHearts, mhInitial, mhStep, MH, ZONES,
  packMh, integratePod, seatHeld, reconcilePod,
  mhApplyGrab, mhReconcileDual
} from '../lib/magnethearts.js';
import '../styles/magnethearts.css';

function toShellWinner(w) {
  return w === 'D' ? 'draw' : w;
}

function packPose(by, pod) {
  if (!pod) return null;
  return {
    k: 'pose', by,
    x: pod.x, y: pod.y,
    vx: pod.vx || 0, vy: pod.vy || 0,
    fx: pod.fx, fy: pod.fy
  };
}

function otherRole(r) {
  return r === 'A' ? 'B' : 'A';
}

export default function MagnetHearts({ myRole, names = {}, rt, code, onComplete }) {
  const me = myRole;
  const nm = { A: names.A || 'A', B: names.B || 'B' };

  const [phase, setPhase] = useState('wait'); // wait | play | done
  const [hud, setHud] = useState({ a: 0, b: 0, left: MH.MATCH_SECONDS });
  const [winner, setWinner] = useState(null);
  /** Both seats ready once shared seed begin() runs (FIXBUG equal start). */
  const [guestReady, setGuestReady] = useState(me === 'A');

  const canvasRef = useRef(null);
  const meRef = useRef(me);
  const stRef = useRef(null);
  const dirRef = useRef({ x: 0, y: 0 });
  const throwEdgeRef = useRef(false);
  /** Peer authored pose (both seats). */
  const peerPoseRef = useRef(null);
  const peerThrowRef = useRef(null);
  const peerGrabRef = useRef(null);
  const keysRef = useRef({});
  const fxRef = useRef([]);
  const prevScoreRef = useRef({ A: 0, B: 0 });
  const prevHeldKeyRef = useRef('');
  const startedRef = useRef(false);
  const endedRef = useRef(false);
  const phaseRef = useRef('wait');
  const stSeqRef = useRef(0);
  const lastStSeqRef = useRef(-1);
  const throwIdRef = useRef(0);
  const grabIdRef = useRef(0);
  const seenTryRef = useRef(new Set());
  const seenGrabRef = useRef(new Set());
  /** Soft authority snap (score/holds) — physics stays local on both seats. */
  const hostSnapRef = useRef(null);
  const hostSnapAtRef = useRef(0);
  const localPodRef = useRef(null);
  const lastMoveAtRef = useRef(0);
  const pendingThrowRef = useRef(null);
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
    const init = mhInitial(seed);
    stRef.current = init;
    fxRef.current = [];
    prevScoreRef.current = { A: 0, B: 0 };
    dirRef.current = { x: 0, y: 0 };
    throwEdgeRef.current = false;
    peerPoseRef.current = null;
    peerThrowRef.current = null;
    peerGrabRef.current = null;
    stSeqRef.current = 0;
    lastStSeqRef.current = -1;
    throwIdRef.current = 0;
    grabIdRef.current = 0;
    seenTryRef.current = new Set();
    seenGrabRef.current = new Set();
    hostSnapRef.current = null;
    hostSnapAtRef.current = 0;
    localPodRef.current = null;
    lastMoveAtRef.current = 0;
    pendingThrowRef.current = null;
    prevHeldKeyRef.current = '';
    setGuestReady(true);
    setWinner(null);
    setHud({ a: 0, b: 0, left: MH.MATCH_SECONDS });
    setPhase('play');
  }, []);

  /** Soft authority tick (~8–12Hz) + force on score/hold/spawn/end — not every ms. */
  const pushSt = useCallback((force = false) => {
    if (meRef.current !== 'A') return;
    const st = hostSnapRef.current || stRef.current;
    if (!st) return;
    if (!force && st.over) return;
    stSeqRef.current += 1;
    const msg = { k: 'st', seq: stSeqRef.current, st: packMh(st) };
    rt?.send(msg);
    if (force) {
      setTimeout(() => rt?.send(msg), 100);
      setTimeout(() => rt?.send(msg), 240);
    }
  }, [rt]);

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
          pushSt(true);
        }
        return;
      }
      if (m.k === 'start') {
        begin(m.seed ?? ((Date.now() >>> 0) ^ 0x4EA47));
        return;
      }
      if (m.k === 'st') {
        if (meRef.current === 'A') return;
        if (typeof m.seq === 'number') {
          if (m.seq <= lastStSeqRef.current) return;
          lastStSeqRef.current = m.seq;
        }
        const remote = m.st;
        if (!remote) return;
        hostSnapRef.current = remote;
        hostSnapAtRef.current = performance.now();
        const meKey = meRef.current;
        const hostPod = remote.pods?.[meKey];
        // Own avatar: seed once; hard snap only on huge desync (never soft-rewind).
        if (!localPodRef.current && hostPod) {
          localPodRef.current = { ...hostPod };
        } else if (localPodRef.current && hostPod) {
          const d = Math.hypot(
            localPodRef.current.x - hostPod.x,
            localPodRef.current.y - hostPod.y
          );
          if (d > 220) {
            localPodRef.current = reconcilePod(localPodRef.current, hostPod);
          }
        }
        // Peer from pose stream; st.pods only seeds until first pose.
        const opp = otherRole(meKey);
        if (!peerPoseRef.current && remote.pods?.[opp]) {
          peerPoseRef.current = { ...remote.pods[opp] };
        }
        const protect = pendingThrowRef.current?.ids || [];
        if (stRef.current) {
          stRef.current = mhReconcileDual(stRef.current, remote, meKey, { protectIds: protect });
        } else {
          stRef.current = packMh(remote);
        }
        if (pendingThrowRef.current) {
          const authFree = !(remote.items || []).some(
            i => i.held === meKey && pendingThrowRef.current.ids.includes(i.id)
          );
          if (authFree || (performance.now() - pendingThrowRef.current.at > 900)) {
            pendingThrowRef.current = null;
          }
        }
        setGuestReady(true);
        return;
      }
      if (m.k === 'pose') {
        if (!m.by || m.by === meRef.current) return;
        peerPoseRef.current = {
          x: m.x, y: m.y,
          vx: m.vx || 0, vy: m.vy || 0,
          fx: m.fx ?? peerPoseRef.current?.fx ?? (m.by === 'A' ? 1 : -1),
          fy: m.fy ?? peerPoseRef.current?.fy ?? 0
        };
        return;
      }
      if (m.k === 'try') {
        const by = m.by || (meRef.current === 'A' ? 'B' : 'A');
        if (by === meRef.current) return;
        if (m.id && seenTryRef.current.has(m.id)) return;
        if (m.id) seenTryRef.current.add(m.id);
        if (typeof m.px === 'number' && typeof m.py === 'number') {
          peerPoseRef.current = {
            x: m.px, y: m.py,
            vx: m.pvx || 0, vy: m.pvy || 0,
            fx: m.fx ?? peerPoseRef.current?.fx ?? (by === 'A' ? 1 : -1),
            fy: m.fy ?? peerPoseRef.current?.fy ?? 0
          };
        }
        peerThrowRef.current = {
          by,
          ids: Array.isArray(m.ids) ? m.ids : [],
          pose: typeof m.px === 'number' ? {
            x: m.px, y: m.py, vx: m.pvx || 0, vy: m.pvy || 0, fx: m.fx, fy: m.fy
          } : null
        };
        return;
      }
      if (m.k === 'grab') {
        const by = m.by || 'B';
        if (by === meRef.current) return;
        if (m.id && seenGrabRef.current.has(m.id)) return;
        if (m.id) seenGrabRef.current.add(m.id);
        peerGrabRef.current = {
          itemId: m.itemId,
          by,
          pose: typeof m.px === 'number' ? {
            x: m.px, y: m.py, vx: m.pvx || 0, vy: m.pvy || 0, fx: m.fx, fy: m.fy
          } : null
        };
        return;
      }
      if (m.k === 'over') {
        finish(m.winner, false);
      }
    });
    return undefined;
  }, [rt, begin, finish, pushSt]);

  useEffect(() => {
    let cancelled = false;
    const timers = [];
    let askIv = null;
    (async () => {
      let ok = false;
      try { ok = await rt?.whenReady?.(); } catch { /* */ }
      if (cancelled) return;
      if (!ok && !rt?.isReady?.()) {
        for (let i = 0; i < 20 && !cancelled; i++) {
          await new Promise(r => setTimeout(r, 250));
          if (rt?.isReady?.()) { ok = true; break; }
        }
      }
      if (cancelled) return;
      if (me === 'A') {
        const seed = (Date.now() >>> 0) ^ 0x4EA47;
        const push = () => {
          rt?.send({ k: 'start', seed });
          pushSt(true);
        };
        begin(seed);
        push();
        timers.push(setTimeout(push, 400), setTimeout(push, 1200));
      } else {
        const ask = () => { if (!startedRef.current) rt?.send({ k: 'needstart' }); };
        ask();
        askIv = setInterval(ask, 500);
      }
    })();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      if (askIv) clearInterval(askIv);
    };
  }, [me, rt, begin, pushSt]);

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
    if (!st?.pods) return;
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
      drawMagneteer(g, p, col, deep, st.t, r === 'A' ? 0 : 1);
    }

    // Held catch sits in the magnet mouth (drawn on top).
    for (const it of st.items) {
      if (it.held) drawItem(it);
    }

    for (const fx of fxRef.current) {
      const life = Math.max(0, fx.life);
      const age = 1 - life;
      g.save();
      if (fx.kind === 'score' || !fx.kind) {
        g.globalAlpha = life;
        g.font = '800 22px Inter, sans-serif';
        g.textAlign = 'center';
        g.fillStyle = fx.neg ? '#FF8A8A' : '#6FDCA8';
        g.fillText(fx.text, fx.x, fx.y);
      } else if (fx.kind === 'throw') {
        const ang = Math.atan2(fx.vy || 0, fx.vx || 1);
        const isBomb = fx.type === 'bomb';
        const col = isBomb ? '#FF8A8A' : (fx.type === 'gold' ? CANC : P2);
        g.translate(fx.x, fx.y);
        g.rotate(ang);
        g.globalAlpha = life * 0.95;
        g.strokeStyle = col;
        g.lineWidth = 3;
        g.lineCap = 'round';
        // Launch streak
        g.beginPath();
        g.moveTo(-8, 0);
        g.lineTo(28 + age * 36, 0);
        g.stroke();
        // Sparks fan
        for (let i = 0; i < 7; i++) {
          const a = (i - 3) * 0.22;
          const len = 18 + age * 42 + (i % 2) * 8;
          g.globalAlpha = life * (0.85 - Math.abs(i - 3) * 0.1);
          g.beginPath();
          g.moveTo(6, 0);
          g.lineTo(6 + Math.cos(a) * len, Math.sin(a) * len * 0.7);
          g.stroke();
          g.fillStyle = col;
          g.beginPath();
          g.arc(6 + Math.cos(a) * len, Math.sin(a) * len * 0.7, isBomb ? 3.2 : 2.4, 0, 7);
          g.fill();
        }
        // Flash disc at release
        g.globalAlpha = life * 0.55;
        g.fillStyle = isBomb ? 'rgba(255,120,80,.7)' : 'rgba(255,255,255,.55)';
        g.beginPath();
        g.arc(0, 0, 10 + age * 18, 0, 7);
        g.fill();
      } else if (fx.kind === 'bank') {
        const zx = fx.x, zy = fx.y;
        const col = fx.type === 'gold' ? CANC : P2;
        // Suck rings into the hole
        for (let i = 0; i < 3; i++) {
          const k = (age + i * 0.18) % 1;
          g.globalAlpha = life * (1 - k) * 0.85;
          g.strokeStyle = col;
          g.lineWidth = 3 - i * 0.5;
          g.beginPath();
          g.arc(zx, zy, MH.ZONE_R * (1.05 - k * 0.92), 0, 7);
          g.stroke();
        }
        // Sparkle swirl
        for (let i = 0; i < 10; i++) {
          const a = age * 7 + i * (Math.PI * 2 / 10);
          const rr = MH.ZONE_R * (0.85 - age * 0.75);
          g.globalAlpha = life * 0.9;
          g.fillStyle = i % 2 ? '#fff' : col;
          g.beginPath();
          g.arc(zx + Math.cos(a) * rr, zy + Math.sin(a) * rr, 2.6 * (1 - age * 0.4), 0, 7);
          g.fill();
        }
        // Soft bloom
        g.globalAlpha = life * 0.35;
        g.fillStyle = col;
        g.beginPath();
        g.arc(zx, zy, 22 + age * 30, 0, 7);
        g.fill();
      } else if (fx.kind === 'boom') {
        const zx = fx.x, zy = fx.y;
        // Shock rings
        for (let i = 0; i < 3; i++) {
          const k = Math.min(1, age * 1.4 + i * 0.15);
          g.globalAlpha = life * (1 - k) * 0.9;
          g.strokeStyle = i === 0 ? '#FFC66E' : '#FF8A8A';
          g.lineWidth = 5 - i;
          g.beginPath();
          g.arc(zx, zy, 16 + k * (70 + i * 28), 0, 7);
          g.stroke();
        }
        // Fire shards
        for (let i = 0; i < 12; i++) {
          const a = i * (Math.PI * 2 / 12) + age * 2;
          const rr = 20 + age * 90;
          g.globalAlpha = life * 0.95;
          g.fillStyle = i % 3 === 0 ? '#FFC66E' : (i % 3 === 1 ? '#FF8A8A' : '#fff');
          g.beginPath();
          g.moveTo(zx, zy);
          g.lineTo(
            zx + Math.cos(a) * rr,
            zy + Math.sin(a) * rr
          );
          g.lineTo(
            zx + Math.cos(a + 0.18) * (rr * 0.55),
            zy + Math.sin(a + 0.18) * (rr * 0.55)
          );
          g.closePath();
          g.fill();
        }
        // Core flash
        g.globalAlpha = life * 0.7;
        g.fillStyle = 'rgba(255,240,180,.85)';
        g.beginPath();
        g.arc(zx, zy, 18 * life + 6, 0, 7);
        g.fill();
      }
      g.restore();
      g.globalAlpha = 1;
    }
  }, [drawHeart, drawMagneteer]);

  useEffect(() => {
    if (phase !== 'play') return undefined;
    const isHost = meRef.current === 'A';
    let raf, last = performance.now();
    let lastPush = 0;
    let lastPose = 0;

    const sendMyPose = (pod) => {
      const msg = packPose(meRef.current, pod);
      if (msg) rt?.send(msg);
    };

    const sendThrow = (pod, itemIds = []) => {
      throwIdRef.current += 1;
      const id = `${meRef.current}-${throwIdRef.current}`;
      const payload = {
        k: 'try', id, by: meRef.current,
        ids: itemIds,
        px: pod?.x, py: pod?.y,
        pvx: pod?.vx || 0, pvy: pod?.vy || 0,
        fx: pod?.fx, fy: pod?.fy
      };
      rt?.send(payload);
      setTimeout(() => rt?.send(payload), 100);
      setTimeout(() => rt?.send(payload), 240);
    };

    const sendGrab = (itemId, pod) => {
      grabIdRef.current += 1;
      const id = `${meRef.current}-g${grabIdRef.current}`;
      const payload = {
        k: 'grab', id, itemId, by: meRef.current,
        px: pod?.x, py: pod?.y,
        pvx: pod?.vx || 0, pvy: pod?.vy || 0,
        fx: pod?.fx, fy: pod?.fy
      };
      rt?.send(payload);
      setTimeout(() => rt?.send(payload), 100);
      setTimeout(() => rt?.send(payload), 240);
    };

    /** FIXBUG: throw is local in mhStep this frame; critical try tells peer. */
    const throwNow = () => {
      const meKey = meRef.current;
      const ids = (stRef.current?.items || [])
        .filter(i => i.held === meKey)
        .map(i => i.id);
      if (ids.length) {
        pendingThrowRef.current = { ids, at: performance.now() };
      }
      sendMyPose(localPodRef.current);
      sendThrow(localPodRef.current, ids);
    };

    const loop = now => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const meKey = meRef.current;
      const opp = otherRole(meKey);

      if (!endedRef.current) {
        const wantThrow = throwEdgeRef.current;
        throwEdgeRef.current = false;
        const dir = dirRef.current;
        if (Math.hypot(dir.x, dir.y) > 0.01) lastMoveAtRef.current = now;

        // --- Equal seat path (A and B identical) ---
        if (!stRef.current) {
          raf = requestAnimationFrame(loop);
          return;
        }
        if (!localPodRef.current && stRef.current.pods?.[meKey]) {
          localPodRef.current = { ...stRef.current.pods[meKey] };
        }
        if (!peerPoseRef.current && stRef.current.pods?.[opp]) {
          peerPoseRef.current = { ...stRef.current.pods[opp] };
        }

        if (localPodRef.current) integratePod(localPodRef.current, dir, dt);
        if (peerPoseRef.current) integratePod(peerPoseRef.current, { x: 0, y: 0 }, dt);

        if (wantThrow) throwNow();

        const gGrab = peerGrabRef.current;
        peerGrabRef.current = null;
        if (gGrab?.itemId && gGrab.by && gGrab.by !== meKey) {
          if (gGrab.pose) peerPoseRef.current = { ...peerPoseRef.current, ...gGrab.pose };
          const { st: after, ok } = mhApplyGrab(
            stRef.current, gGrab.by, gGrab.itemId, gGrab.pose
          );
          if (ok) stRef.current = after;
        }

        const gThrow = peerThrowRef.current;
        peerThrowRef.current = null;
        let peerThrows = false;
        if (gThrow && gThrow.by && gThrow.by !== meKey) {
          const throwPose = gThrow.pose || peerPoseRef.current;
          if (throwPose) peerPoseRef.current = { ...peerPoseRef.current, ...throwPose };
          for (const itemId of (gThrow.ids || [])) {
            const holding = (stRef.current.items || []).some(i => i.held === gThrow.by);
            if (holding) break;
            const { st: after, ok } = mhApplyGrab(
              stRef.current, gThrow.by, itemId, throwPose
            );
            if (ok) stRef.current = after;
          }
          peerThrows = true;
        }

        const prevScore = { A: stRef.current.score.A, B: stRef.current.score.B };
        const prevHeldMine = (stRef.current.items || []).find(i => i.held === meKey)?.id;
        const prevHeld = prevHeldKeyRef.current;

        const poseLock = {};
        if (meKey === 'A') {
          if (localPodRef.current) poseLock.A = localPodRef.current;
          if (peerPoseRef.current) poseLock.B = peerPoseRef.current;
        } else {
          if (peerPoseRef.current) poseLock.A = peerPoseRef.current;
          if (localPodRef.current) poseLock.B = localPodRef.current;
        }

        const next = mhStep(stRef.current, {
          A: { x: 0, y: 0, throw: meKey === 'A' ? wantThrow : peerThrows },
          B: { x: 0, y: 0, throw: meKey === 'B' ? wantThrow : peerThrows }
        }, dt, { poseLock });

        if (localPodRef.current) next.pods[meKey] = { ...localPodRef.current };
        if (peerPoseRef.current) next.pods[opp] = { ...peerPoseRef.current };
        seatHeld(next, 'A');
        seatHeld(next, 'B');
        stRef.current = next;

        // Local VFX from sim events (throw / bank / boom) — both seats.
        for (const e of next.events || []) {
          if (e.kind === 'throw') {
            fxRef.current.push({
              kind: 'throw', type: e.type,
              x: e.x, y: e.y, vx: e.vx || 0, vy: e.vy || 0, life: 1
            });
          } else if (e.kind === 'bank') {
            const z = ZONES[e.side] || { x: e.x, y: e.y };
            fxRef.current.push({
              kind: 'bank', type: e.type || 'heart',
              x: z.x, y: z.y, life: 1
            });
          } else if (e.kind === 'boom') {
            const z = ZONES[e.side] || { x: e.x, y: e.y };
            fxRef.current.push({
              kind: 'boom', x: z.x, y: z.y, life: 1
            });
          }
        }

        const nowHeld = (next.items || []).find(i => i.held === meKey);
        if (nowHeld && nowHeld.id !== prevHeldMine) {
          sendGrab(nowHeld.id, localPodRef.current);
        }

        // Soft authority: seat A emits slim st (not physics puppet for B).
        if (isHost) {
          hostSnapRef.current = packMh(next);
          hostSnapAtRef.current = now;
          const heldKey = (next.items || [])
            .filter(i => i.held)
            .map(i => `${i.id}:${i.held}`)
            .sort()
            .join('|');
          const heldChanged = heldKey !== prevHeld;
          prevHeldKeyRef.current = heldKey;
          const scored = next.score.A !== prevScore.A || next.score.B !== prevScore.B;
          const spawned = (next.events || []).some(e => e.kind === 'spawn');
          const force = !!(next.over || scored || spawned || heldChanged || gGrab || peerThrows || wantThrow);
          if (force || now - lastPush > 110) {
            pushSt(force);
            lastPush = now;
          }
          if (next.over && !endedRef.current) {
            endedRef.current = true;
            const overMsg = { k: 'over', winner: next.winner };
            rt?.send(overMsg);
            setTimeout(() => rt?.send(overMsg), 150);
            setTimeout(() => rt?.send(overMsg), 350);
            finish(next.winner, true);
          }
        } else if (pendingThrowRef.current) {
          const still = (next.items || []).some(
            i => i.held === meKey && pendingThrowRef.current.ids.includes(i.id)
          );
          if (!still && performance.now() - pendingThrowRef.current.at > 80) {
            pendingThrowRef.current = null;
          }
        }

        // Soft pose ~20Hz both seats.
        if (now - lastPose > 50 && localPodRef.current) {
          lastPose = now;
          sendMyPose(localPodRef.current);
        }
      }

      const st = stRef.current;
      if (!st) {
        raf = requestAnimationFrame(loop);
        return;
      }
      setHud({ a: st.score.A, b: st.score.B, left: Math.ceil(st.left) });
      for (const r of ['A', 'B']) {
        const d = st.score[r] - prevScoreRef.current[r];
        if (d !== 0) {
          fxRef.current.push({
            kind: 'score',
            x: ZONES[r].x, y: ZONES[r].y - 30,
            text: (d > 0 ? '+' : '') + d,
            neg: d < 0, life: 1
          });
        }
        prevScoreRef.current[r] = st.score[r];
      }
      for (const fx of fxRef.current) {
        if (fx.kind === 'score' || !fx.kind) {
          fx.life -= dt * 0.8;
          fx.y -= dt * 34;
        } else if (fx.kind === 'throw') {
          fx.life -= dt * 1.6;
          fx.x += (fx.vx || 0) * dt * 0.12;
          fx.y += (fx.vy || 0) * dt * 0.12;
        } else if (fx.kind === 'bank') {
          fx.life -= dt * 1.15;
        } else if (fx.kind === 'boom') {
          fx.life -= dt * 1.35;
        } else {
          fx.life -= dt * 1.2;
        }
      }
      fxRef.current = fxRef.current.filter(fx => fx.life > 0);
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); };
  }, [phase, rt, finish, draw, pushSt]);

  function padDir(x, y) { dirRef.current = { x, y }; }

  if (!me || phase === 'wait' || (me !== 'A' && !guestReady)) {
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
