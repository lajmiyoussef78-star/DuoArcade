// src/pages/Soccer.jsx — symmetric browser client for server-authoritative Micro Soccer.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MATCH_SECONDS,
  SOC,
  SOCCER_CONTACT_RADIUS,
  socInitial,
  socStepCar,
} from '../lib/soccer.js';
import {
  constrainPredictedCarToBall,
  createSoccerClock,
  createSoccerMetrics,
  createSoccerSnapshotBuffer,
  reconcileOwnCar,
  SOC_NET_HZ,
  SOC_NET_INTERVAL_MS,
  SOC_RENDER_DELAY_MS,
  validateSoccerMsg,
} from '../lib/soccerNet.js';
import Dpad, { useKeys } from '../games-soccer/Dpad.jsx';
import '../styles/soccer.css';

const INPUT_INTERVAL_MS = 40; // 25 Hz, below the server's input-rate ceiling.
const DEFAULT_TICK_HZ = 60;

function cloneState(state) {
  return {
    cars: { A: { ...state.cars.A }, B: { ...state.cars.B } },
    ball: { ...state.ball },
    score: { ...state.score },
  };
}

function normalizedKeys(keys) {
  return {
    up: keys?.up === true,
    down: keys?.down === true,
    left: keys?.left === true,
    right: keys?.right === true,
  };
}

