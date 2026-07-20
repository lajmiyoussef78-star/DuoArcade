// src/pages/SumoBomb.jsx — Sumo Bomb (mounted by the sumobomb engine).
// Host-authoritative over the shell RT channel. Best of 5.
// Aim arrow sweeps left↔right and stays inside the dohyo circle.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  recordSumoBomb, sbInitial, sbStep, SB, sumoPos, ownerOf
} from '../lib/sumobomb.js';
import '../styles/sumobomb.css';

const RING_FRAME = SB.RING_R + 46;

/** Longest arrow from (x,y) along angle that still ends inside the ring. */
function arrowLenInRing(x, y, angle, wantLen) {
  const margin = 6;
  let lo = 10, hi = wantLen, best = 10;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const tx = x + Math.cos(angle) * mid;
    const ty = y + Math.sin(angle) * mid;
    if (Math.hypot(tx - SB.CX, ty - SB.CY) <= RING_FRAME - margin) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best;
}

function drawAimArrow(g, x, y, angle, mine, color) {
  const len = arrowLenInRing(x, y, angle, mine ? 56 : 44);
  const head = Math.min(14, len * 0.28);
  const shaft = Math.max(8, len - head);
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  if (mine) {
    g.shadowColor = color;
    g.shadowBlur = 12;
  }
  g.strokeStyle = mine ? color : 'rgba(242,237,247,.38)';
  g.fillStyle = mine ? color : 'rgba(242,237,247,.38)';
  g.lineWidth = mine ? 5 : 3;
  g.setLineDash(mine ? [] : [6, 6]);
  g.beginPath();
  g.moveTo(SB.SUMO_R + 4, 0);
  g.lineTo(SB.SUMO_R + shaft, 0);
  g.stroke();
  g.setLineDash([]);
  const tip = SB.SUMO_R + shaft + head;
  g.beginPath();
  g.moveTo(tip, 0);
  g.lineTo(tip - head, -head * 0.55);
  g.lineTo(tip - head, head * 0.55);
  g.closePath();
  g.fill();
  g.shadowBlur = 0;
  g.restore();
}

