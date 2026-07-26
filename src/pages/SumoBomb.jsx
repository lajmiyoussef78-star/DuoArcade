// src/pages/SumoBomb.jsx — Sumo Bomb (mounted by the sumobomb engine).
// Strict host authority for outcomes; guest predicts own throws instantly,
// then merges host `ev` without rewinding a landing.
// Aim arrow only for the local holder.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  recordSumoBomb, sbInitial, sbStep, SB, sumoPos, ownerOf, predictThrow
} from '../lib/sumobomb.js';
import '../styles/sumobomb.css';

const RING_FRAME = SB.RING_R + 52;
const TRAIL_MAX = 18;

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

function packSt(st, evSeq) {
  return {
    seed: st.seed,
    round: st.round,
    score: { A: st.score.A, B: st.score.B },
    phase: st.phase,
    phaseT: st.phaseT,
    bombAt: st.bombAt,
    transit: st.transit ? { ...st.transit } : null,
    aim: st.aim,
    aimCenter: st.aimCenter,
    aimVel: st.aimVel,
    fuse: st.fuse,
    fuseT: st.fuseT,
    boomIdx: st.boomIdx,
    pendingBoom: st.pendingBoom,
    winner: st.winner,
    target0: st.target0,
    evSeq
  };
}

/**
 * Guest visual tick: animate flight + own aim.
 * May complete a predicted catch locally for snappy UX; host `ev` still wins on conflict.
 */
function guestVisualTick(st, dt, me) {
  if (!st || st.phase === 'over') return st;
  const s = st;
  s.phaseT = (s.phaseT || 0) + dt;
  if (s.phase === 'live') s.fuseT = (s.fuseT || 0) + dt;

  if (s.transit) {
    s.transit.t = (s.transit.t || 0) + dt;
    if (s.transit.t >= s.transit.dur) {
      const arrived = s.transit.toIdx;
      const wasMiss = s.transit.miss;
      s.transit = null;
      s.bombAt = arrived;
      // Don't explode locally — host decides boom.
      if (!wasMiss) {
        // Aim resets when host confirms; keep a facing until then.
        const p = sumoPos(arrived);
        s.aimCenter = Math.atan2(SB.CY - p.y, SB.CX - p.x);
        s.aim = s.aimCenter;
        s.aimVel = SB.AIM_VEL;
      }
    }
    return s;
  }

  if (s.phase === 'live' && s.bombAt != null && ownerOf(s.bombAt) === me) {
    const center = s.aimCenter ?? s.aim;
    let vel = s.aimVel || SB.AIM_VEL;
    let aim = s.aim + vel * dt;
    const hi = center + SB.SWEEP_AMP;
    const lo = center - SB.SWEEP_AMP;
    if (aim >= hi) { aim = hi; vel = -Math.abs(SB.AIM_VEL); }
    else if (aim <= lo) { aim = lo; vel = Math.abs(SB.AIM_VEL); }
    s.aim = aim;
    s.aimVel = vel;
  }
  return s;
}