export default function Soccer({
  myRole,
  matchId,
  names = {},
  rt,
  onComplete,
  pausedRef,
}) {
  const role = myRole;
  const peerRole = role === 'A' ? 'B' : 'A';
  const safeMatchId = String(matchId || '');
  const [phase, setPhase] = useState('connecting');
  const [hud, setHud] = useState({ A: 0, B: 0, t: MATCH_SECONDS });
  const [result, setResult] = useState(null);

  const canvasRef = useRef(null);
  const keys = useKeys();
  const renderStateRef = useRef(socInitial());
  const ownCarRef = useRef(null);
  const latestSnapshotRef = useRef(null);
  const snapshotsRef = useRef(null);
  const clockRef = useRef(null);
  if (!snapshotsRef.current) snapshotsRef.current = createSoccerSnapshotBuffer();
  if (!clockRef.current) clockRef.current = createSoccerClock();

  const metricsRef = useRef(null);
  const rttRef = useRef(0);
  const inputSeqRef = useRef(Date.now());
  const lastSnapshotTickRef = useRef(-1);
  const phaseRef = useRef(phase);
  const finishedRef = useRef(false);
  const hudSnapRef = useRef({ A: 0, B: 0, t: MATCH_SECONDS });
  const timelineRef = useRef({ tick: 0, serverTime: 0 });
  const matchMetaRef = useRef({
    endTick: MATCH_SECONDS * DEFAULT_TICK_HZ,
    tickHz: DEFAULT_TICK_HZ,
  });
  phaseRef.current = phase;

  const noteServerTime = useCallback((msg) => {
    if (!Number.isFinite(msg?.serverTime)) return;
    clockRef.current.note({
      serverTime: msg.serverTime,
      localTime: Date.now(),
      rttMs: rttRef.current,
    });
  }, []);

  const updateTimeline = useCallback((msg) => {
    if (Number.isInteger(msg?.tick)) {
      timelineRef.current = {
        tick: msg.tick,
        serverTime: Number.isFinite(msg.serverTime)
          ? msg.serverTime
          : clockRef.current.serverNow(),
      };
    }
    const previous = matchMetaRef.current;
    matchMetaRef.current = {
      endTick: Number.isInteger(msg?.endTick) ? msg.endTick : previous.endTick,
      tickHz: Number.isFinite(msg?.tickHz) && msg.tickHz > 0 ? msg.tickHz : previous.tickHz,
    };
  }, []);

  const finish = useCallback((winner) => {
    if (phaseRef.current === 'done') return;
    setResult(winner);
    setPhase('done');
    if (role === 'A' && !finishedRef.current) {
      finishedRef.current = true;
      onComplete?.(winner);
    }
  }, [onComplete, role]);

  useEffect(() => {
    const metrics = createSoccerMetrics();
    metricsRef.current = metrics;
    if (typeof window !== 'undefined') {
      window.__DUO_GAME_RT_TRANSPORT__ = rt?.transport?.() || null;
      window.__SOC_NET__ = metrics;
      window.__SOC_NET_EXPERIMENT__ = {
        inputHz: 1000 / INPUT_INTERVAL_MS,
        snapshotHz: SOC_NET_HZ,
        snapshotIntervalMs: SOC_NET_INTERVAL_MS,
        renderDelayMs: SOC_RENDER_DELAY_MS,
        authority: 'server',
      };
    }
    return () => {
      metrics.logSummary('Micro Soccer client');
      if (typeof window !== 'undefined' && window.__SOC_NET__ === metrics) {
        delete window.__SOC_NET__;
        delete window.__SOC_NET_EXPERIMENT__;
      }
    };
  }, [rt]);

  useEffect(() => {
    if (!rt || !safeMatchId) {
      setPhase('unavailable');
      return undefined;
    }
    const onReconnect = () => {
      metricsRef.current?.noteReconnect();
      // Re-authenticate the same seat and request the current full snapshot.
      // The server resumes a paused match when both authenticated seats rejoin.
      const msg = { k: 'soccer:join', matchId: safeMatchId };
      metricsRef.current?.noteOut(msg);
      rt.send?.(msg);
    };
    rt._onReconnect = onReconnect;
    return () => {
      if (rt._onReconnect === onReconnect) rt._onReconnect = null;
    };
  }, [rt, safeMatchId]);

  useEffect(() => {
    if (!rt || !safeMatchId) return undefined;

    const receive = (raw) => {
      if (!String(raw?.k || '').startsWith('soccer:')) return;
      const msg = validateSoccerMsg(raw);
      if (!msg || msg.matchId !== safeMatchId) {
        metricsRef.current?.noteDrop();
        return;
      }
      metricsRef.current?.noteIn(msg);

      if (msg.k === 'soccer:start') {
        noteServerTime(msg);
        updateTimeline(msg);
        setPhase('live');
        return;
      }

      if (msg.k === 'soccer:snapshot') {
        if (!snapshotsRef.current.push(msg)) {
          metricsRef.current?.noteDrop();
          return;
        }
        // Keep late packets inside the 100 ms interpolation window, but never
        // rewind prediction, HUD, or the latest authoritative reconciliation.
        if (msg.tick < lastSnapshotTickRef.current) return;
        noteServerTime(msg);
        updateTimeline(msg);

        const previous = latestSnapshotRef.current;
        const goalReset = Boolean(msg.goal)
          || (previous && (
            previous.state.score.A !== msg.state.score.A
            || previous.state.score.B !== msg.state.score.B
          ));
        const prediction = ownCarRef.current;
        if (prediction) {
          metricsRef.current?.notePredictionError(Math.hypot(
            prediction.x - msg.state.cars[role].x,
            prediction.y - msg.state.cars[role].y,
          ));
        }

        lastSnapshotTickRef.current = msg.tick;
        latestSnapshotRef.current = msg;
        if (goalReset) {
          snapshotsRef.current.clear();
          snapshotsRef.current.push(msg);
        }

        if (!ownCarRef.current || goalReset) {
          ownCarRef.current = { ...msg.state.cars[role] };
        }
        if (!previous || goalReset) {
          renderStateRef.current = cloneState(msg.state);
          renderStateRef.current.cars[role] = { ...ownCarRef.current };
        }
        if (phaseRef.current === 'connecting' || phaseRef.current === 'waiting') {
          setPhase('live');
        }
        return;
      }

      if (msg.k === 'soccer:paused') {
        noteServerTime(msg);
        updateTimeline(msg);
        setPhase('paused');
        return;
      }

      if (msg.k === 'soccer:resumed') {
        noteServerTime(msg);
        updateTimeline(msg);
        setPhase('live');
        return;
      }

      if (msg.k === 'soccer:over') {
        noteServerTime(msg);
        updateTimeline(msg);
        if (msg.state && Number.isInteger(msg.tick)) {
          const finalSnapshot = {
            ...msg,
            k: 'soccer:snapshot',
            state: msg.state,
          };
          snapshotsRef.current.clear();
          snapshotsRef.current.push(finalSnapshot);
          latestSnapshotRef.current = finalSnapshot;
          lastSnapshotTickRef.current = Math.max(lastSnapshotTickRef.current, msg.tick);
          ownCarRef.current = { ...msg.state.cars[role] };
          renderStateRef.current = cloneState(msg.state);
        }
        finish(msg.winner);
      }
    };

    if (typeof rt.subscribe === 'function') return rt.subscribe(receive);
    if (typeof rt.on === 'function') {
      rt.on(receive);
      return () => rt.on(null);
    }
    return undefined;
  }, [finish, noteServerTime, role, rt, safeMatchId, updateTimeline]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ready = rt?.whenReady ? await rt.whenReady() : false;
      if (cancelled) return;
      if (ready === false || !safeMatchId) {
        setPhase('unavailable');
        return;
      }
      setPhase(current => current === 'connecting' ? 'waiting' : current);
      const msg = { k: 'soccer:join', matchId: safeMatchId };
      metricsRef.current?.noteOut(msg);
      rt.send(msg);
    })();
    return () => { cancelled = true; };
  }, [rt, safeMatchId]);

  useEffect(() => {
    if (phase !== 'live') return undefined;
    const sendInput = () => {
      if (pausedRef?.current || phaseRef.current !== 'live') return;
      const msg = {
        k: 'soccer:input',
        matchId: safeMatchId,
        seq: ++inputSeqRef.current,
        keys: normalizedKeys(keys.current),
        clientTime: Date.now(),
      };
      metricsRef.current?.noteOut(msg);
      rt?.send?.(msg);
    };
    sendInput();
    const id = setInterval(sendInput, INPUT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [keys, pausedRef, phase, rt, safeMatchId]);

  useEffect(() => {
    if (!rt?.probeClock && !rt?.probeRtt) return undefined;
    let cancelled = false;
    const probe = async () => {
      try {
        if (rt.probeClock) {
          const sample = await rt.probeClock();
          if (!cancelled && sample) {
            rttRef.current = sample.rttMs;
            metricsRef.current?.noteRtt(sample.rttMs);
            clockRef.current.note({
              serverTime: sample.serverTime,
              localTime: sample.localMidpoint,
            });
          }
          return;
        }
        const rttMs = await rt.probeRtt();
        if (!cancelled && Number.isFinite(rttMs)) {
          rttRef.current = rttMs;
          metricsRef.current?.noteRtt(rttMs);
        }
      } catch { /* diagnostics must not affect play */ }
    };
    void probe();
    const id = setInterval(probe, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [rt]);

  useEffect(() => {
    if (phase !== 'live' && phase !== 'paused' && phase !== 'done') return undefined;
    let raf;
    let last = performance.now();

    const loop = (now) => {
      const cpuT0 = performance.now();
      const dt = Math.max(0, Math.min(0.033, (now - last) / 1000));
      last = now;

      const serverNow = clockRef.current.serverNow();
      const sampled = snapshotsRef.current.sampleAt(serverNow - SOC_RENDER_DELAY_MS);
      const latest = latestSnapshotRef.current;
      if (sampled && latest) {
        let ownCar = ownCarRef.current || { ...sampled.state.cars[role] };
        if (phaseRef.current === 'live' && !pausedRef?.current) {
          const previousOwnCar = ownCar;
          ownCar = socStepCar(ownCar, keys.current, dt);
          ownCar = reconcileOwnCar(ownCar, latest.state.cars[role], dt);
          ownCar = constrainPredictedCarToBall(
            previousOwnCar,
            ownCar,
            sampled.state.ball,
            SOCCER_CONTACT_RADIUS,
          );
          ownCarRef.current = ownCar;
        }
        renderStateRef.current = {
          cars: {
            [role]: { ...ownCar },
            [peerRole]: { ...sampled.state.cars[peerRole] },
          },
          ball: { ...sampled.state.ball },
          score: { ...latest.state.score },
        };
      }

      if (!pausedRef?.current) {
        const { endTick, tickHz } = matchMetaRef.current;
        const timeline = timelineRef.current;
        const displayTick = Math.min(endTick, timeline.tick);
        const remaining = Math.max(0, Math.ceil((endTick - displayTick) / tickHz));
        const score = latest?.state.score || renderStateRef.current.score;
        const nextHud = { A: score.A, B: score.B, t: remaining };
        const previousHud = hudSnapRef.current;
        if (
          previousHud.A !== nextHud.A
          || previousHud.B !== nextHud.B
          || previousHud.t !== nextHud.t
        ) {
          hudSnapRef.current = nextHud;
          setHud(nextHud);
        }
      }

      draw();
      metricsRef.current?.noteFrameCpu(performance.now() - cpuT0);
      if (phaseRef.current !== 'done') raf = requestAnimationFrame(loop);
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
      const st = renderStateRef.current;
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

    return () => cancelAnimationFrame(raf);
  }, [keys, pausedRef, peerRole, phase, role]);

  const mm = String(Math.floor(hud.t / 60));
  const ss = String(hud.t % 60).padStart(2, '0');

  return (
    <div className="sc-page sc-embedded">
      {(phase === 'connecting' || phase === 'waiting') && (
        <div className="sc-status">Syncing both players…</div>
      )}
      {phase === 'unavailable' && (
        <div className="sc-status">Game server unavailable. Please try again.</div>
      )}

      {(phase === 'live' || phase === 'paused' || phase === 'done') && (
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
          {phase === 'paused' && (
            <div className="sc-status">Waiting for the other player to reconnect…</div>
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
