// src/pages/Soccer.jsx — Micro Soccer play UI (mounted by the microsoccer engine).
// Ball sync: host authoritative; guest converges renderBall → latestAuthoritativeBall.
// Snapshot rate experiment: VITE_SOC_NET_HZ=20|60 (or VITE_SOC_NET_INTERVAL_MS).
// Remote cars still use pose/snapshot buffers. Transport sync.rt() unchanged.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  socInitial, socStep, socStepCar, SOC, MATCH_SECONDS
} from '../lib/soccer.js';
import {
  validateSoccerMsg,
  lerpCar,
  moveTowardBall,
  createInterpBuffer,
  createSoccerMetrics,
  SOC_NET_INTERVAL_MS,
  SOC_NET_HZ,
  SOC_INTERP_DELAY_MS,
  SOC_BALL_EXTREME_PX,
} from '../lib/soccerNet.js';
import { CONFIG } from '../lib/config.js';
import Dpad, { useKeys } from '../games-soccer/Dpad.jsx';
import '../styles/soccer.css';
import {
  logHostSend,
  logGuestRecv,
  socVerifyTickFrame,
} from '../lib/soccerVerify.js';

const BALL_CONVERGE_RATE = 18; // 1/s exponential
const BALL_MAX_STEP_PX = 12;   // cap per frame — prevents teleports

