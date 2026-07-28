// soccerNet.js — Micro Soccer sync helpers: car interp buffers, ball converge, metrics.
// Ball: moveTowardBall (latest-converge). Cars: createInterpBuffer. Transport: sync.rt().

const KEYS = new Set(['up', 'down', 'left', 'right']);

/**
 * Experiment flag — Micro Soccer net tick only (host `st` + guest `pose` share this interval).
 *   VITE_SOC_NET_INTERVAL_MS=16.7   (wins if set)
 *   VITE_SOC_NET_HZ=20|60           (else)
 * Default: 20 Hz (50 ms). Does not change Socket.IO / sync.rt() / other games.
 */
function resolveSocNetIntervalMs() {
  const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
  const rawMs = env.VITE_SOC_NET_INTERVAL_MS;
  if (rawMs != null && String(rawMs).trim() !== '') {
    const ms = Number(rawMs);
    if (Number.isFinite(ms) && ms >= 8 && ms <= 200) return ms;
  }
  const rawHz = env.VITE_SOC_NET_HZ;
  if (rawHz != null && String(rawHz).trim() !== '') {
    const hz = Number(rawHz);
    if (hz === 60) return 1000 / 60;
    if (hz === 20) return 50;
    if (Number.isFinite(hz) && hz >= 5 && hz <= 120) return 1000 / hz;
  }
  return 50;
}

/** Pose / snapshot interval (ms). Experiment: 50 (20 Hz) or ~16.7 (60 Hz). */
export const SOC_NET_INTERVAL_MS = resolveSocNetIntervalMs();

/** Nominal Hz from the resolved interval (for metrics / __SOC_NET__). */
export const SOC_NET_HZ = Math.round(1000 / SOC_NET_INTERVAL_MS);

/**
 * Car entity-interp delay — FIXED at 50 ms for this experiment.
 * Do not couple to SOC_NET_INTERVAL_MS so 60 Hz snaps do not alter car interpolation.
 */
export const SOC_INTERP_DELAY_MS = 50;

/** Keep a short queue of authoritative samples. */
export const SOC_BUFFER_MAX = 8;

/** After latest sample, allow this much extrapolation of TIME only (hold last pose). */
export const SOC_GRACE_MS = 40;

/** Hard-snap only above this error (px), or on kickoff/goal. */
export const SOC_BALL_EXTREME_PX = 160;

