import {
  SOCCER_TICK_HZ,
  socReplayInputChanges,
} from '../../shared/microSoccerPhysics.js';
import { SOCCER_PROTOCOL_VERSION } from '../../shared/microSoccerProtocol.js';

export const SOCCER_PREDICT_PROTOCOL_VERSION = SOCCER_PROTOCOL_VERSION;
export const SOCCER_PREDICT_RING_MAX = 128;
export const SOCCER_PREDICT_MAX_REPLAY_TICKS = 90;

const ROLES = Object.freeze(['A', 'B']);
const HARD_SEED_REASONS = new Set([
  'first_snapshot',
  'goal',
  'reconnect',
  'extreme',
  'protocol_mismatch',
]);
const NEUTRAL_KEYS = Object.freeze({
  up: false,
  down: false,
  left: false,
  right: false,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function normalizeSoccerKeys(keys) {
  return {
    up: keys?.up === true,
    down: keys?.down === true,
    left: keys?.left === true,
    right: keys?.right === true,
  };
}

export function cloneSoccerState(state) {
  if (!state?.cars?.A || !state?.cars?.B || !state.ball || !state.score) return null;
  return {
    cars: {
      A: { ...state.cars.A },
      B: { ...state.cars.B },
    },
    ball: { ...state.ball },
    score: { ...state.score },
  };
}

function normalizeAck(value) {
  if (Number.isSafeInteger(value) && value >= -1) {
    return { seq: value, appliedTick: null };
  }
  if (!value || !Number.isSafeInteger(value.seq) || value.seq < -1) {
    return { seq: -1, appliedTick: null };
  }
  return {
    seq: value.seq,
    appliedTick: Number.isInteger(value.appliedTick) && value.appliedTick >= 0
      ? value.appliedTick
      : null,
  };
}

function normalizeAckMap(ack) {
  return {
    A: normalizeAck(ack?.A),
    B: normalizeAck(ack?.B),
  };
}

function statePositionErrors(a, b) {
  if (!a || !b) return { A: Infinity, B: Infinity, ball: Infinity, max: Infinity };
  const errors = {
    A: Math.hypot(a.cars.A.x - b.cars.A.x, a.cars.A.y - b.cars.A.y),
    B: Math.hypot(a.cars.B.x - b.cars.B.x, a.cars.B.y - b.cars.B.y),
    ball: Math.hypot(a.ball.x - b.ball.x, a.ball.y - b.ball.y),
  };
  return { ...errors, max: Math.max(errors.A, errors.B, errors.ball) };
}

/**
 * RTT/snapshot-noise estimator used to bound prediction replay and expose a
 * small conservative presentation delay. Values are deliberately clamped so
 * a single bad packet cannot create seconds of client-side latency or replay.
 */
export function createSoccerAdaptiveWindow({
  tickHz = SOCCER_TICK_HZ,
  minDelayMs = 0,
  maxDelayMs = 100,
  minReplayTicks = 6,
  maxReplayTicks = SOCCER_PREDICT_MAX_REPLAY_TICKS,
} = {}) {
  let rttMean = 0;
  let rttJitter = 0;
  let gapMean = 1000 / 20;
  let gapJitter = 0;
  let lastSnapshotAt = null;
  let rttSamples = 0;
  let gapSamples = 0;

  const ewma = (prior, sample, alpha) => prior + (sample - prior) * alpha;

  function noteRtt(ms) {
    if (!Number.isFinite(ms) || ms < 0 || ms > 5000) return false;
    const sample = clamp(ms, 0, 1000);
    if (!rttSamples) rttMean = sample;
    else rttMean = ewma(rttMean, sample, 0.15);
    rttJitter = !rttSamples
      ? 0
      : ewma(rttJitter, Math.abs(sample - rttMean), 0.2);
    rttSamples++;
    return true;
  }

  function noteSnapshot(localTime) {
    if (!Number.isFinite(localTime)) return false;
    if (lastSnapshotAt != null) {
      const sample = clamp(localTime - lastSnapshotAt, 0, 2000);
      if (!gapSamples) gapMean = sample;
      else gapMean = ewma(gapMean, sample, 0.15);
      gapJitter = !gapSamples
        ? 0
        : ewma(gapJitter, Math.abs(sample - gapMean), 0.2);
      gapSamples++;
    }
    lastSnapshotAt = localTime;
    return true;
  }

  function estimate() {
    const tickMs = 1000 / tickHz;
    const noiseMs = clamp(rttJitter + gapJitter, 0, 250);
    const delayMs = clamp(rttMean * 0.2 + noiseMs * 1.5, minDelayMs, maxDelayMs);
    const replayMs = gapMean + rttMean * 0.5 + noiseMs * 2 + tickMs * 2;
    return {
      rttMs: rttSamples ? rttMean : null,
      rttJitterMs: rttSamples ? rttJitter : null,
      snapshotGapMs: gapSamples ? gapMean : null,
      snapshotJitterMs: gapSamples ? gapJitter : null,
      noiseMs,
      delayMs,
      delayTicks: Math.round(delayMs / tickMs),
      maxReplayTicks: clamp(
        Math.ceil(replayMs / tickMs),
        minReplayTicks,
        maxReplayTicks,
      ),
    };
  }

  return {
    noteRtt,
    noteSnapshot,
    estimate,
    reset() {
      rttMean = 0;
      rttJitter = 0;
      gapMean = 1000 / 20;
      gapJitter = 0;
      lastSnapshotAt = null;
      rttSamples = 0;
      gapSamples = 0;
    },
  };
}

export function computeSoccerTargetTick(anchor, serverNow, {
  tickHz = SOCCER_TICK_HZ,
  delayMs = 0,
  maxReplayTicks = SOCCER_PREDICT_MAX_REPLAY_TICKS,
} = {}) {
  if (!anchor || !Number.isInteger(anchor.tick) || !Number.isFinite(anchor.serverTime)) {
    return 0;
  }
  const elapsedMs = Math.max(0, finite(serverNow) - anchor.serverTime - Math.max(0, delayMs));
  const elapsedTicks = Math.floor(elapsedMs * tickHz / 1000);
  return anchor.tick + clamp(elapsedTicks, 0, maxReplayTicks);
}

function boundedMove(from, to, alpha, maxStep) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let mx = dx * alpha;
  let my = dy * alpha;
  const length = Math.hypot(mx, my);
  if (length > maxStep && length > 0) {
    mx *= maxStep / length;
    my *= maxStep / length;
  }
  return { x: from.x + mx, y: from.y + my };
}

/**
 * Reconciles visual state only. The simulation state passed as `target` is
 * never modified. Callers retain the returned state as their presentation
 * state while the predictor continues replaying its independent simulation.
 */
export function reconcileSoccerPresentation(current, target, dt, {
  hardReason = null,
  extremePx = 160,
  carRate = 12,
  ballRate = 16,
  carMaxStepPx = 8,
  ballMaxStepPx = 12,
} = {}) {
  const destination = cloneSoccerState(target);
  if (!destination) {
    return { state: cloneSoccerState(current), hardReset: false, reason: null, errors: null };
  }
  const source = cloneSoccerState(current);
  const errors = source ? {
    A: Math.hypot(destination.cars.A.x - source.cars.A.x, destination.cars.A.y - source.cars.A.y),
    B: Math.hypot(destination.cars.B.x - source.cars.B.x, destination.cars.B.y - source.cars.B.y),
    ball: Math.hypot(destination.ball.x - source.ball.x, destination.ball.y - source.ball.y),
  } : null;
  const extreme = errors && Math.max(errors.A, errors.B, errors.ball) >= extremePx;
  const reason = hardReason || (extreme ? 'extreme' : null);
  if (!source || reason) {
    return { state: destination, hardReset: true, reason: reason || 'first_snapshot', errors };
  }

  const carAlpha = 1 - Math.exp(-Math.max(0, dt) * carRate);
  const ballAlpha = 1 - Math.exp(-Math.max(0, dt) * ballRate);
  const state = cloneSoccerState(source);
  for (const role of ROLES) {
    const moved = boundedMove(source.cars[role], destination.cars[role], carAlpha, carMaxStepPx);
    const angleDelta = Math.atan2(
      Math.sin(destination.cars[role].a - source.cars[role].a),
      Math.cos(destination.cars[role].a - source.cars[role].a),
    );
    state.cars[role] = {
      x: moved.x,
      y: moved.y,
      a: source.cars[role].a + angleDelta * carAlpha,
      v: source.cars[role].v + (destination.cars[role].v - source.cars[role].v) * carAlpha,
    };
  }
  const movedBall = boundedMove(source.ball, destination.ball, ballAlpha, ballMaxStepPx);
  state.ball = {
    x: movedBall.x,
    y: movedBall.y,
    vx: source.ball.vx + (destination.ball.vx - source.ball.vx) * ballAlpha,
    vy: source.ball.vy + (destination.ball.vy - source.ball.vy) * ballAlpha,
  };
  state.score = { ...destination.score };
  return { state, hardReset: false, reason: null, errors };
}

export function createSoccerPredictor({
  localRole = 'A',
  tickHz = SOCCER_TICK_HZ,
  protocolVersion = SOCCER_PREDICT_PROTOCOL_VERSION,
  ringMax = SOCCER_PREDICT_RING_MAX,
  extremePx = 160,
  adaptive = createSoccerAdaptiveWindow({ tickHz }),
  now = () => Date.now(),
} = {}) {
  if (!ROLES.includes(localRole)) throw new Error('localRole must be A or B');
  if (!Number.isInteger(ringMax) || ringMax < 1) throw new Error('ringMax must be positive');

  let anchor = null;
  let simulation = null;
  let simulationTick = 0;
  let targetFloor = 0;
  let clockOffsetMs = 0;
  let clockReady = false;
  let predictionEnabled = true;
  let localRing = [];
  let localFloor = null;
  let heldInputs = {
    A: normalizeSoccerKeys(),
    B: normalizeSoccerKeys(),
  };
  let ackMap = normalizeAckMap();
  let lastHardSeedReason = null;
  const counters = {
    replayTicks: 0,
    replayTicksLast: 0,
    replayTicksMax: 0,
    replayErrors: 0,
    hardResets: 0,
    hardResetReasons: {},
    droppedAnchors: 0,
    ringEvictions: 0,
    ackCorrections: 0,
    inputRejects: 0,
    rejectedInputs: 0,
    protocolMismatches: 0,
    targetClamps: 0,
  };

  function noteClock(serverTime, localTime, rttMs) {
    const sample = serverTime + Math.max(0, finite(rttMs)) / 2 - localTime;
    clockOffsetMs = clockReady ? clockOffsetMs * 0.85 + sample * 0.15 : sample;
    clockReady = true;
  }

  function noteHardSeed(reason) {
    const normalized = HARD_SEED_REASONS.has(reason) ? reason : 'extreme';
    lastHardSeedReason = normalized;
    counters.hardResets++;
    counters.hardResetReasons[normalized] = (counters.hardResetReasons[normalized] || 0) + 1;
    return normalized;
  }

  function effectiveTick(entry) {
    return entry.appliedTick ?? entry.predictedTick;
  }

  function replay(toTick) {
    if (!anchor || !predictionEnabled) {
      simulation = anchor ? cloneSoccerState(anchor.state) : null;
      simulationTick = anchor?.tick ?? 0;
      counters.replayTicksLast = 0;
      return simulation;
    }
    const events = [];
    if (localFloor && localFloor.seq > anchor.ack[localRole].seq) events.push(localFloor);
    for (const entry of localRing) {
      if (entry.seq > anchor.ack[localRole].seq) events.push(entry);
    }
    events.sort((a, b) => effectiveTick(a) - effectiveTick(b) || a.seq - b.seq);

    let replayed = 0;
    try {
      const result = socReplayInputChanges(anchor.state, {
        startTick: anchor.tick,
        endTick: toTick,
        inputs: anchor.inputs,
        inputChanges: events.map(entry => ({
          role: localRole,
          seq: entry.seq,
          appliedTick: effectiveTick(entry),
          keys: entry.keys,
        })),
        authoritativeGoals: false,
      });
      simulation = cloneSoccerState(result.state);
      simulationTick = result.tick;
      replayed = result.tick - anchor.tick;
    } catch (error) {
      counters.replayErrors++;
      simulation = cloneSoccerState(anchor.state);
      simulationTick = anchor.tick;
      counters.replayTicksLast = 0;
      return simulation;
    }
    counters.replayTicks += replayed;
    counters.replayTicksLast = replayed;
    counters.replayTicksMax = Math.max(counters.replayTicksMax, replayed);
    return simulation;
  }

  function serverNow(localTime = now()) {
    return localTime + clockOffsetMs;
  }

  function targetTick(localTime = now()) {
    if (!anchor) return 0;
    const estimate = adaptive.estimate();
    const unclampedTicks = Math.floor(
      Math.max(0, serverNow(localTime) - anchor.serverTime - estimate.delayMs)
      * tickHz / 1000,
    );
    if (unclampedTicks > estimate.maxReplayTicks) counters.targetClamps++;
    return computeSoccerTargetTick(anchor, serverNow(localTime), {
      tickHz,
      delayMs: estimate.delayMs,
      maxReplayTicks: estimate.maxReplayTicks,
    });
  }

  function noteAck({ role = localRole, seq, appliedTick = null } = {}) {
    if (!ROLES.includes(role) || !Number.isSafeInteger(seq) || seq < -1) return false;
    const normalizedTick = Number.isInteger(appliedTick) && appliedTick >= 0
      ? appliedTick
      : null;
    if (seq < ackMap[role].seq) return false;
    ackMap[role] = { seq, appliedTick: normalizedTick };
    if (role === localRole) {
      const entry = localRing.find(item => item.seq === seq)
        || (localFloor?.seq === seq ? localFloor : null);
      if (entry && normalizedTick != null && entry.appliedTick !== normalizedTick) {
        entry.appliedTick = normalizedTick;
        counters.ackCorrections++;
        if (anchor) replay(Math.max(simulationTick, targetTick()));
      }
    }
    return true;
  }

  function truncateAcknowledged(seq) {
    if (!Number.isSafeInteger(seq) || seq < -1) return 0;
    const before = localRing.length;
    localRing = localRing.filter(entry => entry.seq > seq);
    if (localFloor && localFloor.seq <= seq) localFloor = null;
    return before - localRing.length;
  }

  function noteReject({ seq } = {}) {
    if (!Number.isSafeInteger(seq) || seq < 0) return false;
    const before = localRing.length;
    localRing = localRing.filter(entry => entry.seq !== seq);
    let removed = localRing.length !== before;
    if (localFloor?.seq === seq) {
      localFloor = null;
      removed = true;
    }
    if (!removed) return false;
    counters.inputRejects++;
    if (anchor) replay(Math.max(simulationTick, targetTick()));
    return true;
  }

  function applySnapshot(snapshot, {
    localTime = now(),
    rttMs = 0,
    reason = null,
  } = {}) {
    if (!snapshot || !Number.isInteger(snapshot.tick) || snapshot.tick < 0
      || !Number.isFinite(snapshot.serverTime) || !cloneSoccerState(snapshot.state)) {
      return { accepted: false, reason: 'invalid_snapshot' };
    }
    if (anchor && (snapshot.tick < anchor.tick
      || (snapshot.tick === anchor.tick && reason == null))) {
      counters.droppedAnchors++;
      return { accepted: false, reason: 'out_of_order' };
    }

    adaptive.noteRtt(rttMs);
    adaptive.noteSnapshot(localTime);
    noteClock(snapshot.serverTime, localTime, rttMs);

    const incomingProtocol = snapshot.protocolVersion ?? snapshot.v ?? protocolVersion;
    const mismatch = incomingProtocol !== protocolVersion;
    if (mismatch) {
      counters.protocolMismatches++;
      predictionEnabled = false;
      reason = 'protocol_mismatch';
    } else {
      predictionEnabled = true;
    }

    const incomingAck = normalizeAckMap(snapshot.ack ?? snapshot.acks);
    for (const role of ROLES) {
      const applied = snapshot.inputsApplied?.[role];
      if (applied && applied.seq === incomingAck[role].seq) {
        incomingAck[role].appliedTick = applied.appliedTick;
      }
    }
    for (const role of ROLES) {
      if (incomingAck[role].seq >= ackMap[role].seq) {
        noteAck({ role, ...incomingAck[role] });
      } else {
        incomingAck[role] = { ...ackMap[role] };
      }
    }

    const incomingInputs = snapshot.inputs || snapshot.heldInputs || (
      snapshot.inputsApplied
        ? {
          A: snapshot.inputsApplied.A?.keys || NEUTRAL_KEYS,
          B: snapshot.inputsApplied.B?.keys || NEUTRAL_KEYS,
        }
        : {}
    );
    heldInputs = {
      A: incomingInputs.A ? normalizeSoccerKeys(incomingInputs.A) : heldInputs.A,
      B: incomingInputs.B ? normalizeSoccerKeys(incomingInputs.B) : heldInputs.B,
    };
    let priorSimulation = cloneSoccerState(simulation);
    let priorSimulationTick = simulationTick;
    if (anchor && priorSimulation && priorSimulationTick < snapshot.tick) {
      targetFloor = Math.max(targetFloor, snapshot.tick);
      replay(targetFloor);
      priorSimulation = cloneSoccerState(simulation);
      priorSimulationTick = simulationTick;
    }
    if (!reason && snapshot.goal) reason = 'goal';
    if (!reason && !anchor) reason = 'first_snapshot';

    anchor = {
      tick: snapshot.tick,
      serverTime: snapshot.serverTime,
      state: cloneSoccerState(snapshot.state),
      inputs: {
        A: normalizeSoccerKeys(heldInputs.A),
        B: normalizeSoccerKeys(heldInputs.B),
      },
      ack: normalizeAckMap(incomingAck),
      protocolVersion: incomingProtocol,
    };
    ackMap = normalizeAckMap(incomingAck);
    truncateAcknowledged(anchor.ack[localRole].seq);
    targetFloor = anchor.tick;
    simulationTick = anchor.tick;
    simulation = cloneSoccerState(anchor.state);
    const nextTarget = targetTick(localTime);
    // Never compare a prediction at "now" with an older snapshot anchor.
    // Replay the new anchor to the same presentation tick first.
    targetFloor = Math.max(targetFloor, nextTarget, priorSimulationTick);
    replay(targetFloor);
    const positionErrors = priorSimulation && priorSimulationTick === simulationTick
      ? statePositionErrors(priorSimulation, simulation)
      : { A: 0, B: 0, ball: 0, max: 0 };
    const positionalError = positionErrors.max;
    if (!reason && positionalError >= extremePx) reason = 'extreme';
    const hardSeedReason = reason ? noteHardSeed(reason) : null;
    return {
      accepted: true,
      hardSeed: hardSeedReason != null,
      reason: hardSeedReason,
      targetTick: simulationTick,
      positionalError,
      positionErrors,
      protocolMismatch: mismatch,
    };
  }

  function pushLocalInput({
    seq,
    keys,
    predictedTick = null,
    localTime = now(),
  } = {}) {
    if (!Number.isSafeInteger(seq) || seq < 0
      || seq <= ackMap[localRole].seq
      || localRing.some(entry => entry.seq === seq)
      || (localFloor && seq <= localFloor.seq)) {
      counters.rejectedInputs++;
      return null;
    }
    const tick = Number.isInteger(predictedTick) && predictedTick >= 0
      ? predictedTick
      : targetTick(localTime);
    const entry = {
      seq,
      keys: normalizeSoccerKeys(keys),
      predictedTick: Math.max(anchor?.tick ?? 0, tick),
    };
    localRing.push(entry);
    localRing.sort((a, b) => a.seq - b.seq);
    heldInputs[localRole] = normalizeSoccerKeys(entry.keys);
    while (localRing.length > ringMax) {
      localFloor = localRing.shift();
      counters.ringEvictions++;
    }
    if (anchor) {
      targetFloor = Math.max(targetFloor, targetTick(localTime), entry.predictedTick + 1);
      replay(targetFloor);
    }
    return { ...entry, keys: { ...entry.keys } };
  }

  return {
    applySnapshot,
    seedSnapshot: applySnapshot,
    pushLocalInput,
    enqueueInput: pushLocalInput,
    noteAck,
    noteReject,
    truncateAcknowledged,
    advance(localTime = now()) {
      if (!anchor) return null;
      targetFloor = Math.max(targetFloor, targetTick(localTime));
      return cloneSoccerState(replay(targetFloor));
    },
    hardSeed(snapshot, reason, options = {}) {
      return applySnapshot(snapshot, { ...options, reason });
    },
    noteReconnect(snapshot, options = {}) {
      return applySnapshot(snapshot, { ...options, reason: 'reconnect' });
    },
    targetTick,
    serverNow,
    getState() {
      return cloneSoccerState(simulation);
    },
    getSimulation() {
      return {
        tick: simulationTick,
        state: cloneSoccerState(simulation),
      };
    },
    getAnchor() {
      if (!anchor) return null;
      return {
        ...anchor,
        state: cloneSoccerState(anchor.state),
        inputs: {
          A: { ...anchor.inputs.A },
          B: { ...anchor.inputs.B },
        },
        ack: normalizeAckMap(anchor.ack),
      };
    },
    getHeldInputs() {
      return {
        A: { ...heldInputs.A },
        B: { ...heldInputs.B },
      };
    },
    getPendingInputs() {
      return localRing.map(entry => ({
        ...entry,
        keys: { ...entry.keys },
      }));
    },
    getAckMap() {
      return normalizeAckMap(ackMap);
    },
    getAdaptiveEstimate() {
      return adaptive.estimate();
    },
    getMetrics() {
      const estimate = adaptive.estimate();
      return {
        ...counters,
        hardResetReasons: { ...counters.hardResetReasons },
        pendingInputs: localRing.length,
        simulationTick,
        anchorTick: anchor?.tick ?? null,
        ackLagTicks: ackMap[localRole].appliedTick == null
          ? null
          : Math.max(0, simulationTick - ackMap[localRole].appliedTick),
        lastHardSeedReason,
        adaptiveDelayMs: estimate.delayMs,
        adaptiveNoiseMs: estimate.noiseMs,
        adaptiveReplayWindowTicks: estimate.maxReplayTicks,
        predictionEnabled,
      };
    },
    reset() {
      anchor = null;
      simulation = null;
      simulationTick = 0;
      targetFloor = 0;
      clockOffsetMs = 0;
      clockReady = false;
      predictionEnabled = true;
      localRing = [];
      localFloor = null;
      heldInputs = {
        A: normalizeSoccerKeys(),
        B: normalizeSoccerKeys(),
      };
      ackMap = normalizeAckMap();
      lastHardSeedReason = null;
      adaptive.reset();
    },
  };
}
