// src/pages/NightCurling.jsx — mounted by the nightcurling engine.
//
// Host-authoritative: A sims physics; broadcasts on events + light slide ticks
// (not a 20Hz flood — that froze guests). Guest predicts own throws; B sends
// throw/sweep. Aiming is local until release.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ncInitial, throwStone, sweepTap, ncStep, nextEnd, NC
} from '../lib/nightcurling.js';
import '../styles/nightcurling.css';

const SPECKS = Array.from({ length: 90 }, (_, i) => ({
  x: ((i * 733) % 880) + 10,
  y: ((i * 397) % 540) + 10,
  a: 0.04 + ((i * 61) % 10) / 100
}));

function drawStone(g, x, y, side, P1, P2, { ghost = false, moving = false } = {}) {
  const col = side === 'A' ? P1 : P2;
  if (moving) {
    g.fillStyle = side === 'A' ? 'rgba(127,168,255,.12)' : 'rgba(255,127,168,.12)';
    g.beginPath(); g.arc(x, y, NC.STONE_R + 8, 0, 7); g.fill();
  }
  g.globalAlpha = ghost ? 0.72 : 1;
  const grad = g.createRadialGradient(x - 5, y - 6, 3, x, y, NC.STONE_R);
  grad.addColorStop(0, '#5A5566');
  grad.addColorStop(0.55, '#37333F');
  grad.addColorStop(1, '#232029');
  g.fillStyle = grad;
  g.beginPath(); g.arc(x, y, NC.STONE_R, 0, 7); g.fill();
  g.strokeStyle = col; g.lineWidth = 4.5; g.lineCap = 'round';
  g.beginPath(); g.arc(x, y, NC.STONE_R - 6, -2.3, -0.85); g.stroke();
  g.lineCap = 'butt';
  g.globalAlpha = 1;
}

function cloneSt(st) {
  return JSON.parse(JSON.stringify(st));
}

/** Advance a snapshot by `age` seconds (capped) for smooth guest rendering. */
function extrapolateSlide(snapshot, ageSec) {
  if (!snapshot) return snapshot;
  if (snapshot.phase !== 'slide') return cloneSt(snapshot);
  let s = cloneSt(snapshot);
  // Cap high enough for normal RTT; host burst (~20Hz for 0.5s) keeps snaps fresh.
  let left = Math.max(0, Math.min(ageSec, 0.45));
  while (left > 0 && s.phase === 'slide') {
    const step = Math.min(0.016, left);
    s = ncStep(s, step);
    left -= step;
  }
  return s;
}

function stoneProgress(stn) {
  if (!stn) return 0;
  return Math.hypot(stn.x - NC.START.x, stn.y - NC.START.y);
}

