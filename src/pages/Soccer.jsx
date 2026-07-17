// src/pages/Soccer.jsx — Micro Soccer play UI (mounted by the microsoccer engine).
// Host-authoritative: side A runs physics ~20Hz; side B streams input.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  socInitial, socStep, SOC, MATCH_SECONDS
} from '../lib/soccer.js';
import Dpad, { useKeys } from '../games-soccer/Dpad.jsx';
import '../styles/soccer.css';

export default function Soccer({ myRole, names = {}, rt, onComplete, pausedRef }) {
  const role = myRole;
  const [phase, setPhase] = useState('lobby');   // lobby | countdown | live | done
  const [myReady, setMyReady] = useState(false);
  const [theirReady, setTheirReady] = useState(false);
  const [count, setCount] = useState(3);
  const [hud, setHud] = useState({ A: 0, B: 0, t: MATCH_SECONDS });
  const [result, setResult] = useState(null);

  const canvasRef = useRef(null);
  const stRef = useRef(socInitial());
  const keys = useKeys();
  const guestKeys = useRef({});
  const startedRef = useRef(false);
  const endedRef = useRef(false);
  const phaseRef = useRef('lobby');
  phaseRef.current = phase;
  const endAtRef = useRef(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!rt?.on) return;
    rt.on(m => {
      if (!m || !m.k) return;
      if (m.k === 'ready') setTheirReady(m.v);
      else if (m.k === 'start') beginCountdown(m.endAt);
      else if (m.k === 'st') { stRef.current = m.st; }
      else if (m.k === 'in') { guestKeys.current = m.keys; }
      else if (m.k === 'over') finish(m.winner, false);
    });
  }, [rt]); // eslint-disable-line react-hooks/exhaustive-deps

  function pressReady() {
    const v = !myReady;
    setMyReady(v);
    rt?.send({ k: 'ready', v });
  }

  useEffect(() => {
    if (phase !== 'lobby' || !myReady || !theirReady) return;
    const delay = role === 'A' ? 120 : 1500;
    const t = setTimeout(() => {
      if (startedRef.current || phaseRef.current !== 'lobby') return;
      const endAt = Date.now() + 3400 + MATCH_SECONDS * 1000;
      rt?.send({ k: 'start', endAt });
      beginCountdown(endAt);
    }, delay);
    return () => clearTimeout(t);
  }, [myReady, theirReady, phase, role, rt]);

  function beginCountdown(endAt) {
    if (startedRef.current) return;
    startedRef.current = true;
    endAtRef.current = endAt;
    stRef.current = socInitial();
    setPhase('countdown');
    const liveAt = endAt - MATCH_SECONDS * 1000;
    const iv = setInterval(() => {
      const l = Math.ceil((liveAt - Date.now()) / 1000);
      setCount(Math.max(0, l));
      if (l <= 0) { clearInterval(iv); setPhase('live'); }
    }, 150);
  }

  useEffect(() => {
    if (phase !== 'live') return;
    const isHost = role === 'A';
    let raf, last = performance.now();

    const net = setInterval(() => {
      if (endedRef.current || pausedRef?.current) return;
      if (isHost) rt?.send({ k: 'st', st: stRef.current });
      else rt?.send({ k: 'in', keys: keys.current });
    }, 50);

    const loop = now => {
      if (pausedRef?.current) {
        raf = requestAnimationFrame(loop);
        return;
      }
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));

      if (isHost && !endedRef.current) {
        const r = socStep(stRef.current, { A: keys.current, B: guestKeys.current }, dt);
        stRef.current = r.state;
        if (remaining <= 0) {
          endedRef.current = true;
          const sc = stRef.current.score;
          const winner = sc.A === sc.B ? 'draw' : (sc.A > sc.B ? 'A' : 'B');
          rt?.send({ k: 'st', st: stRef.current });
          rt?.send({ k: 'over', winner });
          finish(winner, true);
        }
      }
      const st = stRef.current;
      setHud({ A: st.score.A, B: st.score.B, t: remaining });
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    function draw() {
      const cv = canvasRef.current;
      if (!cv) return;
      const g = cv.getContext('2d');
      const st = stRef.current;
      const css = getComputedStyle(document.documentElement);
      const P1 = css.getPropertyValue('--p1').trim() || '#7FA8FF';
      const P2 = css.getPropertyValue('--p2').trim() || '#FF7FA8';
      const CANC = css.getPropertyValue('--candle').trim() || '#FFC66E';

      g.fillStyle = '#15291B'; g.fillRect(0, 0, SOC.W, SOC.H);
      g.strokeStyle = 'rgba(255,255,255,.13)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(SOC.W / 2, 0); g.lineTo(SOC.W / 2, SOC.H); g.stroke();
      g.beginPath(); g.arc(SOC.W / 2, SOC.H / 2, 60, 0, 7); g.stroke();
      const gTop = (SOC.H - SOC.GOAL_H) / 2;
      g.fillStyle = 'rgba(127,168,255,.20)'; g.fillRect(0, gTop, 9, SOC.GOAL_H);
      g.fillStyle = 'rgba(255,127,168,.20)'; g.fillRect(SOC.W - 9, gTop, 9, SOC.GOAL_H);

      for (const r of ['A', 'B']) {
        const c = st.cars[r];
        g.save(); g.translate(c.x, c.y); g.rotate(c.a);
        g.fillStyle = r === 'A' ? P1 : P2;
        g.fillRect(-SOC.CAR_W / 2, -SOC.CAR_H / 2, SOC.CAR_W, SOC.CAR_H);
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.fillRect(SOC.CAR_W / 2 - 9, -SOC.CAR_H / 2 + 3, 6, SOC.CAR_H - 6);
        g.restore();
      }
      g.fillStyle = CANC;
      g.beginPath(); g.arc(st.ball.x, st.ball.y, SOC.BALL_R, 0, 7); g.fill();
    }

    return () => { cancelAnimationFrame(raf); clearInterval(net); };
  }, [phase, role, rt, pausedRef, keys]);

  const finish = useCallback((winner, fromHost) => {
    if (phaseRef.current === 'done') return;
    endedRef.current = true;
    setResult(winner);
    setPhase('done');
    if (fromHost && !finishedRef.current) {
      finishedRef.current = true;
      onComplete?.(winner);
    }
  }, [onComplete]);

  const mm = String(Math.floor(hud.t / 60));
  const ss = String(hud.t % 60).padStart(2, '0');

  return (
    <div className="sc-page sc-embedded">
      {phase === 'lobby' && (
        <div className="sc-lobby">
          <div className="sc-seats">
            <div className="sc-seat">
              <div className="sc-av A">{(names.A || '?')[0].toUpperCase()}</div>
              <div className={'sc-rd' + ((role === 'A' ? myReady : theirReady) ? ' yes' : '')}>
                {(role === 'A' ? myReady : theirReady) ? 'ready' : '\u2026'}
              </div>
            </div>
            <div className="sc-vs">vs</div>
            <div className="sc-seat">
              <div className="sc-av B">{(names.B || '?')[0].toUpperCase()}</div>
              <div className={'sc-rd' + ((role === 'B' ? myReady : theirReady) ? ' yes' : '')}>
                {(role === 'B' ? myReady : theirReady) ? 'ready' : '\u2026'}
              </div>
            </div>
          </div>
          <p className="sc-blurb">Two cars, one ball, {MATCH_SECONDS} seconds. Nudge the ball into their goal.</p>
          <button className="btn warm" onClick={pressReady}>{myReady ? 'Cancel' : "I'm ready"}</button>
        </div>
      )}

      {phase === 'countdown' && <div className="sc-count">{count || 'GO'}</div>}

      {(phase === 'live' || phase === 'done') && (
        <div className="sc-game">
          <div className="sc-hud">
            <span className="pA">{hud.A}</span>
            <span className="sc-clock">{mm}:{ss}</span>
            <span className="pB">{hud.B}</span>
          </div>
          <canvas ref={canvasRef} width={SOC.W} height={SOC.H} className="sc-canvas" />
          {phase === 'live' && (
            <>
              <div className="sc-hint">
                you're the {role === 'A' ? 'blue car (defend left)' : 'pink car (defend right)'} · arrows / WASD / pad
              </div>
              <Dpad keysRef={keys} />
            </>
          )}
        </div>
      )}

      {phase === 'done' && (
        <div className="sc-done">
          <div className="sc-winline">
            {result === 'draw' ? "It's a draw!" : `${result === 'A' ? names.A : names.B} wins!`}
          </div>
          <div className="sc-final">{hud.A} – {hud.B}</div>
        </div>
      )}
    </div>
  );
}
