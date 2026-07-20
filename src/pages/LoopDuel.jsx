// src/pages/LoopDuel.jsx — Loop Duel (mounted by the loopduel engine).
//
// One-button / wheel drift racing. Turn the wheel (or hold SPACE) to steer.
// Host-authoritative like Micro Soccer: side A simulates ~60fps and
// broadcasts ~20Hz; side B streams its steer. First to LD.LAPS.
// Shell already ran ready + countdown — race starts on mount.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ldInitial, ldStep, LD, BOOST
} from '../lib/loopduel.js';
import SteerWheel from '../components/SteerWheel.jsx';
import '../styles/loopduel.css';

export default function LoopDuel({ myRole, names = {}, rt, onComplete, pausedRef }) {
  const role = myRole;
  const nm = { A: names.A || 'A', B: names.B || 'B' };

  const [phase, setPhase] = useState('live'); // live | done
  const [hud, setHud] = useState({ lapA: 0, lapB: 0 });
  const [winner, setWinner] = useState(null);

  const canvasRef = useRef(null);
  const stRef = useRef(ldInitial());
  const steerRef = useRef(0);
  const guestSteer = useRef(0);
  const trailsRef = useRef({ A: [], B: [] });
  const startedRef = useRef(false);
  const endedRef = useRef(false);
  const phaseRef = useRef('live');
  const finishedRef = useRef(false);
  phaseRef.current = phase;

  function beginRace() {
    if (startedRef.current) return;
    startedRef.current = true;
    endedRef.current = false;
    finishedRef.current = false;
    stRef.current = ldInitial();
    trailsRef.current = { A: [], B: [] };
    steerRef.current = 0;
    guestSteer.current = 0;
    setWinner(null);
    setHud({ lapA: 0, lapB: 0 });
    setPhase('live');
  }

  useEffect(() => {
    if (!rt?.on) return undefined;
    rt.on(m => {
      if (!m?.k) return;
      if (m.k === 'needstart') {
        if (role === 'A' && startedRef.current) rt.send({ k: 'start' });
        return;
      }
      if (m.k === 'start') {
        beginRace();
        return;
      }
      if (m.k === 'st') { stRef.current = m.st; }
      else if (m.k === 'in') {
        // accept analog steer or legacy bool hold
        guestSteer.current = typeof m.steer === 'number'
          ? m.steer
          : (m.hold ? 1 : 0);
      }
      else if (m.k === 'over') finish(m.winner, false);
    });
    return undefined;
  }, [rt, role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Host publishes start; guest asks until it lands.
  useEffect(() => {
    if (role === 'A') {
      const push = () => rt?.send({ k: 'start' });
      beginRace();
      push();
      const t1 = setTimeout(push, 400);
      const t2 = setTimeout(push, 1200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    const ask = () => { if (!startedRef.current) rt?.send({ k: 'needstart' }); };
    ask();
    const iv = setInterval(ask, 700);
    return () => clearInterval(iv);
  }, [role, rt]);

  const finish = useCallback((w, fromHost) => {
    if (phaseRef.current === 'done') return;
    endedRef.current = true;
    setWinner(w);
    setPhase('done');
    if (fromHost && !finishedRef.current) {
      finishedRef.current = true;
      onComplete?.(w);
    }
  }, [onComplete]);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    const st = stRef.current;
    const css = getComputedStyle(document.documentElement);
    const P1 = css.getPropertyValue('--p1').trim() || '#7FA8FF';
    const P2 = css.getPropertyValue('--p2').trim() || '#FF7FA8';
    const CANC = css.getPropertyValue('--candle').trim() || '#FFC66E';
    const { CX, CY, L, R, TRACK_HALF } = LD;

    const bg = g.createLinearGradient(0, 0, 0, LD.H);
    bg.addColorStop(0, '#16211A'); bg.addColorStop(1, '#101A14');
    g.fillStyle = bg; g.fillRect(0, 0, LD.W, LD.H);

    const stadium = (rad) => {
      g.beginPath();
      g.moveTo(CX - L, CY - rad);
      g.lineTo(CX + L, CY - rad);
      g.arc(CX + L, CY, rad, -Math.PI / 2, Math.PI / 2);
      g.lineTo(CX - L, CY + rad);
      g.arc(CX - L, CY, rad, Math.PI / 2, Math.PI * 1.5);
      g.closePath();
    };

    stadium(R + TRACK_HALF); g.fillStyle = '#2E3038'; g.fill();
    stadium(R - TRACK_HALF); g.fillStyle = '#141C16'; g.fill();

    for (const rad of [R + TRACK_HALF, R - TRACK_HALF]) {
      stadium(rad);
      g.lineWidth = 9;
      g.setLineDash([]);
      g.strokeStyle = CANC;
      g.stroke();
      g.lineWidth = 3;
      g.strokeStyle = '#3A2E20';
      g.stroke();
    }

    stadium(R);
    g.lineWidth = 2; g.setLineDash([12, 18]);
    g.strokeStyle = 'rgba(242,237,247,.16)'; g.stroke();
    g.setLineDash([]);

    const fx = CX, fy = CY - R;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? '#EDE8F2' : '#1A1420';
        g.fillRect(fx - 4 + j * 4, fy - TRACK_HALF + i * (TRACK_HALF * 2 / 8), 4, TRACK_HALF * 2 / 8);
      }
    }

    g.fillStyle = 'rgba(111,220,168,.75)';
    for (let x = BOOST.x1 + 8; x < BOOST.x2; x += 26) {
      g.beginPath();
      g.moveTo(x, fy - 12); g.lineTo(x + 12, fy); g.lineTo(x, fy + 12);
      g.lineTo(x + 5, fy); g.closePath();
      g.fill();
    }

    for (const rr of ['A', 'B']) {
      for (const pt of trailsRef.current[rr]) {
        g.fillStyle = `rgba(0,0,0,${0.22 * pt.a})`;
        g.beginPath(); g.arc(pt.x, pt.y, 3, 0, 7); g.fill();
      }
    }

    for (const rr of ['A', 'B']) {
      const c = st.cars[rr];
      g.save();
      g.translate(c.x, c.y); g.rotate(c.a);
      if (c.boostT > 0) {
        g.fillStyle = 'rgba(255,198,110,.85)';
        g.beginPath();
        g.moveTo(-15, -4); g.lineTo(-26 - Math.random() * 6, 0); g.lineTo(-15, 4);
        g.closePath(); g.fill();
      }
      g.fillStyle = rr === 'A' ? P1 : P2;
      g.beginPath();
      const w = 30, h = 17, rd = 6;
      g.moveTo(-w / 2 + rd, -h / 2);
      g.arcTo(w / 2, -h / 2, w / 2, h / 2, rd);
      g.arcTo(w / 2, h / 2, -w / 2, h / 2, rd);
      g.arcTo(-w / 2, h / 2, -w / 2, -h / 2, rd);
      g.arcTo(-w / 2, -h / 2, w / 2, -h / 2, rd);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(10,10,18,.5)';
      g.fillRect(2, -h / 2 + 3, 8, h - 6);
      g.restore();
    }
  }, []);

  /* ---------- race loop ---------- */
  useEffect(() => {
    if (phase !== 'live') return undefined;
    const isHost = role === 'A';
    let raf;
    let last = performance.now();

    const net = setInterval(() => {
      if (endedRef.current || pausedRef?.current) return;
      if (isHost) rt?.send({ k: 'st', st: stRef.current });
      else rt?.send({ k: 'in', steer: steerRef.current });
    }, 50);

    const loop = now => {
      if (pausedRef?.current) {
        raf = requestAnimationFrame(loop);
        return;
      }
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (isHost && !endedRef.current) {
        const r = ldStep(stRef.current, {
          A: role === 'A' ? steerRef.current : guestSteer.current,
          B: role === 'A' ? guestSteer.current : steerRef.current
        }, dt);
        stRef.current = r.state;
        if (r.state.winner && !endedRef.current) {
          endedRef.current = true;
          rt?.send({ k: 'st', st: r.state });
          rt?.send({ k: 'over', winner: r.state.winner });
          finish(r.state.winner, true);
        }
      }
      const st = stRef.current;
      setHud({ lapA: st.cars.A.lap, lapB: st.cars.B.lap });
      for (const rr of ['A', 'B']) {
        const c = st.cars[rr];
        const tr = trailsRef.current[rr];
        if (c.v > 140) tr.push({ x: c.x, y: c.y, a: 1 });
        if (tr.length > 90) tr.splice(0, tr.length - 90);
        tr.forEach(pt => { pt.a *= 0.965; });
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(raf); clearInterval(net); };
  }, [phase, role, rt, pausedRef, finish, draw]);

  return (
    <div className="lp-shell">
      <div className="lp-racewrap">
        <div className="lp-toolbar">
          <div className="lp-brand">Loop Duel</div>
          <div className="lp-hud">
            <span className="pA">{nm.A} — lap {Math.min(hud.lapA + 1, LD.LAPS)}/{LD.LAPS}</span>
            <span className="pB">{nm.B} — lap {Math.min(hud.lapB + 1, LD.LAPS)}/{LD.LAPS}</span>
          </div>
        </div>
        <div className="lp-canvaswrap">
          <canvas ref={canvasRef} width={LD.W} height={LD.H} className="lp-canvas" />
        </div>

        {phase === 'live' && (
          <SteerWheel steerRef={steerRef} seat={role} disabled={false} />
        )}

        {phase === 'done' && winner && (
          <div className="lp-done">
            <div className="lp-winline">
              <span className={winner === 'A' ? 'pA' : 'pB'}>{nm[winner]}</span>
              {' '}takes the checkered flag
            </div>
            <p className="lp-note">Use Rematch in the shell for another first-to-{LD.LAPS}.</p>
          </div>
        )}
      </div>
    </div>
  );
}