export default function NightCurling({ myRole, names = {}, rt, onComplete }) {
  const me = myRole;
  const nm = { A: names.A || 'A', B: names.B || 'B' };
  const opp = me === 'A' ? 'B' : 'A';

  const [phase, setPhase] = useState('wait'); // wait | game | done
  const [hud, setHud] = useState({
    a: 0, b: 0, end: 1, thrower: 'A',
    left: { A: NC.STONES_EACH, B: NC.STONES_EACH }, sub: 'aim', hammer: 'B'
  });
  const [curl, setCurl] = useState(0);
  const [winner, setWinner] = useState(null);
  const [endMsg, setEndMsg] = useState(null);

  const canvasRef = useRef(null);
  const meRef = useRef(me);
  const stRef = useRef(null);
  const curlRef = useRef(0);
  const dragRef = useRef(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const phaseRef = useRef('wait');
  const endMsgRef = useRef(null);
  const namesRef = useRef(nm);
  const throwIdRef = useRef(0);
  const seenThrowsRef = useRef(new Set());
  const pendingThrowRef = useRef(null);
  const stSeqRef = useRef(0);
  const lastStSeqRef = useRef(-1);
  /** Latest host snapshot + time received — guest renders from this only (no rewind). */
  const hostSnapRef = useRef(null);
  const hostSnapAtRef = useRef(0);
  meRef.current = me;
  curlRef.current = curl;
  phaseRef.current = phase;
  endMsgRef.current = endMsg;
  namesRef.current = nm;

  const finish = useCallback((w, iRecord) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setWinner(w);
    setPhase('done');
    if (iRecord) onComplete?.(w);
  }, [onComplete]);

  const begin = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    finishedRef.current = false;
    stRef.current = ncInitial();
    seenThrowsRef.current = new Set();
    pendingThrowRef.current = null;
    throwIdRef.current = 0;
    stSeqRef.current = 0;
    lastStSeqRef.current = -1;
    hostSnapRef.current = null;
    hostSnapAtRef.current = 0;
    setWinner(null);
    setEndMsg(null);
    setCurl(0);
    setPhase('game');
  }, []);

  /** Host → both: authoritative state (event + light slide ticks, not a flood). */
  const pushSt = useCallback((force = false) => {
    const st = stRef.current;
    if (!st || meRef.current !== 'A') return;
    if (!force && st.phase === 'over') return;
    stSeqRef.current += 1;
    // Deep-clone so retries don't send a mutated live object.
    const msg = { k: 'st', seq: stSeqRef.current, st: cloneSt(st) };
    rt?.send(msg);
    if (force) {
      setTimeout(() => rt?.send(msg), 120);
      setTimeout(() => rt?.send(msg), 280);
    }
  }, [rt]);

  const throwBurstRef = useRef(0);

  const hostThrow = useCallback((by, angle, power, c, id) => {
    if (meRef.current !== 'A' || !stRef.current) return false;
    if (id && seenThrowsRef.current.has(id)) return false;
    if (id) seenThrowsRef.current.add(id);
    const next = throwStone(stRef.current, by, angle, power, c);
    if (next.error) return false;
    stRef.current = next;
    throwBurstRef.current = 0.55; // ~20Hz host ticks for half a second
    pushSt(true);
    return true;
  }, [pushSt]);

  const hostSweep = useCallback(() => {
    if (meRef.current !== 'A' || !stRef.current) return;
    stRef.current = sweepTap(stRef.current);
    pushSt(false);
  }, [pushSt]);

  const hostNextEnd = useCallback((broadcast) => {
    if (meRef.current === 'A' && stRef.current) {
      stRef.current = nextEnd(stRef.current);
      pushSt(true);
    }
    if (broadcast) {
      const payload = { k: 'nextEnd', by: meRef.current };
      rt?.send(payload);
      setTimeout(() => rt?.send(payload), 180);
    }
    setEndMsg(null);
  }, [rt, pushSt]);

  const myThrowNow = useCallback((angle, power) => {
    const c = curlRef.current;
    throwIdRef.current += 1;
    const id = `${meRef.current}-${throwIdRef.current}`;

    if (meRef.current === 'A') {
      hostThrow('A', angle, power, c, id);
      return;
    }

    // Guest: predict until the first host slide snapshot arrives.
    const st = stRef.current;
    if (!st) return;
    const predicted = throwStone(st, 'B', angle, power, c);
    if (!predicted.error) {
      const snap = cloneSt(predicted);
      stRef.current = snap;
      hostSnapRef.current = null; // ignore older host aim snaps
      hostSnapAtRef.current = 0;
      pendingThrowRef.current = { id, t: performance.now(), snap, angle, power, curl: c };
    }
    const payload = { k: 'throw', by: 'B', angle, power, curl: c, id };
    rt?.send(payload);
    setTimeout(() => rt?.send(payload), 120);
    setTimeout(() => rt?.send(payload), 320);
  }, [hostThrow, rt]);

  const mySweep = useCallback(() => {
    const st = stRef.current;
    if (!st || st.phase !== 'slide') return;
    const active = st.stones.find(x => x.id === st.activeId);
    if (!active || active.side !== meRef.current) return;
    if (meRef.current === 'A') hostSweep();
    else {
      // Local sweep feedback on the host snapshot we render from.
      if (hostSnapRef.current) {
        hostSnapRef.current = sweepTap(hostSnapRef.current);
        hostSnapAtRef.current = performance.now();
        stRef.current = cloneSt(hostSnapRef.current);
      } else {
        stRef.current = sweepTap(st);
      }
      const payload = { k: 'sweep' };
      rt?.send(payload);
      setTimeout(() => rt?.send(payload), 120);
    }
  }, [hostSweep, rt]);

  useEffect(() => {
    const key = e => { if (e.key === ' ') { e.preventDefault(); mySweep(); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [mySweep]);

  useEffect(() => {
    if (!rt?.on) return undefined;
    rt.on(m => {
      if (!m?.k) return;
      if (m.k === 'needstart') {
        if (meRef.current === 'A' && startedRef.current && stRef.current) {
          rt.send({ k: 'start' });
          pushSt(true);
        }
        return;
      }
      if (m.k === 'start') {
        begin();
        return;
      }
      if (m.k === 'st') {
        if (meRef.current === 'A' || !m.st) return;
        const seq = typeof m.seq === 'number' ? m.seq : lastStSeqRef.current + 1;
        if (seq <= lastStSeqRef.current) return;
        lastStSeqRef.current = seq;

        if (!startedRef.current) begin();

        const local = stRef.current;
        const remote = m.st;
        const pending = pendingThrowRef.current;

        // Still waiting for host to accept our throw — ignore aim snapshots.
        if (
          pending
          && remote.phase === 'aim'
          && performance.now() - pending.t < 2000
        ) {
          return;
        }

        // Host confirmed the slide — take authority snapshot (never raw-overwrite
        // with a stone that is behind what we already showed).
        if (remote.phase === 'slide' && local?.phase === 'slide') {
          const rActive = remote.stones.find(s => s.id === remote.activeId);
          const lActive = local.stones.find(s => s.id === local.activeId)
            || local.stones.find(s => s.side === rActive?.side && Math.hypot(s.vx, s.vy) > 2);
          if (
            rActive && lActive
            && stoneProgress(lActive) > stoneProgress(rActive) + 14
          ) {
            // Keep rendering ahead via pending/local extrapolate; store host snap
            // but bump positions forward so we don't jump back.
            const fixed = cloneSt(remote);
            const fi = fixed.stones.findIndex(s => s.id === fixed.activeId);
            if (fi >= 0) {
              fixed.stones[fi] = {
                ...fixed.stones[fi],
                x: lActive.x,
                y: lActive.y,
                vx: lActive.vx,
                vy: lActive.vy
              };
            }
            hostSnapRef.current = fixed;
            hostSnapAtRef.current = performance.now();
            pendingThrowRef.current = null;
            stRef.current = fixed;
            return;
          }
        }

        if (pending && remote.phase === 'slide') pendingThrowRef.current = null;
        hostSnapRef.current = cloneSt(remote);
        hostSnapAtRef.current = performance.now();
        stRef.current = hostSnapRef.current;
        return;
      }
      if (m.k === 'throw') {
        if (meRef.current === 'A') hostThrow(m.by, m.angle, m.power, m.curl, m.id);
        return;
      }
      if (m.k === 'sweep') {
        if (meRef.current === 'A') hostSweep();
        return;
      }
      if (m.k === 'nextEnd') {
        if (m.by === meRef.current) return;
        hostNextEnd(false);
        return;
      }
      if (m.k === 'over') {
        finish(m.winner, false);
      }
    });
    return undefined;
  }, [rt, begin, hostThrow, hostSweep, hostNextEnd, finish, pushSt]);

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
        const push = () => {
          rt?.send({ k: 'start' });
          pushSt(true);
        };
        begin();
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

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    const st = stRef.current;
    if (!st) return;
    const css = getComputedStyle(document.documentElement);
    const P1 = css.getPropertyValue('--p1').trim() || '#7FA8FF';
    const P2 = css.getPropertyValue('--p2').trim() || '#FF7FA8';
    const CANC = css.getPropertyValue('--candle').trim() || '#FFC66E';

    const bg = g.createLinearGradient(0, 0, 0, NC.H);
    bg.addColorStop(0, '#1B2436'); bg.addColorStop(0.5, '#16202F'); bg.addColorStop(1, '#121A28');
    g.fillStyle = bg; g.fillRect(0, 0, NC.W, NC.H);
    for (const sp of SPECKS) {
      g.fillStyle = `rgba(220,235,245,${sp.a})`;
      g.fillRect(sp.x, sp.y, 2, 2);
    }
    g.strokeStyle = 'rgba(61,52,80,.9)'; g.lineWidth = 4;
    g.strokeRect(2, 2, NC.W - 4, NC.H - 4);
    g.setLineDash([14, 10]);
    g.strokeStyle = 'rgba(255,138,138,.5)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(NC.HOG_X, 8); g.lineTo(NC.HOG_X, NC.H - 8); g.stroke();
    g.setLineDash([]);
    const ringCols = ['rgba(127,168,255,.22)', 'rgba(23,32,47,.9)', 'rgba(255,127,168,.25)', 'rgba(255,198,110,.9)'];
    NC.RINGS.forEach((r, i) => {
      g.fillStyle = ringCols[i];
      g.beginPath(); g.arc(NC.BUTTON.x, NC.BUTTON.y, r, 0, 7); g.fill();
      g.strokeStyle = 'rgba(242,237,247,.25)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(NC.BUTTON.x, NC.BUTTON.y, r, 0, 7); g.stroke();
    });
    g.strokeStyle = 'rgba(242,237,247,.08)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(10, NC.START.y); g.lineTo(NC.W - 10, NC.START.y); g.stroke();

    const d = dragRef.current;
    const aiming = st.phase === 'aim' && st.thrower === meRef.current;

    // Ready stone at the hack — visible before you pull back.
    if (st.phase === 'aim' && st.thrower) {
      drawStone(g, NC.START.x, NC.START.y, st.thrower, P1, P2, {
        ghost: st.thrower !== meRef.current
      });
      // Soft pulse under the stone about to go
      if (st.thrower === meRef.current) {
        const pulse = 0.35 + 0.25 * Math.sin(performance.now() / 220);
        g.strokeStyle = `rgba(255,198,110,${pulse})`;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(NC.START.x, NC.START.y, NC.STONE_R + 7, 0, 7);
        g.stroke();
      }
    }

    if (d && aiming) {
      const dx = d.x0 - d.x1, dy = d.y0 - d.y1;
      const len = Math.hypot(dx, dy);
      if (len > 8) {
        const angle = Math.atan2(dy, dx);
        const power = Math.min(1, len / 260);
        g.setLineDash([4, 10]);
        g.strokeStyle = 'rgba(255,198,110,.55)'; g.lineWidth = 3;
        g.beginPath();
        g.moveTo(NC.START.x, NC.START.y);
        g.lineTo(
          NC.START.x + Math.cos(angle) * (180 + power * 420),
          NC.START.y + Math.sin(angle) * (180 + power * 420)
        );
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = 'rgba(21,17,30,.75)';
        g.fillRect(20, NC.H - 34, 150, 16);
        g.fillStyle = CANC;
        g.fillRect(22, NC.H - 32, 146 * power, 12);
      }
    }

    for (const stn of st.stones) {
      const moving = Math.hypot(stn.vx, stn.vy) > 2;
      drawStone(g, stn.x, stn.y, stn.side, P1, P2, { moving });
      if (stn.id === st.activeId && st.sweepT > 0 && moving) {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + st.sweepT * 20;
          g.fillStyle = 'rgba(220,235,245,.6)';
          g.fillRect(stn.x - 22 + Math.cos(a) * 6, stn.y + Math.sin(a) * 10, 2.5, 2.5);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (phase !== 'game' && phase !== 'done') return undefined;
    const isHost = meRef.current === 'A';
    let raf, last = performance.now();
    let prevPhase = stRef.current?.phase || '';
    let slideAcc = 0;

    // ~10Hz during slide; ~20Hz burst for ~0.55s after each throw.
    const SLIDE_EVERY = 0.1;
    const BURST_EVERY = 0.05;

    const loop = now => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const st = stRef.current;
      if (st) {
        if (isHost && st.phase === 'slide') {
          const next = ncStep(st, dt);
          stRef.current = next;
          if (next.phase !== prevPhase) {
            prevPhase = next.phase;
            pushSt(true);
            throwBurstRef.current = Math.max(throwBurstRef.current, 0.55);
          } else {
            slideAcc += dt;
            const bursting = throwBurstRef.current > 0;
            if (bursting) throwBurstRef.current -= dt;
            const every = bursting ? BURST_EVERY : SLIDE_EVERY;
            if (slideAcc >= every) {
              slideAcc = 0;
              pushSt(false);
            }
          }
          if (next.phase === 'over' && next.winner && !finishedRef.current) {
            pushSt(true);
            rt?.send({ k: 'over', winner: next.winner });
            finish(next.winner, true);
          }
        } else if (isHost && st.phase !== prevPhase) {
          prevPhase = st.phase;
          pushSt(true);
        }

        // Guest: NEVER free-sim ahead of host (that caused go→back→go).
        // Render = latest host snapshot extrapolated by packet age only.
        // While our throw is pending, extrapolate the local predict snap instead.
        if (!isHost) {
          const pending = pendingThrowRef.current;
          if (pending?.snap && !hostSnapRef.current) {
            const age = (now - pending.t) / 1000;
            stRef.current = extrapolateSlide(pending.snap, age);
            // Re-send throw if host never confirmed.
            if (age > 1.8 && age < 2.0) {
              rt?.send({
                k: 'throw', by: 'B',
                angle: pending.angle,
                power: pending.power,
                curl: pending.curl,
                id: pending.id
              });
            }
          } else if (hostSnapRef.current) {
            const age = (now - hostSnapAtRef.current) / 1000;
            stRef.current = extrapolateSlide(hostSnapRef.current, age);
          }
        }

        const s2 = stRef.current;
        if (!s2) { raf = requestAnimationFrame(loop); return; }
        setHud({
          a: s2.score.A, b: s2.score.B, end: s2.end + 1,
          thrower: s2.thrower,
          left: { A: NC.STONES_EACH - s2.thrown.A, B: NC.STONES_EACH - s2.thrown.B },
          sub: s2.phase,
          hammer: s2.hammer
        });
        if (s2.phase === 'endOver' && s2.lastEnd && !endMsgRef.current) {
          const n = namesRef.current;
          setEndMsg(s2.lastEnd.blank
            ? 'Blank end — nobody in the house. Hammer stays.'
            : `${n[s2.lastEnd.side]} takes ${s2.lastEnd.pts} — hammer passes.`);
        }
        if (!isHost && s2.phase === 'over' && s2.winner) finish(s2.winner, false);
        draw();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); };
  }, [phase, rt, finish, draw, pushSt]);

  const canvasPos = e => {
    const cv = canvasRef.current;
    const r = cv.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (NC.W / r.width),
      y: (e.clientY - r.top) * (NC.H / r.height)
    };
  };
  const myTurn = () => {
    const st = stRef.current;
    return st && st.phase === 'aim' && st.thrower === meRef.current;
  };
  function aimStart(e) {
    if (!myTurn()) return;
    e.preventDefault();
    const p = canvasPos(e);
    dragRef.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  }
  function aimMove(e) {
    if (!dragRef.current) return;
    const p = canvasPos(e);
    dragRef.current.x1 = p.x; dragRef.current.y1 = p.y;
  }
  function aimEnd() {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || !myTurn()) return;
    const dx = d.x0 - d.x1, dy = d.y0 - d.y1;
    const len = Math.hypot(dx, dy);
    if (len < 22) return;
    myThrowNow(Math.atan2(dy, dx), Math.min(1, len / 260));
  }

  if (!me || phase === 'wait') {
    return <div className="nc-shell"><p className="nc-status">The ice is freezing…</p></div>;
  }

  const iAmThrowing = hud.sub === 'aim' && hud.thrower === me;
  const iCanSweep = hud.sub === 'slide' && stRef.current &&
    stRef.current.stones.find(x => x.id === stRef.current.activeId)?.side === me;

  return (
    <div className="nc-shell">
      <div className="nc-table">
        <div className="nc-gamewrap">
          <div className="nc-toolbar">
            <div className="nc-brand">Night Curling</div>
            <div className="nc-hud">
              <span className="pA">{nm.A} <b>{hud.a}</b>
                <span className="nc-stonedots">{Array.from({ length: NC.STONES_EACH }).map((_, i) =>
                  <i key={i} className={'A' + (i < hud.left.A ? ' on' : '')} />)}</span>
              </span>
              <span className="nc-endinfo">end {hud.end}
                <em> {'\u00b7'} hammer: {nm[hud.hammer]}</em>
              </span>
              <span className="pB">
                <span className="nc-stonedots">{Array.from({ length: NC.STONES_EACH }).map((_, i) =>
                  <i key={i} className={'B' + (i < hud.left.B ? ' on' : '')} />)}</span>
                <b>{hud.b}</b> {nm.B}
              </span>
            </div>
          </div>

          <div className="nc-statusline">
            {phase === 'done' ? (
              winner && <span className="nc-winline">{nm[winner]} owns the ice</span>
            ) : hud.sub === 'aim' ? (
              iAmThrowing ? 'your stone — pull back and release' : `${nm[opp]} is lining up\u2026`
            ) : hud.sub === 'slide' ? (
              iCanSweep ? 'SWEEP! SWEEP!' : 'sliding\u2026'
            ) : hud.sub === 'endOver' ? (
              endMsg || 'end complete'
            ) : ''}
          </div>

          {phase === 'game' && hud.sub === 'aim' && iAmThrowing && (
            <div className="nc-curlbar nc-curlbar-top">
              <span className="nc-curllabel">curl</span>
              {[-1, 0, 1].map(c => (
                <button
                  key={c}
                  type="button"
                  className={'btn small' + (curl === c ? ' warm' : '')}
                  onClick={() => setCurl(c)}
                >
                  {c === -1 ? 'Up' : c === 0 ? 'Straight' : 'Down'}
                </button>
              ))}
            </div>
          )}

          <div
            className="nc-canvaswrap"
            onPointerDown={aimStart}
            onPointerMove={aimMove}
            onPointerUp={aimEnd}
            onPointerLeave={aimEnd}
            onContextMenu={e => e.preventDefault()}
          >
            <canvas ref={canvasRef} width={NC.W} height={NC.H} className="nc-canvas" />
          </div>

          {phase === 'game' && iCanSweep && (
            <button
              type="button"
              className="nc-sweepbtn"
              onPointerDown={e => { e.preventDefault(); mySweep(); }}
            >
              SWEEP
            </button>
          )}
          {phase === 'game' && hud.sub === 'endOver' && (
            <div className="nc-dock">
              <button type="button" className="btn warm" onClick={() => hostNextEnd(true)}>Next end</button>
            </div>
          )}
          {phase === 'done' && (
            <p className="nc-note">Use Rematch in the shell for another match.</p>
          )}
        </div>
      </div>
    </div>
  );
}
