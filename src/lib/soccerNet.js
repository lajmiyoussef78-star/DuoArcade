// soccerNet.js — Micro Soccer sync helpers: car interp buffers, ball converge, metrics.
// Ball: moveTowardBall (latest-converge). Cars: createInterpBuffer. Transport: sync.rt().
import {
  SOCCER_PROTOCOL_VERSION,
  sanitizeSoccerMessage,
} from '../../shared/microSoccerProtocol.js';

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

function resolveRenderDelayMs() {
  const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
  const n = Number(env.VITE_SOC_RENDER_DELAY_MS);
  return Number.isFinite(n) ? Math.max(80, Math.min(120, n)) : 100;
}

/** Authoritative server timeline delay shared by both clients. */
export const SOC_RENDER_DELAY_MS = resolveRenderDelayMs();

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

function protocolVersion(m) {
  const value = m.protocolVersion ?? m.v;
  return value == null ? null : value;
}

function validProtocolVersion(value) {
  return value == null || (Number.isInteger(value) && value > 0 && value <= 32);
}

function normalizeAckEntry(value, fallbackAppliedTick = null) {
  if (Number.isSafeInteger(value) && value >= -1) {
    return {
      seq: value,
      appliedTick: Number.isInteger(fallbackAppliedTick) && fallbackAppliedTick >= 0
        ? fallbackAppliedTick
        : null,
    };
  }
  if (!value || typeof value !== 'object'
    || !Number.isSafeInteger(value.seq) || value.seq < -1) return null;
  const appliedTick = value.appliedTick ?? fallbackAppliedTick;
  if (appliedTick != null && (!Number.isInteger(appliedTick) || appliedTick < 0)) return null;
  return { seq: value.seq, appliedTick: appliedTick ?? null };
}

function normalizeAckMap(value, appliedTicks) {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const A = normalizeAckEntry(value.A, appliedTicks?.A);
  const B = normalizeAckEntry(value.B, appliedTicks?.B);
  if (!A || !B) return undefined;
  return { A, B };
}

function normalizeHeldInputs(value) {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !validKeys(value.A) || !validKeys(value.B)) return undefined;
  return { A: { ...value.A }, B: { ...value.B } };
}

function validState(state) {
  return state && validCar(state.cars?.A) && validCar(state.cars?.B)
    && validBall(state.ball) && validScore(state.score);
}

function cloneValidatedState(state) {
  return {
    cars: { A: { ...state.cars.A }, B: { ...state.cars.B } },
    ball: { ...state.ball },
    score: { ...state.score },
  };
}

function validTickHz(value) {
  return isFiniteNum(value) && value > 0 && value <= 240;
}

function timingFields(m, tick, serverTime) {
  const tickHz = validTickHz(m.tickHz) ? m.tickHz : 60;
  let endTick = Number.isInteger(m.endTick) && m.endTick >= tick ? m.endTick : null;
  if (endTick == null && isFiniteNum(m.endAt) && m.endAt >= serverTime) {
    endTick = tick + Math.round((m.endAt - serverTime) * tickHz / 1000);
  }
  return { endTick, tickHz };
}

function adaptV2ServerMessage(message) {
  const base = {
    ...message,
    protocolVersion: SOCCER_PROTOCOL_VERSION,
  };
  if (message.k === 'soccer:snapshot') {
    const ack = {};
    const inputs = {};
    for (const role of ['A', 'B']) {
      const applied = message.inputsApplied[role];
      const seq = message.acks[role] ?? -1;
      ack[role] = {
        seq,
        appliedTick: applied?.seq === seq ? applied.appliedTick : null,
      };
      inputs[role] = applied?.keys ? { ...applied.keys } : {};
    }
    return {
      ...base,
      state: cloneValidatedState(message.state),
      ack,
      inputs,
    };
  }
  if (message.k === 'soccer:over') {
    return {
      ...base,
      state: cloneValidatedState(message.state),
    };
  }
  return base;
}

