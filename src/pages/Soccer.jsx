// src/pages/Soccer.jsx — route: /soccer/:code
//
// Micro Soccer — two cars, one ball, two goals, 90 seconds, highest score
// wins. Host-authoritative like Duo Pong: side A runs the physics and
// broadcasts state ~20Hz; side B streams its input up. Deterministic seed
// isn't needed because A is the single source of truth.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  myRoleInDuo, duoNames, soccerChannel, loadSoccer, recordSoccer,
  socInitial, socStep, SOC, MATCH_SECONDS
} from '../lib/soccer.js';
import Dpad, { useKeys } from '../games-soccer/Dpad.jsx';
import '../styles/soccer.css';

export default function Soccer() {
  const { code } = useParams();
  const navigate = useNavigate();

  const [role, setRole] = useState(undefined);
  const [names, setNames] = useState({ A: 'A', B: 'B' });
  const [tally, setTally] = useState({ a: 0, b: 0, d: 0 });
  const [phase, setPhase] = useState('lobby');   // lobby | countdown | live | done
  const [myReady, setMyReady] = useState(false);
  const [theirReady, setTheirReady] = useState(false);
  const [count, setCount] = useState(3);
  const [hud, setHud] = useState({ A: 0, B: 0, t: MATCH_SECONDS });
  const [result, setResult] = useState(null);

  const canvasRef = useRef(null);
  const chRef = useRef(null);
  const stRef = useRef(socInitial());
  const keys = useKeys();
  const guestKeys = useRef({});
  const startedRef = useRef(false);
  const endedRef = useRef(false);
  const phaseRef = useRef('lobby');
  phaseRef.current = phase;
  const endAtRef = useRef(0);

  /* ---------- seat + channel ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await myRoleInDuo(code);
      if (!alive) return;
      setRole(r);
      if (!r) return;
      setNames(await duoNames(code));
      setTally(await loadSoccer(code));
    })();

    let ch;
    (async () => {
      ch = await soccerChannel(code);
      if (!alive) { ch.close(); return; }
      chRef.current = ch;
      ch.on(m => {
        if (m.k === 'ready') setTheirReady(m.v);
        else if (m.k === 'start') beginCountdown(m.endAt);
        else if (m.k === 'st') { stRef.current = m.st; }   // guest applies host state
        else if (m.k === 'in') { guestKeys.current = m.keys; }   // host applies guest input
        else if (m.k === 'over') finish(m.winner, false);
      });
    })();
    return () => { alive = false; ch?.close(); chRef.current?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  /* ---------- ready → countdown ---------- */
  function pressReady() {
    const v = !myReady;
    setMyReady(v);
    chRef.current?.send({ k: 'ready', v });
  }

  useEffect(() => {
    if (phase !== 'lobby' || !myReady || !theirReady) return;
    const delay = role === 'A' ? 120 : 1500;   // A initiates; B is fallback
    const t = setTimeout(() => {
      if (startedRef.current || phaseRef.current !== 'lobby') return;
      const endAt = Date.now() + 3400 + MATCH_SECONDS * 1000;
      chRef.current?.send({ k: 'start', endAt });
      beginCountdown(endAt);
    }, delay);
    return () => clearTimeout(t);
  }, [myReady, theirReady, phase, role]);

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

  /* ---------- the match loop ---------- */
  useEffect(() => {
    if (phase !== 'live') return;
    const isHost = role === 'A';
    let raf, last = performance.now();

    const net = setInterval(() => {
      if (endedRef.current) return;
      if (isHost) chRef.current?.send({ k: 'st', st: stRef.current });
      else chRef.current?.send({ k: 'in', keys: keys.current });
    }, 50);

    const loop = now => {
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
          chRef.current?.send({ k: 'st', st: stRef.current });
          chRef.current?.send({ k: 'over', winner });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, role]);

  const finish = useCallback((winner, iRecord) => {
    if (phaseRef.current === 'done') return;
    endedRef.current = true;
    setResult(winner);
    setPhase('done');
    if (iRecord) {
      recordSoccer(code, winner)
        .then(r => setTally({ a: r.wins_a, b: r.wins_b, d: r.draws }))
        .catch(() => {});
    }
  }, [code]);

  function rematch() {
    startedRef.current = false; endedRef.current = false;
    guestKeys.current = {}; keys.current = {};
    stRef.current = socInitial();
    setMyReady(false); setTheirReady(false);
    setResult(null); setCount(3);
    setHud({ A: 0, B: 0, t: MATCH_SECONDS });
    setPhase('lobby');
    chRef.current?.send({ k: 'ready', v: false });
  }

  /* ---------- render ---------- */
  if (role === undefined) return <div className="sc-page"><p className="sc-status">Loading…</p></div>;
  if (role === null) {
    return (
      <div className="sc-page">
        <p className="sc-status">Sign in as a member of this duo to play.</p>
        <button className="btn" onClick={() => navigate('/app')}>Back to the arcade</button>
      </div>
    );
  }

  const mm = String(Math.floor(hud.t / 60)), ss = String(hud.t % 60).padStart(2, '0');

  return (
    <div className="sc-page">
      <div className="sc-top">
        <button className="btn small ghost" onClick={() => navigate('/app')}>&larr; Back</button>
        <div className="sc-title">{'\u26BD'} Micro Soccer</div>
        <div className="sc-tally">
          <span className="pA">{names.A} {tally.a}</span>
          <span className="dash">–</span>
          <span className="pB">{tally.b} {names.B}</span>
        </div>
      </div>

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
          <p className="sc-blurb">Two cars, one ball, {MATCH_SECONDS} seconds. Nudge the ball into their goal. Chaos encouraged.</p>
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
                you're the {role === 'A' ? 'blue car (left goal is yours to defend)' : 'pink car (right goal is yours to defend)'} \u00b7 arrows / WASD / pad
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
          <div className="sc-actions">
            <button className="btn warm" onClick={rematch}>Rematch</button>
            <button className="btn ghost" onClick={() => navigate('/app')}>Back home</button>
          </div>
        </div>
      )}

      {(phase === 'lobby') && <div className="sc-note">Both players need to be on this screen. Open the same duo on each device.</div>}
    </div>
  );
}