export default function SumoBomb({ myRole, names = {}, rt, code, onComplete }) {
  const me = myRole;
  const nm = { A: names.A || 'A', B: names.B || 'B' };

  const [phase, setPhase] = useState('wait');
  const [hud, setHud] = useState({ a: 0, b: 0, round: 1, holderSide: null });
  const [winner, setWinner] = useState(null);

  const canvasRef = useRef(null);
  const meRef = useRef(me);
  const stRef = useRef(null);
  const throwsRef = useRef([]);
  const dispAimRef = useRef(0);
  const dispAimVelRef = useRef(SB.AIM_VEL);
  const dustRef = useRef(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const phaseRef = useRef('wait');
  meRef.current = me;
  phaseRef.current = phase;

  if (!dustRef.current) {
    dustRef.current = Array.from({ length: 28 }, (_, i) => ({
      a: (i / 28) * Math.PI * 2,
      r: 40 + (i * 17) % (RING_FRAME - 30),
      s: 0.4 + (i % 5) * 0.15,
      tw: i * 0.7
    }));
  }

  const finish = useCallback((w, iRecord) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setWinner(w);
    setPhase('done');
    if (iRecord) {
      onComplete?.(w);
      recordSumoBomb(code, w).catch(() => {});
    }
  }, [code, onComplete]);

  const begin = useCallback((seed) => {
    if (startedRef.current) return;
    startedRef.current = true;
    finishedRef.current = false;
    stRef.current = sbInitial(seed);
    dispAimRef.current = stRef.current.aim;
    dispAimVelRef.current = stRef.current.aimVel || SB.AIM_VEL;
    throwsRef.current = [];
    setWinner(null);
    setPhase('game');
  }, []);

  const fireThrow = useCallback(() => {
    const st = stRef.current;
    if (!st || phaseRef.current !== 'game') return;
    if (st.phase !== 'live' || st.transit || st.bombAt == null) return;
    if (ownerOf(st.bombAt) !== meRef.current) return;
    const angle = meRef.current === 'A' ? st.aim : dispAimRef.current;
    if (meRef.current === 'A') {
      throwsRef.current.push({ by: 'A', angle });
    } else {
      rt?.send({ k: 'throw', by: 'B', angle });
    }
  }, [rt]);

  useEffect(() => {
    const key = e => {
      if (e.key === ' ') { e.preventDefault(); fireThrow(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [fireThrow]);

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
        begin(m.seed ?? ((Date.now() >>> 0) ^ 0x50B0));
        return;
      }
      if (m.k === 'st') {
        stRef.current = m.st;
        dispAimRef.current = m.st.aim;
        dispAimVelRef.current = m.st.aimVel || SB.AIM_VEL;
        return;
      }
      if (m.k === 'throw') {
        throwsRef.current.push({ by: m.by, angle: m.angle });
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
      const seed = (Date.now() >>> 0) ^ 0x50B0;
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

  const draw = useCallback((now) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    const st = stRef.current;
    if (!st) return;
    const t = now / 1000;
    const css = getComputedStyle(document.documentElement);
    const P1 = css.getPropertyValue('--p1').trim() || '#7FA8FF';
    const P2 = css.getPropertyValue('--p2').trim() || '#FF7FA8';
    const CANC = css.getPropertyValue('--candle').trim() || '#FFC66E';

    const bg = g.createRadialGradient(SB.CX, SB.CY, 40, SB.CX, SB.CY, 520);
    bg.addColorStop(0, '#2A2038');
    bg.addColorStop(0.55, '#1C1628');
    bg.addColorStop(1, '#120E1A');
    g.fillStyle = bg; g.fillRect(0, 0, SB.W, SB.H);

    for (const d of dustRef.current) {
      const a = d.a + t * d.s * 0.35;
      const x = SB.CX + Math.cos(a) * d.r;
      const y = SB.CY + Math.sin(a) * d.r * 0.92;
      g.globalAlpha = 0.15 + 0.2 * (0.5 + 0.5 * Math.sin(t * 2 + d.tw));
      g.fillStyle = CANC;
      g.beginPath(); g.arc(x, y, 1.2 + (d.s % 1), 0, 7); g.fill();
    }
    g.globalAlpha = 1;

    const clay = g.createRadialGradient(SB.CX - 20, SB.CY - 30, 20, SB.CX, SB.CY, RING_FRAME);
    clay.addColorStop(0, '#3A2E28');
    clay.addColorStop(0.7, '#2A221C');
    clay.addColorStop(1, '#1A1614');
    g.fillStyle = clay;
    g.beginPath(); g.arc(SB.CX, SB.CY, RING_FRAME, 0, 7); g.fill();

    const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
    g.strokeStyle = `rgba(242,237,247,${0.12 + pulse * 0.1})`;
    g.lineWidth = 3;
    g.beginPath(); g.arc(SB.CX, SB.CY, RING_FRAME, 0, 7); g.stroke();

    g.strokeStyle = `rgba(255,198,110,${0.1 + pulse * 0.08})`;
    g.lineWidth = 16;
    g.beginPath(); g.arc(SB.CX, SB.CY, SB.RING_R, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(242,237,247,.08)';
    g.lineWidth = 2;
    g.beginPath(); g.arc(SB.CX, SB.CY, SB.RING_R, 0, 7); g.stroke();

    g.setLineDash([8, 10]);
    g.strokeStyle = `rgba(255,198,110,${0.18 + pulse * 0.12})`;
    g.lineWidth = 2;
    g.beginPath(); g.arc(SB.CX, SB.CY, 52, 0, 7); g.stroke();
    g.setLineDash([]);

    const holder = st.phase === 'live' && !st.transit ? st.bombAt : null;

    for (let i = 0; i < SB.N_SUMOS; i++) {
      if (st.phase === 'boom' && st.boomIdx === i) continue;
      const pos = sumoPos(i);
      const bob = Math.sin(t * 3.2 + i * 0.9) * 2.2;
      const sx = pos.x, sy = pos.y + bob;
      const col = ownerOf(i) === 'A' ? P1 : P2;
      const mineHolding = holder === i && ownerOf(i) === meRef.current;

      g.fillStyle = 'rgba(0,0,0,.28)';
      g.beginPath(); g.ellipse(sx, pos.y + SB.SUMO_R - 2, SB.SUMO_R * 0.7, 6, 0, 0, 7); g.fill();

      if (mineHolding) {
        const hr = SB.SUMO_R + 12 + Math.sin(t * 8) * 3;
        g.fillStyle = 'rgba(255,198,110,.14)';
        g.beginPath(); g.arc(sx, sy, hr, 0, 7); g.fill();
        g.strokeStyle = `rgba(255,198,110,${0.35 + 0.25 * Math.sin(t * 8)})`;
        g.lineWidth = 2;
        g.beginPath(); g.arc(sx, sy, hr + 4, 0, 7); g.stroke();
      }

      g.fillStyle = col;
      g.beginPath(); g.arc(sx, sy, SB.SUMO_R, 0, 7); g.fill();
      g.fillStyle = '#F2C9A0';
      g.beginPath(); g.arc(sx, sy, SB.SUMO_R - 6, 0, 7); g.fill();
      g.strokeStyle = col; g.lineWidth = 5;
      g.beginPath(); g.arc(sx, sy + 4, SB.SUMO_R - 11, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke();
      g.fillStyle = '#2A2333';
      g.beginPath(); g.arc(sx, sy - (SB.SUMO_R - 12), 6, 0, 7); g.fill();
      const blink = Math.sin(t * 1.1 + i * 2) > 0.92;
      if (!blink) {
        g.fillStyle = '#2A2333';
        g.beginPath(); g.arc(sx - 6, sy - 4, 2.2, 0, 7); g.fill();
        g.beginPath(); g.arc(sx + 6, sy - 4, 2.2, 0, 7); g.fill();
      } else {
        g.strokeStyle = '#2A2333'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(sx - 8, sy - 4); g.lineTo(sx - 4, sy - 4); g.stroke();
        g.beginPath(); g.moveTo(sx + 4, sy - 4); g.lineTo(sx + 8, sy - 4); g.stroke();
      }
      g.fillStyle = 'rgba(255,127,168,.55)';
      g.beginPath(); g.arc(sx - 10, sy + 3, 2.6, 0, 7); g.fill();
      g.beginPath(); g.arc(sx + 10, sy + 3, 2.6, 0, 7); g.fill();
    }

    {
      const spin = st.phase === 'spin' ? st.phaseT * 9 : t * 0.55;
      g.save();
      g.translate(SB.CX, SB.CY);
      g.strokeStyle = `rgba(242,237,247,${0.4 + pulse * 0.2})`; g.lineWidth = 4;
      g.beginPath(); g.arc(0, 0, 42, 0, 7); g.stroke();
      g.fillStyle = 'rgba(255,198,110,.06)';
      g.beginPath(); g.arc(0, 0, 38, 0, 7); g.fill();
      g.rotate(spin);
      g.fillStyle = '#14141C';
      g.beginPath(); g.arc(0, 0, 26, 0, 7); g.fill();
      g.strokeStyle = '#3A3A46'; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, 26, 0, 7); g.stroke();
      g.fillStyle = '#3A3A46';
      g.fillRect(0, -6, 34, 12);
      g.fillStyle = CANC;
      g.globalAlpha = 0.35 + pulse * 0.3;
      g.beginPath(); g.arc(30, 0, 3, 0, 7); g.fill();
      g.globalAlpha = 1;
      g.restore();
    }

    if (holder != null) {
      const pos = sumoPos(holder);
      const bob = Math.sin(t * 3.2 + holder * 0.9) * 2.2;
      const own = ownerOf(holder);
      const mine = own === meRef.current;
      const a = mine && meRef.current === 'B' ? dispAimRef.current : st.aim;
      drawAimArrow(g, pos.x, pos.y + bob, a, mine, CANC);
    }

    let bx = null, by = null;
    if (st.transit) {
      const k = Math.min(1, st.transit.t / st.transit.dur);
      const kk = st.transit.miss ? Math.sin(k * Math.PI) : k;
      bx = st.transit.x0 + (st.transit.x1 - st.transit.x0) * (st.transit.miss ? kk : k);
      by = st.transit.y0 + (st.transit.y1 - st.transit.y0) * (st.transit.miss ? kk : k)
         - Math.sin(k * Math.PI) * 26;
    } else if (holder != null) {
      const pos = sumoPos(holder);
      const bob = Math.sin(t * 3.2 + holder * 0.9) * 2.2;
      bx = pos.x; by = pos.y + bob - SB.SUMO_R - 12;
    }
    if (bx != null && st.phase !== 'boom') {
      const urgency = st.phase === 'live' ? Math.min(1, st.fuseT / 12) : 0;
      const pulseB = 1 + Math.sin(st.fuseT * (5 + urgency * 12)) * 0.14 * (0.5 + urgency);
      g.save();
      g.translate(bx, by);
      g.scale(pulseB, pulseB);
      g.shadowColor = urgency > 0.5 ? '#FF8A8A' : CANC;
      g.shadowBlur = 8 + urgency * 14;
      g.fillStyle = '#14141C';
      g.beginPath(); g.arc(0, 0, 12, 0, 7); g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = '#34343F'; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, 12, 0, 7); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.22)';
      g.beginPath(); g.arc(-4, -4, 3, 0, 7); g.fill();
      g.strokeStyle = '#6B5A44'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(5, -9); g.quadraticCurveTo(10, -15, 14, -12); g.stroke();
      for (let s = 0; s < 4; s++) {
        const ang = t * 14 + s * 1.7;
        const rr = 2 + Math.sin(t * 20 + s) * 1.5;
        g.fillStyle = s % 2 ? CANC : '#FFF3D6';
        g.globalAlpha = 0.55 + 0.45 * Math.sin(t * 18 + s);
        g.beginPath();
        g.arc(14 + Math.cos(ang) * 2, -12 + Math.sin(ang) * 2, rr * 0.6, 0, 7);
        g.fill();
      }
      g.globalAlpha = 1;
      g.restore();
    }

    if (st.phase === 'boom' && st.boomIdx != null) {
      const pos = sumoPos(st.boomIdx);
      const k = Math.min(1, st.phaseT / SB.BOOM_T);
      const r1 = 14 + k * 90;
      g.globalAlpha = 1 - k;
      const grad = g.createRadialGradient(pos.x, pos.y, 4, pos.x, pos.y, r1);
      grad.addColorStop(0, '#FFF3D6');
      grad.addColorStop(0.4, CANC);
      grad.addColorStop(1, 'rgba(255,138,138,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(pos.x, pos.y, r1, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,198,110,.8)'; g.lineWidth = 3;
      g.beginPath(); g.arc(pos.x, pos.y, r1 * 1.2, 0, 7); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(0,0,0,.4)';
      g.beginPath(); g.arc(pos.x, pos.y, 20, 0, 7); g.fill();
    }
  }, []);

  useEffect(() => {
    if (phase !== 'game') return undefined;
    const isHost = meRef.current === 'A';
    let raf, last = performance.now();

    const net = setInterval(() => {
      if (!stRef.current || stRef.current.phase === 'over') return;
      if (isHost) rt?.send({ k: 'st', st: stRef.current });
    }, 50);

    const loop = now => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const st = stRef.current;
      if (!st) { raf = requestAnimationFrame(loop); return; }

      if (isHost) {
        const evs = throwsRef.current; throwsRef.current = [];
        const next = sbStep(st, evs, dt);
        stRef.current = next;
        if (next.phase === 'over' && next.winner && !finishedRef.current) {
          rt?.send({ k: 'st', st: next });
          rt?.send({ k: 'over', winner: next.winner });
          finish(next.winner, true);
        }
      } else {
        // Guest: mirror the host sweep between snapshots (same left↔right bounce).
        if (st.phase === 'live' && !st.transit && st.bombAt != null) {
          const center = st.aimCenter ?? st.aim;
          let vel = dispAimVelRef.current || SB.AIM_VEL;
          let aim = dispAimRef.current + vel * dt;
          const hi = center + SB.SWEEP_AMP;
          const lo = center - SB.SWEEP_AMP;
          if (aim >= hi) { aim = hi; vel = -Math.abs(SB.AIM_VEL); }
          else if (aim <= lo) { aim = lo; vel = Math.abs(SB.AIM_VEL); }
          dispAimRef.current = aim;
          dispAimVelRef.current = vel;
        }
        if (st.phase === 'over' && st.winner) finish(st.winner, false);
      }

      const s2 = stRef.current;
      setHud({
        a: s2.score.A, b: s2.score.B,
        round: Math.min(s2.round + 1, 5),
        holderSide: s2.phase === 'live' && s2.bombAt != null && !s2.transit ? ownerOf(s2.bombAt) : null
      });
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); clearInterval(net); };
  }, [phase, rt, finish, draw]);

  if (!me || phase === 'wait') {
    return <div className="sb-shell"><p className="sb-status">The dohyo is warming up…</p></div>;
  }

  const myBomb = hud.holderSide === me;

  return (
    <div className="sb-shell">
      <div className="sb-gamewrap">
        <div className="sb-hud">
          <span className="pA">{nm.A} <b>{hud.a}</b></span>
          <span className={'sb-holdmsg' + (myBomb ? ' mine' : '')}>
            {phase === 'done' ? `round ${hud.round}` :
              myBomb ? 'YOUR BOMB \u2014 TAP TO THROW' :
              hud.holderSide ? `${nm[hud.holderSide]} has it\u2026` :
              `round ${hud.round} of 5`}
          </span>
          <span className="pB"><b>{hud.b}</b> {nm.B}</span>
        </div>
        <div
          className="sb-canvaswrap sb-canvaswrap-alive"
          onPointerDown={e => { e.preventDefault(); fireThrow(); }}
          onContextMenu={e => e.preventDefault()}
        >
          <canvas ref={canvasRef} width={SB.W} height={SB.H} className="sb-canvas" />
        </div>

        {phase === 'done' && winner && (
          <div className="sb-done">
            <div className="sb-winline">{nm[winner]} wins the basho</div>
            <div className="sb-final">{hud.a} {'\u2013'} {hud.b}</div>
          </div>
        )}
      </div>
    </div>
  );
}