/** Reject malformed Micro Soccer RT messages. Returns sanitized copy or null. */
export function validateSoccerMsg(m) {
  if (!m || typeof m !== 'object') return null;
  if (typeof m.k !== 'string' || m.k.length > 24) return null;
  if (m.v === SOCCER_PROTOCOL_VERSION && m.k.startsWith('soccer:')) {
    const message = sanitizeSoccerMessage(m, { direction: 'server' });
    return message ? adaptV2ServerMessage(message) : null;
  }
  const version = protocolVersion(m);
  if (!validProtocolVersion(version)) return null;

  if (m.k === 'start') {
    if (!isFiniteNum(m.endAt)) return null;
    const skew = Math.abs(m.endAt - Date.now());
    if (skew > 5 * 60 * 1000) return null;
    return { k: 'start', endAt: m.endAt };
  }

  if (m.k === 'needstart') {
    return { k: m.k };
  }

  if (m.k === 'soccer:start') {
    if (typeof m.matchId !== 'string' || !m.matchId) return null;
    if (!Number.isInteger(m.tick) || m.tick < 0) return null;
    if (!isFiniteNum(m.serverTime)) return null;
    const timing = timingFields(m, m.tick, m.serverTime);
    if (!Number.isInteger(timing.endTick) || timing.endTick <= m.tick) return null;
    return {
      k: m.k,
      protocolVersion: version,
      matchId: m.matchId,
      tick: m.tick,
      ...timing,
      serverTime: m.serverTime,
    };
  }

  if (m.k === 'soccer:snapshot') {
    const state = m.state || m.st;
    if (typeof m.matchId !== 'string' || !m.matchId) return null;
    if (!Number.isInteger(m.tick) || m.tick < 0 || !isFiniteNum(m.serverTime)) return null;
    if (!validState(state)) return null;
    const ack = normalizeAckMap(m.ack ?? m.acks, m.appliedTick);
    if (ack === undefined) return null;
    const inputs = normalizeHeldInputs(m.inputs ?? m.heldInputs);
    if (inputs === undefined) return null;
    const timing = timingFields(m, m.tick, m.serverTime);
    return {
      k: m.k,
      protocolVersion: version,
      matchId: m.matchId,
      tick: m.tick,
      ...timing,
      serverTime: m.serverTime,
      goal: m.goal === 'A' || m.goal === 'B' ? m.goal : null,
      state: cloneValidatedState(state),
      ack,
      inputs,
    };
  }

  if (m.k === 'soccer:ack') {
    if (typeof m.matchId !== 'string' || !m.matchId) return null;
    if (m.role !== 'A' && m.role !== 'B') return null;
    const ack = normalizeAckEntry(m.ack ?? {
      seq: m.seq,
      appliedTick: m.appliedTick,
    });
    if (!ack || !Number.isFinite(m.serverTime)) return null;
    if (m.tick != null && (!Number.isInteger(m.tick) || m.tick < 0)) return null;
    return {
      k: m.k,
      protocolVersion: version,
      matchId: m.matchId,
      role: m.role,
      ...ack,
      tick: m.tick ?? null,
      serverTime: m.serverTime,
    };
  }

  if (m.k === 'soccer:reject') {
    if (typeof m.matchId !== 'string' || !m.matchId) return null;
    const reason = m.reason ?? m.error ?? m.code;
    if (typeof reason !== 'string' || !reason || reason.length > 64) return null;
    if (m.role != null && m.role !== 'A' && m.role !== 'B') return null;
    if (m.seq != null && (!Number.isSafeInteger(m.seq) || m.seq < 0)) return null;
    if (m.tick != null && (!Number.isInteger(m.tick) || m.tick < 0)) return null;
    if (m.serverTime != null && !Number.isFinite(m.serverTime)) return null;
    return {
      k: m.k,
      protocolVersion: version,
      matchId: m.matchId,
      role: m.role ?? null,
      seq: m.seq ?? null,
      reason,
      tick: m.tick ?? null,
      serverTime: m.serverTime ?? null,
      retryable: m.retryable === true,
    };
  }

  if (m.k === 'soccer:paused' || m.k === 'soccer:resumed') {
    if (typeof m.matchId !== 'string' || !m.matchId) return null;
    if (!Number.isInteger(m.tick) || m.tick < 0 || !isFiniteNum(m.serverTime)) return null;
    return {
      k: m.k,
      protocolVersion: version,
      matchId: m.matchId,
      tick: m.tick,
      serverTime: m.serverTime,
      ...timingFields(m, m.tick, m.serverTime),
    };
  }

  if (m.k === 'soccer:over') {
    if (typeof m.matchId !== 'string' || !m.matchId) return null;
    if (!Number.isInteger(m.tick) || m.tick < 0 || !isFiniteNum(m.serverTime)) return null;
    const winner = m.winner == null ? 'draw' : m.winner;
    if (winner !== 'A' && winner !== 'B' && winner !== 'draw') return null;
    const state = m.state || m.st;
    if (state != null && !validState(state)) return null;
    return {
      k: m.k,
      protocolVersion: version,
      matchId: m.matchId,
      winner,
      tick: m.tick,
      serverTime: m.serverTime,
      ...timingFields(m, m.tick, m.serverTime),
      state: state ? cloneValidatedState(state) : null,
    };
  }

  if (m.k === 'in') {
    if (!validKeys(m.keys || {})) return null;
    return { k: 'in', keys: { ...m.keys } };
  }

  if (m.k === 'pose') {
    if (m.role !== 'A' && m.role !== 'B') return null;
    if (!validCar(m.car)) return null;
    if (m.keys != null && !validKeys(m.keys)) return null;
    if (m.seq != null && (!Number.isInteger(m.seq) || m.seq < 0)) return null;
    return {
      k: 'pose',
      seq: m.seq ?? null,
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

  if (m.k === 'ball' || m.k === 'ballHit') {
    if (!validBall(m.ball)) return null;
    if (!Number.isInteger(m.seq) || m.seq < 0) return null;
    if (m.sentAt != null && !isFiniteNum(m.sentAt)) return null;
    return {
      k: m.k,
      seq: m.seq,
      ball: { ...m.ball },
      sentAt: m.sentAt ?? null,
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

function cloneState(state) {
  return {
    cars: { A: { ...state.cars.A }, B: { ...state.cars.B } },
    ball: { ...state.ball },
    score: { ...state.score },
  };
}

function lerpState(a, b, alpha) {
  return {
    cars: {
      A: lerpCar(a.cars.A, b.cars.A, alpha),
      B: lerpCar(a.cars.B, b.cars.B, alpha),
    },
    ball: lerpBall(a.ball, b.ball, alpha),
    score: alpha < 1 ? { ...a.score } : { ...b.score },
  };
}

/** Ordered authoritative snapshots sampled by absolute server time. */
export function createSoccerSnapshotBuffer({ max = 16 } = {}) {
  const samples = [];
  return {
    clear() { samples.length = 0; },
    size() { return samples.length; },
    latest() { return samples.length ? samples[samples.length - 1] : null; },
    push(snapshot) {
      if (!snapshot?.state || !Number.isFinite(snapshot.serverTime) || !Number.isInteger(snapshot.tick)) return false;
      if (samples.some(sample => sample.tick === snapshot.tick)) return false;
      const copy = { ...snapshot, state: cloneState(snapshot.state) };
      const insertAt = samples.findIndex(sample => sample.tick > snapshot.tick);
      if (insertAt < 0) samples.push(copy);
      else samples.splice(insertAt, 0, copy);
      while (samples.length > max) samples.shift();
      return true;
    },
    sampleAt(serverTime) {
      if (!samples.length) return null;
      if (samples.length === 1 || serverTime <= samples[0].serverTime) {
        return { ...samples[0], state: cloneState(samples[0].state), alpha: 0 };
      }
      const latest = samples[samples.length - 1];
      if (serverTime >= latest.serverTime) {
        return { ...latest, state: cloneState(latest.state), alpha: 1 };
      }
      let i = 0;
      while (i < samples.length - 1 && samples[i + 1].serverTime < serverTime) i += 1;
      const a = samples[i];
      const b = samples[i + 1];
      const span = Math.max(0.001, b.serverTime - a.serverTime);
      const alpha = Math.max(0, Math.min(1, (serverTime - a.serverTime) / span));
      return {
        ...b,
        tick: a.tick + (b.tick - a.tick) * alpha,
        serverTime,
        state: lerpState(a.state, b.state, alpha),
        alpha,
      };
    },
  };
}

export function reconcileOwnCar(predicted, authoritative, dt, {
  softPx = 8,
  hardPx = 45,
  rate = 10,
} = {}) {
  if (!predicted) return authoritative ? { ...authoritative } : predicted;
  if (!authoritative) return { ...predicted };
  const error = Math.hypot(authoritative.x - predicted.x, authoritative.y - predicted.y);
  if (error >= hardPx) return { ...authoritative };
  if (error <= softPx) return { ...predicted };
  return lerpCar(predicted, authoritative, 1 - Math.exp(-Math.max(0, dt) * rate));
}

/**
 * Keep an immediate local car outside the delayed shared ball render.
 * This only constrains the car's visual prediction; the server still owns
 * collision response and the ball timeline.
 */
export function constrainPredictedCarToBall(previous, predicted, ball, minDistance) {
  if (!predicted || !ball || !Number.isFinite(minDistance) || minDistance <= 0) {
    return predicted ? { ...predicted } : predicted;
  }
  const dx = predicted.x - ball.x;
  const dy = predicted.y - ball.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= minDistance) return { ...predicted };

  // Preserve the approach side so a fast frame cannot visually tunnel through.
  let nx = (previous?.x ?? predicted.x) - ball.x;
  let ny = (previous?.y ?? predicted.y) - ball.y;
  let normalLength = Math.hypot(nx, ny);
  if (normalLength < 1e-6) {
    nx = dx;
    ny = dy;
    normalLength = distance;
  }
  if (normalLength < 1e-6) {
    nx = -Math.cos(predicted.a || 0);
    ny = -Math.sin(predicted.a || 0);
    normalLength = 1;
  }
  nx /= normalLength;
  ny /= normalLength;
  return {
    ...predicted,
    x: ball.x + nx * minDistance,
    y: ball.y + ny * minDistance,
  };
}

export function createSoccerClock() {
  let offsetMs = 0;
  let ready = false;
  return {
    note({ serverTime, localTime = Date.now(), rttMs = 0 } = {}) {
      if (!Number.isFinite(serverTime) || !Number.isFinite(localTime)) return offsetMs;
      const sample = serverTime + Math.max(0, Number(rttMs) || 0) / 2 - localTime;
      offsetMs = ready ? offsetMs * 0.85 + sample * 0.15 : sample;
      ready = true;
      return offsetMs;
    },
    serverNow(localTime = Date.now()) { return localTime + offsetMs; },
    offset() { return offsetMs; },
    isReady() { return ready; },
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
    ballCorrSamples: [],
    ballErrSum: 0,
    ballErrCount: 0,
    playerInterpSum: 0,
    playerInterpCount: 0,
    playerInterpMax: 0,
    predErrSum: 0,
    predErrCount: 0,
    predErrSamples: [],
    acksIn: 0,
    rejectsIn: 0,
    pendingInputs: 0,
    replayTicks: 0,
    replayTicksLast: 0,
    replayTicksMax: 0,
    replayErrors: 0,
    predictorHardResets: 0,
    predictorHardResetReasons: {},
    protocolMismatches: 0,
    predictionEnabled: true,
    ackLagTicks: null,
    contactFrameDeltas: [],
    adaptiveDelaySamples: [],
    adaptiveNoiseMs: null,
    adaptiveReplayWindowTicks: null,
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

  function percentile(arr, quantile) {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)];
  }

  return {
    noteIn(msg) {
      const n = sizeOf(msg);
      m.bytesIn += n;
      if (msg?.k === 'st' || msg?.k === 'soccer:snapshot') {
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
      if (msg?.k === 'soccer:ack') m.acksIn += 1;
      if (msg?.k === 'soccer:reject') m.rejectsIn += 1;
    },
    noteOut(msg) {
      const n = sizeOf(msg);
      m.bytesOut += n;
      if (msg?.k === 'st' || msg?.k === 'soccer:snapshot') {
        m.snapsOut += 1;
        m.stBytesOut += n;
        const now = performance.now();
        if (m.lastSnapOutAt) m.snapOutGaps.push(now - m.lastSnapOutAt);
        m.lastSnapOutAt = now;
      }
      if (msg?.k === 'pose' || msg?.k === 'in' || msg?.k === 'soccer:input') m.posesOut += 1;
    },
    noteDrop() { m.dropped += 1; },
    noteRtt(ms) {
      if (Number.isFinite(ms) && ms >= 0 && ms < 5000) m.rtts.push(ms);
    },
    noteReconnect() { m.reconnects += 1; },
    noteInputAck() { m.acksIn += 1; },
    noteInputReject() { m.rejectsIn += 1; },
    noteContactFrameDelta(frames) {
      if (!Number.isInteger(frames) || frames < 0 || frames > 60) return;
      m.contactFrameDeltas.push(frames);
      if (m.contactFrameDeltas.length > 240) m.contactFrameDeltas.shift();
    },
    /**
     * Consume createSoccerPredictor().getMetrics(). Gauges are replaced while
     * adaptive delay is sampled for a stable session summary.
     */
    notePrediction(metrics) {
      if (!metrics || typeof metrics !== 'object') return;
      if (Number.isInteger(metrics.pendingInputs) && metrics.pendingInputs >= 0) {
        m.pendingInputs = metrics.pendingInputs;
      }
      if (Number.isFinite(metrics.replayTicks) && metrics.replayTicks >= 0) {
        m.replayTicks = metrics.replayTicks;
      }
      if (Number.isFinite(metrics.replayTicksLast) && metrics.replayTicksLast >= 0) {
        m.replayTicksLast = metrics.replayTicksLast;
      }
      if (Number.isFinite(metrics.replayTicksMax) && metrics.replayTicksMax >= 0) {
        m.replayTicksMax = metrics.replayTicksMax;
      }
      if (Number.isFinite(metrics.replayErrors) && metrics.replayErrors >= 0) {
        m.replayErrors = metrics.replayErrors;
      }
      if (Number.isFinite(metrics.hardResets) && metrics.hardResets >= 0) {
        m.predictorHardResets = metrics.hardResets;
      }
      if (metrics.hardResetReasons && typeof metrics.hardResetReasons === 'object') {
        m.predictorHardResetReasons = { ...metrics.hardResetReasons };
      }
      if (Number.isFinite(metrics.protocolMismatches) && metrics.protocolMismatches >= 0) {
        m.protocolMismatches = metrics.protocolMismatches;
      }
      if (typeof metrics.predictionEnabled === 'boolean') {
        m.predictionEnabled = metrics.predictionEnabled;
      }
      if (metrics.ackLagTicks == null
        || (Number.isInteger(metrics.ackLagTicks) && metrics.ackLagTicks >= 0)) {
        m.ackLagTicks = metrics.ackLagTicks;
      }
      if (Number.isFinite(metrics.adaptiveDelayMs) && metrics.adaptiveDelayMs >= 0) {
        m.adaptiveDelaySamples.push(metrics.adaptiveDelayMs);
        if (m.adaptiveDelaySamples.length > 240) m.adaptiveDelaySamples.shift();
      }
      if (Number.isFinite(metrics.adaptiveNoiseMs) && metrics.adaptiveNoiseMs >= 0) {
        m.adaptiveNoiseMs = metrics.adaptiveNoiseMs;
      }
      if (Number.isFinite(metrics.adaptiveReplayWindowTicks)
        && metrics.adaptiveReplayWindowTicks >= 0) {
        m.adaptiveReplayWindowTicks = metrics.adaptiveReplayWindowTicks;
      }
    },
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
      m.ballCorrSamples.push(px);
      if (m.ballCorrSamples.length > 600) m.ballCorrSamples.shift();
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
      m.predErrSamples.push(px);
      if (m.predErrSamples.length > 600) m.predErrSamples.shift();
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
      const avgAdaptiveDelay = avg(m.adaptiveDelaySamples);
      const p95BallCorr = percentile(m.ballCorrSamples, 0.95);
      const p95Pred = percentile(m.predErrSamples, 0.95);
      const p95ContactFrames = percentile(m.contactFrameDeltas, 0.95);
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
        ballSyncMode: 'predictive-authoritative-v2',
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
        p95BallCorrectionPx: p95BallCorr != null ? Math.round(p95BallCorr * 10) / 10 : null,
        correctionsPerSec: Math.round((m.corrections / elapsedSec) * 10) / 10,
        hardSnaps: m.hardSnaps,
        avgPlayerInterpErrorPx: avgPlayerInterp != null ? Math.round(avgPlayerInterp * 10) / 10 : null,
        maxPlayerInterpErrorPx: m.playerInterpCount ? Math.round(m.playerInterpMax * 10) / 10 : null,
        avgPredictionErrorPx: avgPred != null ? Math.round(avgPred * 10) / 10 : null,
        p95PredictionErrorPx: p95Pred != null ? Math.round(p95Pred * 10) / 10 : null,
        inputAcksIn: m.acksIn,
        inputRejectsIn: m.rejectsIn,
        pendingInputs: m.pendingInputs,
        replayTicks: m.replayTicks,
        replayTicksLast: m.replayTicksLast,
        replayTicksMax: m.replayTicksMax,
        replayErrors: m.replayErrors,
        predictorHardResets: m.predictorHardResets,
        predictorHardResetReasons: { ...m.predictorHardResetReasons },
        protocolMismatches: m.protocolMismatches,
        predictionEnabled: m.predictionEnabled,
        acknowledgementLagTicks: m.ackLagTicks,
        contactResponseP95Frames: p95ContactFrames,
        adaptiveDelayMs: avgAdaptiveDelay != null
          ? Math.round(avgAdaptiveDelay * 10) / 10
          : null,
        adaptiveNoiseMs: m.adaptiveNoiseMs != null
          ? Math.round(m.adaptiveNoiseMs * 10) / 10
          : null,
        adaptiveReplayWindowTicks: m.adaptiveReplayWindowTicks,
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