/** Merge host throw state onto a predicted flight without replaying from t=0. */
function mergeThrowEv(local, remote) {
  if (!local) return remote;

  // Local already caught at host's flight target — keep landed, sync fuse.
  if (
    !local.transit && remote.transit
    && local.phase === 'live'
    && local.bombAt === remote.transit.toIdx
  ) {
    return {
      ...local,
      fuseT: remote.fuseT,
      fuse: remote.fuse,
      pendingBoom: remote.pendingBoom,
      score: remote.score,
      evSeq: remote.evSeq
    };
  }

  // Same flight — keep further progress.
  if (
    local.transit && remote.transit
    && local.transit.toIdx === remote.transit.toIdx
    && !!local.transit.miss === !!remote.transit.miss
  ) {
    const t = Math.max(local.transit.t || 0, remote.transit.t || 0);
    return {
      ...remote,
      transit: { ...remote.transit, t },
      aim: local.aim,
      aimVel: local.aimVel,
      aimCenter: local.aimCenter
    };
  }

  // Host already landed where we were flying — snap forward.
  if (
    local.transit && !remote.transit
    && remote.bombAt === local.transit.toIdx
  ) {
    return remote;
  }

  // Local landed from prediction; host still shows old pad — keep local.
  if (
    !local.transit && !remote.transit
    && local.bombAt != null
    && remote.bombAt != null
    && local.bombAt !== remote.bombAt
    && remote.phase === 'live'
  ) {
    // Prefer host only if scores/round advanced (real authority event).
    if (
      remote.round === local.round
      && remote.score.A === local.score.A
      && remote.score.B === local.score.B
    ) {
      return {
        ...local,
        fuseT: remote.fuseT,
        fuse: remote.fuse,
        evSeq: remote.evSeq
      };
    }
  }

  return remote;
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
  const dustRef = useRef(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const phaseRef = useRef('wait');
  const throwIdRef = useRef(0);
  const seenThrowsRef = useRef(new Set());
  const evSeqRef = useRef(0);
  const pendingTryRef = useRef(null); // guest waiting for host confirm { id, t }
  const lastThrowAtRef = useRef(0);
  const trailRef = useRef([]);
  const localAimRef = useRef(null); // preserve guest aim across host adopts
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
    trailRef.current = [];
    throwIdRef.current = 0;
    evSeqRef.current = 0;
    pendingTryRef.current = null;
    localAimRef.current = null;
    seenThrowsRef.current = new Set();
    setWinner(null);
    setPhase('game');
  }, []);

  /** Host: authoritative state after throw / land / phase change. */
  const pushEv = useCallback((st, throwMeta) => {
    if (!st || meRef.current !== 'A') return;
    evSeqRef.current += 1;
    const seq = evSeqRef.current;
    // packSt is a plain snapshot — safe for retries (sync.js also deep-clones).
    const msg = {
      k: 'ev',
      seq,
      id: throwMeta?.id || null,
      by: throwMeta?.by || null,
      angle: throwMeta?.angle,
      st: packSt(st, seq)
    };
    rt?.send(msg);
    setTimeout(() => rt?.send(msg), 120);
    setTimeout(() => rt?.send(msg), 320);
  }, [rt]);

  const pushClk = useCallback(() => {
    const st = stRef.current;
    if (!st || meRef.current !== 'A' || st.phase === 'over') return;
    rt?.send({
      k: 'clk',
      seq: evSeqRef.current,
      fuseT: st.fuseT,
      fuse: st.fuse,
      phaseT: st.phaseT,
      phase: st.phase,
      bombAt: st.bombAt,
      transitT: st.transit ? st.transit.t : null,
      aim: st.aim,
      aimVel: st.aimVel,
      aimCenter: st.aimCenter
    });
  }, [rt]);

  const queueThrow = useCallback((by, angle, id) => {
    if (!id || seenThrowsRef.current.has(id)) return false;
    seenThrowsRef.current.add(id);
    throwsRef.current.push({ by, angle, id });
    return true;
  }, []);

  const fireThrow = useCallback(() => {
    const st = stRef.current;
    if (!st || phaseRef.current !== 'game') return;
    if (st.phase !== 'live' || st.transit || st.bombAt == null) return;
    if (ownerOf(st.bombAt) !== meRef.current) return;
    if (pendingTryRef.current) return;
    const now = performance.now();
    if (now - lastThrowAtRef.current < 160) return;
    lastThrowAtRef.current = now;

    const angle = st.aim;
    const from = st.bombAt;
    throwIdRef.current += 1;
    const id = `${meRef.current}-${throwIdRef.current}-${Math.floor(st.fuseT * 1000)}`;

    if (meRef.current === 'A') {
      queueThrow('A', angle, id);
      return;
    }

    // Guest: predict instantly, host confirms in background.
    const predicted = predictThrow(st, angle);
    if (!predicted) return;
    trailRef.current = [];
    stRef.current = predicted;
    localAimRef.current = null;
    pendingTryRef.current = { id, t: now, from, to: predicted.transit?.toIdx, angle };
    const msg = { k: 'try', by: 'B', angle, id };
    rt?.send(msg);
    setTimeout(() => rt?.send(msg), 120);
    setTimeout(() => rt?.send(msg), 320);
  }, [rt, queueThrow]);

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
          pushEv(stRef.current, null);
        }
        return;
      }

      if (m.k === 'start') {
        begin(m.seed ?? ((Date.now() >>> 0) ^ 0x50B0));
        return;
      }

      if (m.k === 'try') {
        if (meRef.current !== 'A' || m.by !== 'B') return;
        queueThrow('B', m.angle, m.id || `B-x-${Date.now()}`);
        return;
      }

      if (m.k === 'ev') {
        if (meRef.current === 'A' || !m.st) return;
        const seq = typeof m.seq === 'number' ? m.seq : -1;
        if (seq >= 0 && seq <= evSeqRef.current && startedRef.current) return;

        if (!startedRef.current) {
          startedRef.current = true;
          finishedRef.current = false;
          setWinner(null);
          setPhase('game');
        }

        const remote = { ...m.st, evSeq: seq >= 0 ? seq : m.st.evSeq };
        const pending = pendingTryRef.current;
        const confirmsPending = pending && (m.id === pending.id || (m.by === 'B' && remote.transit));

        // Ignore stale host state that puts the bomb back on the pad we threw from.
        if (
          pending
          && remote.bombAt === pending.from
          && !remote.transit
          && !confirmsPending
        ) {
          evSeqRef.current = Math.max(evSeqRef.current, seq);
          return;
        }

        // Clear pending only on a confirming throw/slide ev — not on unrelated phase noise.
        if (pending && (m.id === pending.id || (remote.transit && m.by === 'B')
          || (remote.bombAt != null && remote.bombAt === pending.to && !remote.transit))) {
          pendingTryRef.current = null;
        }
        if (m.id) seenThrowsRef.current.add(m.id);

        const merged = mergeThrowEv(stRef.current, remote);
        // Keep our aim sweep when we still hold the same sumo after merge.
        if (
          localAimRef.current
          && merged.phase === 'live'
          && merged.bombAt != null
          && !merged.transit
          && ownerOf(merged.bombAt) === meRef.current
          && stRef.current?.bombAt === merged.bombAt
        ) {
          merged.aim = localAimRef.current.aim;
          merged.aimVel = localAimRef.current.aimVel;
          merged.aimCenter = localAimRef.current.aimCenter ?? merged.aimCenter;
        }
        const keepTrail = !!(stRef.current?.transit && merged.transit);
        if (!keepTrail && !!stRef.current?.transit !== !!merged.transit) {
          trailRef.current = [];
        }
        stRef.current = merged;
        if (typeof merged.evSeq === 'number') evSeqRef.current = merged.evSeq;

        if (merged.phase === 'over' && merged.winner) finish(merged.winner, false);
        return;
      }

      if (m.k === 'clk') {
        if (meRef.current === 'A') return;
        if (!startedRef.current || !stRef.current) return;
        if ((m.seq ?? 0) < evSeqRef.current) return;
        if (pendingTryRef.current) return;

        const s = stRef.current;
        // Fuse / timers only — never move the bomb from a clock packet.
        if (m.phase === s.phase && m.bombAt === s.bombAt && !!s.transit === (m.transitT != null)) {
          if (typeof m.fuseT === 'number') s.fuseT = m.fuseT;
          if (typeof m.fuse === 'number') s.fuse = m.fuse;
          if (typeof m.phaseT === 'number') s.phaseT = m.phaseT;
          if (s.transit && typeof m.transitT === 'number') {
            s.transit.t = Math.max(s.transit.t || 0, m.transitT);
          }
          const holder = s.bombAt != null && !s.transit ? ownerOf(s.bombAt) : null;
          if (holder && holder !== meRef.current) {
            if (typeof m.aim === 'number') s.aim = m.aim;
            if (typeof m.aimVel === 'number') s.aimVel = m.aimVel;
            if (m.aimCenter != null) s.aimCenter = m.aimCenter;
          }
        }
        return;
      }

      if (m.k === 'aim') {
        if (meRef.current !== 'A') return;
        const st = stRef.current;
        if (!st || st.phase !== 'live' || st.transit || st.bombAt == null) return;
        if (ownerOf(st.bombAt) !== 'B') return;
        st.aim = m.aim;
        st.aimVel = m.aimVel;
        if (m.aimCenter != null) st.aimCenter = m.aimCenter;
        return;
      }

      if (m.k === 'over') finish(m.winner, false);
    });
    return undefined;
  }, [rt, begin, finish, pushEv, queueThrow]);

  useEffect(() => {
    let cancelled = false;
    const timers = [];
    let askIv = null;
    (async () => {
      let ok = false;
      try { ok = await rt?.whenReady?.(); } catch { /* */ }
      if (cancelled) return;
      // If channel still not ready, keep waiting briefly — do not soft-start blind.
      if (!ok && !rt?.isReady?.()) {
        for (let i = 0; i < 20 && !cancelled; i++) {
          await new Promise(r => setTimeout(r, 250));
          if (rt?.isReady?.()) { ok = true; break; }
        }
      }
      if (cancelled) return;
      if (me === 'A') {
        const seed = (Date.now() >>> 0) ^ 0x50B0;
        const push = () => {
          rt?.send({ k: 'start', seed });
          if (stRef.current) pushEv(stRef.current, null);
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
  }, [me, rt, begin, pushEv]);

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

    if (holder != null && ownerOf(holder) === meRef.current) {
      const pos = sumoPos(holder);
      const bob = Math.sin(t * 3.2 + holder * 0.9) * 2.2;
      drawAimArrow(g, pos.x, pos.y + bob, st.aim, true, CANC);
    }

    let bx = null, by = null;
    if (st.transit) {
      const k = Math.min(1, st.transit.t / st.transit.dur);
      const kk = st.transit.miss ? Math.sin(k * Math.PI) : k;
      bx = st.transit.x0 + (st.transit.x1 - st.transit.x0) * (st.transit.miss ? kk : k);
      by = st.transit.y0 + (st.transit.y1 - st.transit.y0) * (st.transit.miss ? kk : k)
         - Math.sin(k * Math.PI) * 34;
      const trail = trailRef.current;
      const last = trail[trail.length - 1];
      if (!last || Math.hypot(bx - last.x, by - last.y) > 4) {
        trail.push({ x: bx, y: by, born: now });
        if (trail.length > TRAIL_MAX) trail.shift();
      }
    } else {
      trailRef.current = [];
      if (holder != null) {
        const pos = sumoPos(holder);
        const bob = Math.sin(t * 3.2 + holder * 0.9) * 2.2;
        bx = pos.x; by = pos.y + bob - SB.SUMO_R - 12;
      }
    }

    if (trailRef.current.length > 1 && st.phase !== 'boom') {
      const trail = trailRef.current;
      g.save();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (let i = 1; i < trail.length; i++) {
        const a = i / (trail.length - 1);
        const p0 = trail[i - 1], p1 = trail[i];
        g.strokeStyle = `rgba(255,198,110,${0.12 + a * 0.55})`;
        g.lineWidth = 2 + a * 7;
        g.beginPath();
        g.moveTo(p0.x, p0.y);
        g.lineTo(p1.x, p1.y);
        g.stroke();
      }
      for (let i = 0; i < trail.length; i++) {
        const a = (i + 1) / trail.length;
        const p = trail[i];
        g.fillStyle = i % 2 ? CANC : '#FFF3D6';
        g.globalAlpha = 0.25 + a * 0.55;
        g.beginPath();
        g.arc(p.x, p.y, 2 + a * 4.5, 0, 7);
        g.fill();
      }
      g.globalAlpha = 1;
      g.restore();
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
    let prevPhase = stRef.current?.phase || '';
    let prevTransit = !!stRef.current?.transit;
    let clkAcc = 0;
    let aimAcc = 0;

    const loop = now => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const st = stRef.current;
      if (!st) { raf = requestAnimationFrame(loop); return; }

      let next;
      if (isHost) {
        const holderNow = st.phase === 'live' && st.bombAt != null && !st.transit
          ? ownerOf(st.bombAt) : null;
        const sweep = !holderNow || holderNow === 'A';
        const evs = throwsRef.current; throwsRef.current = [];
        next = sbStep(st, evs, dt, { sweep, authority: true });
        stRef.current = next;

        const threw = evs.length && next.transit && !st.transit;
        const landed = prevTransit && !next.transit && next.phase === 'live';
        const phaseChanged = next.phase !== prevPhase;

        if (threw) {
          const th = evs[0];
          pushEv(next, { id: th.id, by: th.by, angle: th.angle });
        } else if (landed || phaseChanged) {
          pushEv(next, null);
        }

        prevPhase = next.phase;
        prevTransit = !!next.transit;

        clkAcc += dt;
        if (clkAcc >= 0.3 && next.phase !== 'over') {
          clkAcc = 0;
          pushClk();
        }

        if (next.phase === 'over' && next.winner && !finishedRef.current) {
          pushEv(next, null);
          rt?.send({ k: 'over', winner: next.winner });
          finish(next.winner, true);
        }
      } else {
        // Guest: visual-only. Bomb holder only changes via host `ev`.
        next = guestVisualTick(st, dt, meRef.current);
        stRef.current = next;

        const hold = next.phase === 'live' && next.bombAt != null && !next.transit
          && ownerOf(next.bombAt) === 'B';
        if (hold) {
          localAimRef.current = {
            aim: next.aim, aimVel: next.aimVel, aimCenter: next.aimCenter
          };
          aimAcc += dt;
          if (aimAcc >= 0.1) {
            aimAcc = 0;
            rt?.send({
              k: 'aim',
              aim: next.aim,
              aimVel: next.aimVel,
              aimCenter: next.aimCenter
            });
          }
        } else {
          aimAcc = 0;
          if (!hold) localAimRef.current = null;
        }

        // Pending too long: ask host for a fresh ev; do not silently unlock into a rewind.
        const pending = pendingTryRef.current;
        if (pending) {
          const age = now - pending.t;
          if (age > 1800 && age < 2000) rt?.send({ k: 'needstart' });
          if (age > 5000) {
            // Last resort — re-send try, keep prediction on screen.
            const retry = {
              k: 'try', by: 'B',
              angle: pending.angle ?? next.aim,
              id: pending.id
            };
            rt?.send(retry);
            pending.t = now;
          }
        }
      }

      setHud({
        a: next.score.A, b: next.score.B,
        round: Math.min(next.round + 1, 5),
        holderSide: next.phase === 'live' && next.bombAt != null && !next.transit
          ? ownerOf(next.bombAt) : null
      });
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); };
  }, [phase, rt, finish, draw, pushEv, pushClk]);

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
