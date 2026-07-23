// src/pages/NightCurling.jsx — mounted by the nightcurling engine.
//
// Host-authoritative over shell RT: A sims at 60fps and broadcasts ~20Hz;
// B sends throw params and sweep taps. Aiming is local until release.

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
    setWinner(null);
    setEndMsg(null);
    setCurl(0);
    setPhase('game');
  }, []);

  const hostThrow = useCallback((by, angle, power, c) => {
    if (meRef.current !== 'A' || !stRef.current) return;
    const next = throwStone(stRef.current, by, angle, power, c);
    if (!next.error) stRef.current = next;
  }, []);

  const hostSweep = useCallback(() => {
    if (meRef.current !== 'A' || !stRef.current) return;
    stRef.current = sweepTap(stRef.current);
  }, []);

  const hostNextEnd = useCallback((broadcast) => {
    if (meRef.current === 'A' && stRef.current) {
      stRef.current = nextEnd(stRef.current);
    }
    if (broadcast) {
      const payload = { k: 'nextEnd', by: meRef.current };
      rt?.send(payload);
      setTimeout(() => rt?.send(payload), 180);
    }
    setEndMsg(null);
  }, [rt]);

  const myThrowNow = useCallback((angle, power) => {
    const c = curlRef.current;
    if (meRef.current === 'A') hostThrow('A', angle, power, c);
    else {
      const payload = { k: 'throw', by: 'B', angle, power, curl: c };
      rt?.send(payload);
      setTimeout(() => rt?.send(payload), 180);
    }
  }, [hostThrow, rt]);

  const mySweep = useCallback(() => {
    const st = stRef.current;
    if (!st || st.phase !== 'slide') return;
    const active = st.stones.find(x => x.id === st.activeId);
    if (!active || active.side !== meRef.current) return;
    if (meRef.current === 'A') hostSweep();
    else rt?.send({ k: 'sweep' });
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
        if (meRef.current === 'A' && startedRef.current) rt.send({ k: 'start' });
        return;
      }
      if (m.k === 'start') {
        begin();
        return;
      }
      if (m.k === 'st') {
        stRef.current = m.st;
        return;
      }
      if (m.k === 'throw') {
        if (meRef.current === 'A') hostThrow(m.by, m.angle, m.power, m.curl);
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
  }, [rt, begin, hostThrow, hostSweep, hostNextEnd, finish]);

  useEffect(() => {
    if (me === 'A') {
      const push = () => rt?.send({ k: 'start' });
      begin();
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
      const col = stn.side === 'A' ? P1 : P2;
      const moving = Math.hypot(stn.vx, stn.vy) > 2;
      if (moving) {
        g.fillStyle = stn.side === 'A' ? 'rgba(127,168,255,.12)' : 'rgba(255,127,168,.12)';
        g.beginPath(); g.arc(stn.x, stn.y, NC.STONE_R + 8, 0, 7); g.fill();
      }
      const grad = g.createRadialGradient(stn.x - 5, stn.y - 6, 3, stn.x, stn.y, NC.STONE_R);
      grad.addColorStop(0, '#5A5566');
      grad.addColorStop(0.55, '#37333F');
      grad.addColorStop(1, '#232029');
      g.fillStyle = grad;
      g.beginPath(); g.arc(stn.x, stn.y, NC.STONE_R, 0, 7); g.fill();
      g.strokeStyle = col; g.lineWidth = 4.5; g.lineCap = 'round';
      g.beginPath(); g.arc(stn.x, stn.y, NC.STONE_R - 6, -2.3, -0.85); g.stroke();
      g.lineCap = 'butt';
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

    const net = setInterval(() => {
      const st = stRef.current;
      if (!st || st.phase === 'over') return;
      if (isHost) rt?.send({ k: 'st', st });
    }, 50);

    const loop = now => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const st = stRef.current;
      if (st) {
        if (isHost && st.phase === 'slide') {
          stRef.current = ncStep(st, dt);
          if (stRef.current.phase === 'over' && stRef.current.winner && !finishedRef.current) {
            rt?.send({ k: 'st', st: stRef.current });
            rt?.send({ k: 'over', winner: stRef.current.winner });
            finish(stRef.current.winner, true);
          }
        }
        const s2 = stRef.current;
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
    return () => { cancelAnimationFrame(raf); clearInterval(net); };
  }, [phase, rt, finish, draw]);

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

          {phase === 'game' && hud.sub === 'aim' && iAmThrowing && (
            <div className="nc-curlbar">
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