export default function Soccer({ myRole, names = {}, rt, onComplete, pausedRef }) {
  const role = myRole;
  const [phase, setPhase] = useState('live');
  const [hud, setHud] = useState({ A: 0, B: 0, t: MATCH_SECONDS });
  const [result, setResult] = useState(null);

  const canvasRef = useRef(null);
  const stRef = useRef(socInitial());
  const keys = useKeys();
  const guestKeys = useRef({});

  // Host: buffered interpolation of guest B poses.
  const poseBufRef = useRef(null);
  // Guest: buffered interpolation of peer car from host st.
  const peerBufRef = useRef(null);

  // Guest ball: exactly two objects — latest auth target + what we draw (stRef.ball).
  const latestAuthBallRef = useRef(null);
  const prevRenderBallRef = useRef(null);

  const lastSeqRef = useRef(0);
  const outSeqRef = useRef(0);
  const metricsRef = useRef(null);
  const startedRef = useRef(false);
  const endedRef = useRef(false);
  const phaseRef = useRef('live');
  phaseRef.current = phase;
  const endAtRef = useRef(Date.now() + MATCH_SECONDS * 1000);
  const finishedRef = useRef(false);
  const hudSnapRef = useRef({ A: 0, B: 0, t: MATCH_SECONDS });

  function ensureBuffers() {
    if (!poseBufRef.current) {
      poseBufRef.current = createInterpBuffer({ lerpFn: lerpCar, delayMs: SOC_INTERP_DELAY_MS });
    }
    if (!peerBufRef.current) {
      peerBufRef.current = createInterpBuffer({ lerpFn: lerpCar, delayMs: SOC_INTERP_DELAY_MS });
    }
  }

  function beginMatch(endAt) {
    if (startedRef.current) return;
    startedRef.current = true;
    endAtRef.current = endAt;
    stRef.current = socInitial();
    ensureBuffers();
    poseBufRef.current?.clear();
    peerBufRef.current?.clear();
    latestAuthBallRef.current = { ...stRef.current.ball };
    prevRenderBallRef.current = { ...stRef.current.ball };
    lastSeqRef.current = 0;
    outSeqRef.current = 0;
    setHud({ A: 0, B: 0, t: MATCH_SECONDS });
    setPhase('live');
  }

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

  useEffect(() => {
    ensureBuffers();
    const metrics = createSoccerMetrics();
    metricsRef.current = metrics;
    const onReconnect = () => metrics.noteReconnect();
    if (rt && typeof rt === 'object') rt._onReconnect = onReconnect;
    if (typeof window !== 'undefined') {
      window.__DUO_GAME_RT_TRANSPORT__ = rt?.transport?.()
        || (String(CONFIG.GAME_RT || 'supabase').toLowerCase() === 'socket' ? 'socket' : 'supabase');
      window.__SOC_NET__ = metrics;
      window.__SOC_NET_EXPERIMENT__ = {
        socNetHz: SOC_NET_HZ,
        socNetIntervalMs: SOC_NET_INTERVAL_MS,
        carInterpDelayMs: SOC_INTERP_DELAY_MS,
        flag: 'VITE_SOC_NET_HZ | VITE_SOC_NET_INTERVAL_MS',
      };
    }
    return () => {
      metrics.logSummary('Micro Soccer sync');
      if (typeof window !== 'undefined' && window.__SOC_NET__ === metrics) {
        delete window.__SOC_NET__;
        delete window.__SOC_NET_EXPERIMENT__;
      }
      if (rt && rt._onReconnect === onReconnect) rt._onReconnect = null;
    };
  }, [rt]);

  useEffect(() => {
    if (!rt?.on) return;
    ensureBuffers();
    const me = role;
    const opp = role === 'A' ? 'B' : 'A';

    rt.on(m => {
      const rawForVerify = (m && m.k === 'st') ? m : null;
      const msg = validateSoccerMsg(m);
      if (!msg) {
        metricsRef.current?.noteDrop();
        return;
      }
      metricsRef.current?.noteIn(msg);

      if (msg.k === 'start') beginMatch(msg.endAt);
      else if (msg.k === 'st') {
        if (role === 'A') return;
        if (rawForVerify) logGuestRecv(rawForVerify, msg);

        if (msg.seq != null) {
          if (msg.seq <= lastSeqRef.current) {
            metricsRef.current?.noteDrop();
            return;
          }
          lastSeqRef.current = msg.seq;
        }

        const auth = msg.st;
        const local = stRef.current;
        const scoreChanged = auth.score.A !== local.score.A || auth.score.B !== local.score.B;

        let myCar = local.cars[me];
        if (scoreChanged) {
          myCar = { ...auth.cars[me] };
        } else {
          metricsRef.current?.notePredictionError(
            Math.hypot(auth.cars[me].x - myCar.x, auth.cars[me].y - myCar.y)
          );
        }

        peerBufRef.current.push(auth.cars[opp]);

        const prevLatest = latestAuthBallRef.current || local.ball;
        const jump = Math.hypot(auth.ball.x - prevLatest.x, auth.ball.y - prevLatest.y);
        // Single auth writer: update target only here (plus hard snap of render below).
        latestAuthBallRef.current = { ...auth.ball };
        metricsRef.current?.noteAuthBall(auth.ball);
        metricsRef.current?.noteBallCorrection(jump, {
          hard: scoreChanged || jump > SOC_BALL_EXTREME_PX,
        });

        if (scoreChanged) {
          stRef.current = {
            cars: {
              A: me === 'A' ? myCar : auth.cars.A,
              B: me === 'B' ? myCar : auth.cars.B,
            },
            ball: { ...auth.ball },
            score: { ...auth.score },
          };
          prevRenderBallRef.current = { ...auth.ball };
        } else if (jump > SOC_BALL_EXTREME_PX) {
          stRef.current = {
            ...local,
            cars: { ...local.cars, [me]: myCar },
            ball: { ...auth.ball },
            score: { ...auth.score },
          };
          prevRenderBallRef.current = { ...auth.ball };
        } else {
          // Render converges in rAF — do not assign st.ball here.
          stRef.current = {
            ...local,
            cars: { ...local.cars, [me]: myCar },
            score: { ...auth.score },
          };
        }
      } else if (msg.k === 'in') {
        if (role === 'A') guestKeys.current = msg.keys;
      } else if (msg.k === 'pose') {
        if (role === 'A' && msg.role === 'B') {
          const prev = poseBufRef.current.latest();
          if (prev) {
            metricsRef.current?.notePlayerInterpError(
              Math.hypot(msg.car.x - prev.x, msg.car.y - prev.y)
            );
          }
          poseBufRef.current.push(msg.car);
          if (msg.keys) guestKeys.current = msg.keys;
        }
      } else if (msg.k === 'over') finish(msg.winner, false);
    });
  }, [rt, role, finish]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (role !== 'A') {
      const t = setTimeout(() => {
        if (!startedRef.current) beginMatch(Date.now() + MATCH_SECONDS * 1000);
      }, 800);
      return () => clearTimeout(t);
    }
    const endAt = Date.now() + MATCH_SECONDS * 1000;
    const startMsg = { k: 'start', endAt };
    metricsRef.current?.noteOut(startMsg);
    rt?.send(startMsg);
    beginMatch(endAt);
  }, [role, rt]);

  useEffect(() => {
    if (!rt?.probeRtt) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const ms = await rt.probeRtt();
        if (!cancelled && ms != null) metricsRef.current?.noteRtt(ms);
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [rt]);

  useEffect(() => {
    if (phase !== 'live') return;
    ensureBuffers();
    const isHost = role === 'A';
    const me = role;
    const opp = role === 'A' ? 'B' : 'A';
    let raf, last = performance.now();

    const net = setInterval(() => {
      if (endedRef.current || pausedRef?.current) return;
      if (isHost) {
        outSeqRef.current += 1;
        const msg = { k: 'st', seq: outSeqRef.current, st: stRef.current };
        logHostSend(msg);
        metricsRef.current?.noteOut(msg);
        rt?.send(msg);
      } else {
        const car = stRef.current.cars[me];
        const msg = {
          k: 'pose',
          role: me,
          car: { x: car.x, y: car.y, a: car.a, v: car.v },
          keys: { ...keys.current },
        };
        metricsRef.current?.noteOut(msg);
        rt?.send(msg);
      }
    }, SOC_NET_INTERVAL_MS);

    const loop = now => {
      socVerifyTickFrame();
      if (pausedRef?.current) {
        raf = requestAnimationFrame(loop);
        return;
      }
      const cpuT0 = performance.now();
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));

      if (!endedRef.current) {
        if (isHost) {
          const poseSample = poseBufRef.current.sample(now);
          const poseLock = {};
          if (poseSample.value) poseLock.B = poseSample.value;

          const r = socStep(
            stRef.current,
            { A: keys.current, B: guestKeys.current },
            dt,
            { poseLock }
          );
          stRef.current = r.state;

          if (r.goal) {
            poseBufRef.current.clear();
            poseBufRef.current.push(stRef.current.cars.B);
          }

          if (remaining <= 0) {
            endedRef.current = true;
            const sc = stRef.current.score;
            const winner = sc.A === sc.B ? 'draw' : (sc.A > sc.B ? 'A' : 'B');
            outSeqRef.current += 1;
            const stMsg = { k: 'st', seq: outSeqRef.current, st: stRef.current };
            logHostSend(stMsg);
            const overMsg = { k: 'over', winner };
            metricsRef.current?.noteOut(stMsg);
            metricsRef.current?.noteOut(overMsg);
            rt?.send(stMsg);
            rt?.send(overMsg);
            finish(winner, true);
          }
        } else {
          const st = stRef.current;
          st.cars[me] = socStepCar(st.cars[me], keys.current, dt);

          const peer = peerBufRef.current.sample(now);
          if (peer.value) st.cars[opp] = peer.value;

          // Single render writer: converge toward latest authoritative ball only.
          const latest = latestAuthBallRef.current;
          if (latest) {
            const prev = prevRenderBallRef.current || st.ball;
            const next = moveTowardBall(st.ball, latest, dt, BALL_CONVERGE_RATE, BALL_MAX_STEP_PX);

            const step = Math.hypot(next.x - prev.x, next.y - prev.y);
            if (step > 20) metricsRef.current?.noteTeleport();

            // Sync-induced reverse: move opposite to previous travel while converging.
            const moveDot = (next.x - prev.x) * prev.vx + (next.y - prev.y) * prev.vy;
            if (
              Math.hypot(prev.vx, prev.vy) > 40
              && step > 1
              && moveDot < -0.5 * step * Math.hypot(prev.vx, prev.vy)
            ) {
              metricsRef.current?.noteReverse();
            }

            const err = Math.hypot(next.x - latest.x, next.y - latest.y);
            metricsRef.current?.noteBallError(err);
            metricsRef.current?.noteRenderBall(next, latest);

            st.ball = next;
            prevRenderBallRef.current = { ...next };
          }
        }
      }

      const st = stRef.current;
      const nextHud = { A: st.score.A, B: st.score.B, t: remaining };
      const prev = hudSnapRef.current;
      if (prev.A !== nextHud.A || prev.B !== nextHud.B || prev.t !== nextHud.t) {
        hudSnapRef.current = nextHud;
        setHud(nextHud);
      }
      draw();
      metricsRef.current?.noteFrameCpu(performance.now() - cpuT0);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    function drawGoal(g, side, tint) {
      const gTop = (SOC.H - SOC.GOAL_H) / 2;
      const gBot = gTop + SOC.GOAL_H;
      const depth = 28;
      const post = 5;
      const mouth = side === 'L' ? 0 : SOC.W;
      const back = side === 'L' ? depth : SOC.W - depth;
      const dir = side === 'L' ? 1 : -1;

      g.fillStyle = 'rgba(0,0,0,.22)';
      g.beginPath();
      if (side === 'L') {
        g.moveTo(0, gTop); g.lineTo(depth, gTop + 10); g.lineTo(depth, gBot - 10); g.lineTo(0, gBot);
      } else {
        g.moveTo(SOC.W, gTop); g.lineTo(SOC.W - depth, gTop + 10); g.lineTo(SOC.W - depth, gBot - 10); g.lineTo(SOC.W, gBot);
      }
      g.closePath(); g.fill();

      g.fillStyle = tint;
      g.beginPath();
      if (side === 'L') {
        g.moveTo(post, gTop + post); g.lineTo(depth - 2, gTop + 12);
        g.lineTo(depth - 2, gBot - 12); g.lineTo(post, gBot - post);
      } else {
        g.moveTo(SOC.W - post, gTop + post); g.lineTo(SOC.W - depth + 2, gTop + 12);
        g.lineTo(SOC.W - depth + 2, gBot - 12); g.lineTo(SOC.W - post, gBot - post);
      }
      g.closePath(); g.fill();

      g.strokeStyle = 'rgba(230,235,240,.32)';
      g.lineWidth = 1;
      const netRows = 8;
      const netDepth = 5;
      for (let j = 0; j <= netRows; j++) {
        const t = j / netRows;
        const yF = gTop + t * SOC.GOAL_H;
        const yB = gTop + 10 + t * (SOC.GOAL_H - 20);
        g.beginPath();
        g.moveTo(mouth, yF);
        g.lineTo(back, yB);
        g.stroke();
      }
      for (let i = 0; i <= netDepth; i++) {
        const t = i / netDepth;
        const x = mouth + dir * depth * t;
        const inset = 10 * t;
        g.beginPath();
        g.moveTo(x, gTop + inset);
        g.lineTo(x, gBot - inset);
        g.stroke();
      }

      g.fillStyle = '#F2F4F7';
      if (side === 'L') {
        g.fillRect(0, gTop - post, post, SOC.GOAL_H + post * 2);
        g.fillRect(depth - post, gTop + 8, post, SOC.GOAL_H - 16);
        g.beginPath();
        g.moveTo(0, gTop); g.lineTo(depth, gTop + 10);
        g.lineTo(depth, gTop + 10 + post); g.lineTo(0, gTop + post);
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(242,244,247,.75)';
        g.beginPath();
        g.moveTo(0, gBot); g.lineTo(depth, gBot - 10);
        g.lineTo(depth, gBot - 10 + 3); g.lineTo(0, gBot + 3);
        g.closePath(); g.fill();
      } else {
        g.fillRect(SOC.W - post, gTop - post, post, SOC.GOAL_H + post * 2);
        g.fillRect(SOC.W - depth, gTop + 8, post, SOC.GOAL_H - 16);
        g.beginPath();
        g.moveTo(SOC.W, gTop); g.lineTo(SOC.W - depth, gTop + 10);
        g.lineTo(SOC.W - depth, gTop + 10 + post); g.lineTo(SOC.W, gTop + post);
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(242,244,247,.75)';
        g.beginPath();
        g.moveTo(SOC.W, gBot); g.lineTo(SOC.W - depth, gBot - 10);
        g.lineTo(SOC.W - depth, gBot - 10 + 3); g.lineTo(SOC.W, gBot + 3);
        g.closePath(); g.fill();
      }
    }

    function drawF1(g, color) {
      const hw = SOC.CAR_W / 2, hh = SOC.CAR_H / 2;
      g.fillStyle = '#1a1a1e';
      g.fillRect(hw - 14, -hh - 3, 10, 5);
      g.fillRect(hw - 14, hh - 2, 10, 5);
      g.fillRect(-hw + 5, -hh - 3, 11, 5);
      g.fillRect(-hw + 5, hh - 2, 11, 5);
      g.fillStyle = 'rgba(255,255,255,.12)';
      g.fillRect(hw - 12, -hh - 2, 3, 3);
      g.fillRect(hw - 12, hh - 1, 3, 3);
      g.fillStyle = shade(color, -25);
      g.fillRect(hw - 5, -hh - 1, 7, SOC.CAR_H + 2);
      g.fillStyle = shade(color, 10);
      g.fillRect(hw - 4, -hh + 2, 5, 4);
      g.fillRect(hw - 4, hh - 6, 5, 4);
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(hw - 2, -3);
      g.lineTo(hw - 12, -hh + 5);
      g.lineTo(hw - 16, -hh + 7);
      g.lineTo(hw - 16, hh - 7);
      g.lineTo(hw - 12, hh - 5);
      g.lineTo(hw - 2, 3);
      g.closePath(); g.fill();
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(hw - 14, -hh + 4);
      g.lineTo(-hw + 10, -hh + 3);
      g.lineTo(-hw + 6, -hh + 6);
      g.lineTo(-hw + 6, hh - 6);
      g.lineTo(-hw + 10, hh - 3);
      g.lineTo(hw - 14, hh - 4);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(20,22,28,.85)';
      g.beginPath();
      g.ellipse(2, 0, 7, 5, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = shade(color, 35);
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(8, -4); g.lineTo(-2, -5); g.lineTo(-2, 5); g.lineTo(8, 4);
      g.stroke();
      g.fillStyle = shade(color, 20);
      g.fillRect(-16, -2.5, 12, 5);
      g.fillStyle = shade(color, -30);
      g.fillRect(-hw + 4, -hh - 2, 4, SOC.CAR_H + 4);
      g.fillStyle = shade(color, 5);
      g.fillRect(-hw + 2, -hh + 1, 8, 3);
      g.fillRect(-hw + 2, hh - 4, 8, 3);
      g.fillStyle = '#222';
      g.fillRect(-hw + 7, -hh - 3, 2, 6);
      g.fillRect(-hw + 7, hh - 3, 2, 6);
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.fillRect(hw - 26, -2, 6, 4);
    }

    function shade(hex, amt) {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!m) return hex;
      const clamp = (n) => Math.max(0, Math.min(255, n));
      const r = clamp(parseInt(m[1], 16) + amt);
      const g = clamp(parseInt(m[2], 16) + amt);
      const b = clamp(parseInt(m[3], 16) + amt);
      return `rgb(${r},${g},${b})`;
    }

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
      for (let i = 0; i < SOC.W; i += 40) {
        g.fillStyle = i % 80 === 0 ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.04)';
        g.fillRect(i, 0, 40, SOC.H);
      }
      g.strokeStyle = 'rgba(255,255,255,.13)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(SOC.W / 2, 0); g.lineTo(SOC.W / 2, SOC.H); g.stroke();
      g.beginPath(); g.arc(SOC.W / 2, SOC.H / 2, 60, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(18, SOC.H / 2, 36, -Math.PI / 2.4, Math.PI / 2.4); g.stroke();
      g.beginPath(); g.arc(SOC.W - 18, SOC.H / 2, 36, Math.PI - Math.PI / 2.4, Math.PI + Math.PI / 2.4); g.stroke();

      drawGoal(g, 'L', 'rgba(127,168,255,.14)');
      drawGoal(g, 'R', 'rgba(255,127,168,.14)');

      for (const r of ['A', 'B']) {
        const c = st.cars[r];
        g.save();
        g.translate(c.x, c.y);
        g.rotate(c.a);
        drawF1(g, r === 'A' ? P1 : P2);
        g.restore();
      }
      const grd = g.createRadialGradient(
        st.ball.x - 3, st.ball.y - 3, 2,
        st.ball.x, st.ball.y, SOC.BALL_R
      );
      grd.addColorStop(0, '#FFE6A8');
      grd.addColorStop(1, CANC);
      g.fillStyle = grd;
      g.beginPath(); g.arc(st.ball.x, st.ball.y, SOC.BALL_R, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5;
      g.stroke();
    }

    return () => { cancelAnimationFrame(raf); clearInterval(net); };
  }, [phase, role, rt, pausedRef, keys, finish]);

  const mm = String(Math.floor(hud.t / 60));
  const ss = String(hud.t % 60).padStart(2, '0');

  return (
    <div className="sc-page sc-embedded">
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