function isFiniteNum(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function validCar(c) {
  return c && isFiniteNum(c.x) && isFiniteNum(c.y) && isFiniteNum(c.a) && isFiniteNum(c.v)
    && c.x >= -50 && c.x <= 900 && c.y >= -50 && c.y <= 600
    && Math.abs(c.v) <= 500;
}

function validBall(b) {
  return b && isFiniteNum(b.x) && isFiniteNum(b.y) && isFiniteNum(b.vx) && isFiniteNum(b.vy)
    && b.x >= -80 && b.x <= 900 && b.y >= -80 && b.y <= 600;
}

function validKeys(k) {
  if (!k || typeof k !== 'object') return false;
  for (const key of Object.keys(k)) {
    if (!KEYS.has(key)) return false;
    if (typeof k[key] !== 'boolean') return false;
  }
  return true;
}

function validScore(s) {
  return s && Number.isInteger(s.A) && Number.isInteger(s.B)
    && s.A >= 0 && s.B >= 0 && s.A < 100 && s.B < 100;
}

/** Reject malformed Micro Soccer RT messages. Returns sanitized copy or null. */
export function validateSoccerMsg(m) {
  if (!m || typeof m !== 'object') return null;
  if (typeof m.k !== 'string' || m.k.length > 24) return null;

  if (m.k === 'start') {
    if (!isFiniteNum(m.endAt)) return null;
    const skew = Math.abs(m.endAt - Date.now());
    if (skew > 5 * 60 * 1000) return null;
    return { k: 'start', endAt: m.endAt };
  }

  if (m.k === 'in') {
    if (!validKeys(m.keys || {})) return null;
    return { k: 'in', keys: { ...m.keys } };
  }

  if (m.k === 'pose') {
    if (m.role !== 'A' && m.role !== 'B') return null;
    if (!validCar(m.car)) return null;
    if (m.keys != null && !validKeys(m.keys)) return null;
    return {
      k: 'pose',
      role: m.role,
      car: { x: m.car.x, y: m.car.y, a: m.car.a, v: m.car.v },
      keys: m.keys ? { ...m.keys } : undefined,
    };
  }

  if (m.k === 'st') {
    const st = m.st;
    if (!st || !validCar(st.cars?.A) || !validCar(st.cars?.B) || !validBall(st.ball) || !validScore(st.score)) {
      return null;
    }
    const seq = isFiniteNum(m.seq) ? m.seq : null;
    return {
      k: 'st',
      seq,
      st: {
        cars: {
          A: { ...st.cars.A },
          B: { ...st.cars.B },
        },
        ball: { ...st.ball },
        score: { A: st.score.A, B: st.score.B },
      },
    };
  }

  if (m.k === 'over') {
    if (m.winner !== 'A' && m.winner !== 'B' && m.winner !== 'draw') return null;
    return { k: 'over', winner: m.winner };
  }

  return null;
}

export function lerpCar(from, to, t) {
  if (!from) return to ? { ...to } : from;
  if (!to) return { ...from };
  const u = Math.max(0, Math.min(1, t));
  return {
    x: from.x + (to.x - from.x) * u,
    y: from.y + (to.y - from.y) * u,
    a: from.a + Math.atan2(Math.sin(to.a - from.a), Math.cos(to.a - from.a)) * u,
    v: from.v + (to.v - from.v) * u,
  };
}

export function lerpBall(from, to, t) {
  if (!from) return to ? { ...to } : from;
  if (!to) return { ...from };
  const u = Math.max(0, Math.min(1, t));
  return {
    x: from.x + (to.x - from.x) * u,
    y: from.y + (to.y - from.y) * u,
    vx: from.vx + (to.vx - from.vx) * u,
    vy: from.vy + (to.vy - from.vy) * u,
  };
}

/**
 * Exponential converge render → latest auth. Frame-rate independent, capped step,
 * no overshoot, no reverse from smoothing (only moves toward target).
 * @param {number} rate 1/s catch-up (e.g. 18)
 * @param {number} maxStepPx max position change per frame
 */
export function moveTowardBall(render, latest, dt, rate = 18, maxStepPx = 12) {
  if (!latest) return render ? { ...render } : latest;
  if (!render) return { ...latest };

  const k = 1 - Math.exp(-Math.max(0, dt) * rate);
  const dx = latest.x - render.x;
  const dy = latest.y - render.y;
  const dist = Math.hypot(dx, dy);

  let mx = dx * k;
  let my = dy * k;
  if (dist > 1e-6) {
    const step = Math.hypot(mx, my);
    if (step > maxStepPx) {
      const s = maxStepPx / step;
      mx *= s;
      my *= s;
    }
  }

  // Velocity: blend toward auth — never invent motion beyond target.
  const dvx = (latest.vx - render.vx) * k;
  const dvy = (latest.vy - render.vy) * k;

  return {
    x: render.x + mx,
    y: render.y + my,
    vx: render.vx + dvx,
    vy: render.vy + dvy,
  };
}

/**
 * Ring of authoritative pose samples for remote cars (NOT used for ball).
 * Render at (now - delay): lerp between bracketing samples.
 */
export function createInterpBuffer({
  delayMs = SOC_INTERP_DELAY_MS,
  graceMs = SOC_GRACE_MS,
  max = SOC_BUFFER_MAX,
  lerpFn,
} = {}) {
  const samples = []; // { t, value }

  return {
    clear() { samples.length = 0; },

    push(value, t = performance.now()) {
      if (!value) return;
      // Monotonic receive time; drop exact dup timestamps.
      if (samples.length && t <= samples[samples.length - 1].t) {
        t = samples[samples.length - 1].t + 0.001;
      }
      samples.push({ t, value: { ...value } });
      while (samples.length > max) samples.shift();
    },

    /** Latest authoritative sample (or null). */
    latest() {
      return samples.length ? samples[samples.length - 1].value : null;
    },

    size() { return samples.length; },

    /**
     * Sample at render time = now - delay.
     * @returns {{ value, mode: 'lerp'|'hold'|'empty'|'single', alpha, errorHint }}
     */
    sample(now = performance.now()) {
      if (!samples.length) return { value: null, mode: 'empty', alpha: 0 };

      const renderAt = now - delayMs;

      if (samples.length === 1) {
        return { value: { ...samples[0].value }, mode: 'single', alpha: 0 };
      }

      // Before oldest → clamp to oldest.
      if (renderAt <= samples[0].t) {
        return { value: { ...samples[0].value }, mode: 'hold', alpha: 0 };
      }

      const latest = samples[samples.length - 1];

      // After latest → hold latest (grace / no invented velocity).
      if (renderAt >= latest.t) {
        return { value: { ...latest.value }, mode: 'hold', alpha: 1 };
      }

      // Find bracketing pair.
      let i = 0;
      while (i < samples.length - 1 && samples[i + 1].t < renderAt) i += 1;
      const a = samples[i];
      const b = samples[i + 1];
      const span = Math.max(0.001, b.t - a.t);
      const alpha = (renderAt - a.t) / span;
      const value = lerpFn(a.value, b.value, alpha);
      return { value, mode: 'lerp', alpha };
    },
  };
}

function stddev(arr, mean) {
  if (!arr.length) return null;
  const v = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}

export function createSoccerMetrics() {
  const t0 = performance.now();
  const m = {
    snapsIn: 0,
    snapsOut: 0,
    posesOut: 0,
    posesIn: 0,
    bytesIn: 0,
    bytesOut: 0,
    stBytesOut: 0,
    stBytesIn: 0,
    dropped: 0,
    rtts: [],
    reconnects: 0,
    lastSnapAt: 0,
    snapGaps: [],
    lastSnapOutAt: 0,
    snapOutGaps: [],
    lastPoseAt: 0,
    poseGaps: [],
    ballCorrSum: 0,
    ballCorrCount: 0,
    ballCorrMax: 0,
    ballErrSum: 0,
    ballErrCount: 0,
    playerInterpSum: 0,
    playerInterpCount: 0,
    playerInterpMax: 0,
    predErrSum: 0,
    predErrCount: 0,
    hardSnaps: 0,
    corrections: 0,
    teleports: 0,
    reverses: 0,
    convergeSumMs: 0,
    convergeCount: 0,
    convergePendingAt: 0,
    kickReactSumMs: 0,
    kickReactCount: 0,
    kickPendingAt: 0,
    frameCpuSumMs: 0,
    frameCpuCount: 0,
    frameCpuMaxMs: 0,
    prevAuthBall: null,
  };

  function sizeOf(p) {
    try { return JSON.stringify(p).length; } catch { return 0; }
  }

  function avg(arr) {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  }

  return {
    noteIn(msg) {
      const n = sizeOf(msg);
      m.bytesIn += n;
      if (msg?.k === 'st') {
        m.snapsIn += 1;
        m.stBytesIn += n;
        const now = performance.now();
        if (m.lastSnapAt) m.snapGaps.push(now - m.lastSnapAt);
        m.lastSnapAt = now;
      }
      if (msg?.k === 'pose') {
        m.posesIn += 1;
        const now = performance.now();
        if (m.lastPoseAt) m.poseGaps.push(now - m.lastPoseAt);
        m.lastPoseAt = now;
      }
    },
    noteOut(msg) {
      const n = sizeOf(msg);
      m.bytesOut += n;
      if (msg?.k === 'st') {
        m.snapsOut += 1;
        m.stBytesOut += n;
        const now = performance.now();
        if (m.lastSnapOutAt) m.snapOutGaps.push(now - m.lastSnapOutAt);
        m.lastSnapOutAt = now;
      }
      if (msg?.k === 'pose' || msg?.k === 'in') m.posesOut += 1;
    },
    noteDrop() { m.dropped += 1; },
    noteRtt(ms) {
      if (Number.isFinite(ms) && ms >= 0 && ms < 5000) m.rtts.push(ms);
    },
    noteReconnect() { m.reconnects += 1; },
    /** Guest: auth ball update — start kick-reaction clock on velocity jump. */
    noteAuthBall(ball) {
      if (!ball) return;
      const prev = m.prevAuthBall;
      m.prevAuthBall = { ...ball };
      if (!prev) return;
      const dV = Math.hypot(ball.vx - prev.vx, ball.vy - prev.vy);
      if (dV > 80 && !m.kickPendingAt) m.kickPendingAt = performance.now();
    },
    /** Guest: after render step — complete kick reaction when speed catches auth. */
    noteRenderBall(render, latest) {
      if (!m.kickPendingAt || !render || !latest) return;
      const authSp = Math.hypot(latest.vx, latest.vy);
      const renSp = Math.hypot(render.vx, render.vy);
      if (authSp > 80 && renSp >= authSp * 0.7) {
        m.kickReactSumMs += performance.now() - m.kickPendingAt;
        m.kickReactCount += 1;
        m.kickPendingAt = 0;
      } else if (performance.now() - m.kickPendingAt > 500) {
        m.kickPendingAt = 0;
      }
    },
    noteFrameCpu(ms) {
      if (!Number.isFinite(ms) || ms < 0) return;
      m.frameCpuSumMs += ms;
      m.frameCpuCount += 1;
      if (ms > m.frameCpuMaxMs) m.frameCpuMaxMs = ms;
    },
    noteBallCorrection(px, { hard = false } = {}) {
      if (!Number.isFinite(px) || px < 0) return;
      m.ballCorrSum += px;
      m.ballCorrCount += 1;
      if (px > m.ballCorrMax) m.ballCorrMax = px;
      m.corrections += 1;
      if (hard) m.hardSnaps += 1;
      if (px > 2) m.convergePendingAt = performance.now();
    },
    noteBallError(px) {
      if (!Number.isFinite(px) || px < 0) return;
      m.ballErrSum += px;
      m.ballErrCount += 1;
      if (px < 2 && m.convergePendingAt) {
        m.convergeSumMs += performance.now() - m.convergePendingAt;
        m.convergeCount += 1;
        m.convergePendingAt = 0;
      }
    },
    noteTeleport() { m.teleports += 1; },
    noteReverse() { m.reverses += 1; },
    notePlayerInterpError(px) {
      if (!Number.isFinite(px) || px < 0) return;
      m.playerInterpSum += px;
      m.playerInterpCount += 1;
      if (px > m.playerInterpMax) m.playerInterpMax = px;
    },
    notePredictionError(px) {
      if (!Number.isFinite(px) || px < 0) return;
      m.predErrSum += px;
      m.predErrCount += 1;
    },
    summary() {
      const elapsedSec = Math.max(0.001, (performance.now() - t0) / 1000);
      const ppsIn = (m.snapsIn + m.posesIn) / elapsedSec;
      const ppsOut = (m.snapsOut + m.posesOut) / elapsedSec;
      const avgBallCorr = m.ballCorrCount ? m.ballCorrSum / m.ballCorrCount : null;
      const avgBallErr = m.ballErrCount ? m.ballErrSum / m.ballErrCount : null;
      const avgPlayerInterp = m.playerInterpCount ? m.playerInterpSum / m.playerInterpCount : null;
      const avgPred = m.predErrCount ? m.predErrSum / m.predErrCount : null;
      const avgSnapGap = avg(m.snapGaps);
      const avgSnapOutGap = avg(m.snapOutGaps);
      const avgPoseGap = avg(m.poseGaps);
      const avgConverge = m.convergeCount ? m.convergeSumMs / m.convergeCount : null;
      const avgKickReact = m.kickReactCount ? m.kickReactSumMs / m.kickReactCount : null;
      const avgFrameCpu = m.frameCpuCount ? m.frameCpuSumMs / m.frameCpuCount : null;
      const stOutCount = m.snapsOut;
      const avgStOutBytes = stOutCount ? m.stBytesOut / stOutCount : null;
      const avgStInBytes = m.snapsIn ? m.stBytesIn / m.snapsIn : null;
      const pktOutCount = m.snapsOut + m.posesOut;
      const avgPktOutBytes = pktOutCount ? m.bytesOut / pktOutCount : null;
      return {
        experiment: {
          socNetHz: SOC_NET_HZ,
          socNetIntervalMs: Math.round(SOC_NET_INTERVAL_MS * 100) / 100,
          carInterpDelayMs: SOC_INTERP_DELAY_MS,
        },
        elapsedSec: Math.round(elapsedSec * 10) / 10,
        ballSyncMode: 'latest-converge',
        // Bandwidth / rate
        avgOutgoingStHz: Math.round((m.snapsOut / elapsedSec) * 10) / 10,
        avgOutgoingStPacketsPerSec: Math.round((m.snapsOut / elapsedSec) * 10) / 10,
        avgStPacketSizeBytes: avgStOutBytes != null ? Math.round(avgStOutBytes) : (avgStInBytes != null ? Math.round(avgStInBytes) : null),
        avgPacketSizeBytes: avgPktOutBytes != null ? Math.round(avgPktOutBytes) : null,
        bandwidthOutKBs: Math.round((m.bytesOut / elapsedSec / 1024) * 100) / 100,
        bandwidthInKBs: Math.round((m.bytesIn / elapsedSec / 1024) * 100) / 100,
        bandwidthPerClientKBs: Math.round(((m.bytesIn + m.bytesOut) / elapsedSec / 1024) * 100) / 100,
        // Timing
        avgRttMs: avg(m.rtts) != null ? Math.round(avg(m.rtts)) : null,
        snapshotSendIntervalMs: avgSnapOutGap != null ? Math.round(avgSnapOutGap * 10) / 10 : null,
        snapshotSendJitterMs: avgSnapOutGap != null
          ? Math.round(stddev(m.snapOutGaps, avgSnapOutGap) * 10) / 10
          : (avgSnapGap != null ? Math.round(stddev(m.snapGaps, avgSnapGap) * 10) / 10 : null),
        // CPU (rAF work ms / frame — browser main-thread proxy)
        avgFrameCpuMs: avgFrameCpu != null ? Math.round(avgFrameCpu * 100) / 100 : null,
        maxFrameCpuMs: m.frameCpuCount ? Math.round(m.frameCpuMaxMs * 100) / 100 : null,
        // Guest ball quality
        avgBallErrorPx: avgBallErr != null ? Math.round(avgBallErr * 10) / 10 : null,
        avgKickReactionMs: avgKickReact != null ? Math.round(avgKickReact) : null,
        kickReactions: m.kickReactCount,
        teleportsGt20Px: m.teleports,
        reverseDirectionCount: m.reverses,
        avgConvergenceMs: avgConverge != null ? Math.round(avgConverge) : null,
        // Legacy / extra
        packetsPerSecIn: Math.round(ppsIn * 10) / 10,
        packetsPerSecOut: Math.round(ppsOut * 10) / 10,
        snapshotHzIn: avgSnapGap ? Math.round((1000 / avgSnapGap) * 10) / 10 : null,
        poseHzIn: avgPoseGap ? Math.round((1000 / avgPoseGap) * 10) / 10 : null,
        avgBallCorrectionPx: avgBallCorr != null ? Math.round(avgBallCorr * 10) / 10 : null,
        maxBallCorrectionPx: m.ballCorrCount ? Math.round(m.ballCorrMax * 10) / 10 : null,
        correctionsPerSec: Math.round((m.corrections / elapsedSec) * 10) / 10,
        hardSnaps: m.hardSnaps,
        avgPlayerInterpErrorPx: avgPlayerInterp != null ? Math.round(avgPlayerInterp * 10) / 10 : null,
        maxPlayerInterpErrorPx: m.playerInterpCount ? Math.round(m.playerInterpMax * 10) / 10 : null,
        avgPredictionErrorPx: avgPred != null ? Math.round(avgPred * 10) / 10 : null,
        snapsIn: m.snapsIn,
        snapsOut: m.snapsOut,
        droppedMalformed: m.dropped,
        reconnects: m.reconnects,
        transportHint: typeof window !== 'undefined'
          ? (window.__DUO_GAME_RT_TRANSPORT__ || null)
          : null,
      };
    },
    logSummary(label = 'Micro Soccer sync') {
      const s = this.summary();
      console.info(`[${label}]`, s);
      return s;
    },
  };
}
