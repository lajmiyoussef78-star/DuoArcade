/**
 * Predictive-authoritative Micro Soccer wire protocol.
 *
 * This module deliberately has no Node or browser globals so the exact same
 * validation code can run at either end of the connection.
 */

export const SOCCER_PROTOCOL_VERSION = 2;
export const SOCCER_ROLES = Object.freeze(['A', 'B']);

export const SOCCER_KINDS = Object.freeze({
  JOIN: 'soccer:join',
  INPUT: 'soccer:input',
  START: 'soccer:start',
  ACK: 'soccer:ack',
  SNAPSHOT: 'soccer:snapshot',
  PAUSED: 'soccer:paused',
  RESUMED: 'soccer:resumed',
  OVER: 'soccer:over',
  REJECT: 'soccer:reject',
});

export const SOCCER_CLIENT_KINDS = Object.freeze([
  SOCCER_KINDS.JOIN,
  SOCCER_KINDS.INPUT,
]);

export const SOCCER_SERVER_KINDS = Object.freeze([
  SOCCER_KINDS.START,
  SOCCER_KINDS.ACK,
  SOCCER_KINDS.SNAPSHOT,
  SOCCER_KINDS.PAUSED,
  SOCCER_KINDS.RESUMED,
  SOCCER_KINDS.OVER,
  SOCCER_KINDS.REJECT,
]);

export const SOCCER_NEUTRAL_KEYS = Object.freeze({
  up: false,
  down: false,
  left: false,
  right: false,
});

const KEY_NAMES = Object.freeze(['up', 'down', 'left', 'right']);
const CLIENT_KIND_SET = new Set(SOCCER_CLIENT_KINDS);
const SERVER_KIND_SET = new Set(SOCCER_SERVER_KINDS);
const ALL_KIND_SET = new Set([...SOCCER_CLIENT_KINDS, ...SOCCER_SERVER_KINDS]);
const ID_RE = /^[A-Za-z0-9_.:-]+$/;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isTick(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isSeq(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validId(value, maxLength = 128) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && ID_RE.test(value);
}

function hasV2Envelope(payload, kind) {
  return isRecord(payload)
    && payload.v === SOCCER_PROTOCOL_VERSION
    && payload.k === kind
    && validId(payload.matchId);
}

function validationResult(sanitizer, payload) {
  const value = sanitizer(payload);
  return value
    ? { ok: true, value }
    : { ok: false, error: protocolError(payload) };
}

function protocolError(payload) {
  if (!isRecord(payload)) return 'invalid_payload';
  if (payload.v !== SOCCER_PROTOCOL_VERSION) return 'unsupported_version';
  if (typeof payload.k !== 'string' || !ALL_KIND_SET.has(payload.k)) return 'invalid_kind';
  if (!validId(payload.matchId)) return 'invalid_match_id';
  if (payload.k === SOCCER_KINDS.INPUT) {
    if (!isSeq(payload.seq)) return 'invalid_sequence';
    if (!sanitizeSoccerKeys(payload.keys)) return 'invalid_keys';
  }
  return 'invalid_fields';
}

export function isSoccerProtocolKind(kind) {
  return typeof kind === 'string' && kind.startsWith('soccer:');
}

export function sanitizeSoccerKeys(keys) {
  if (!isRecord(keys)) return null;
  if (Object.keys(keys).some(key =>
    !KEY_NAMES.includes(key) || typeof keys[key] !== 'boolean')) {
    return null;
  }
  return {
    up: keys.up === true,
    down: keys.down === true,
    left: keys.left === true,
    right: keys.right === true,
  };
}

export function sanitizeSoccerJoin(payload) {
  if (!hasV2Envelope(payload, SOCCER_KINDS.JOIN)) return null;
  return {
    v: SOCCER_PROTOCOL_VERSION,
    k: SOCCER_KINDS.JOIN,
    matchId: payload.matchId,
  };
}

export function sanitizeSoccerInput(payload) {
  if (!hasV2Envelope(payload, SOCCER_KINDS.INPUT) || !isSeq(payload.seq)) return null;
  const keys = sanitizeSoccerKeys(payload.keys);
  if (!keys) return null;
  // Any client tick-like fields are intentionally not copied. Sequence order is
  // the only client-owned ordering signal; the server assigns appliedTick.
  return {
    v: SOCCER_PROTOCOL_VERSION,
    k: SOCCER_KINDS.INPUT,
    matchId: payload.matchId,
    seq: payload.seq,
    keys,
  };
}

function sanitizeTiming(payload, { requireEnd = false } = {}) {
  if (!isTick(payload.tick) || !isFiniteNumber(payload.serverTime)) return null;
  const result = {
    tick: payload.tick,
    serverTime: payload.serverTime,
  };
  if (requireEnd) {
    if (!isTick(payload.endTick) || payload.endTick < payload.tick) return null;
    if (!isFiniteNumber(payload.tickHz) || payload.tickHz <= 0 || payload.tickHz > 240) {
      return null;
    }
    result.endTick = payload.endTick;
    result.tickHz = payload.tickHz;
    if (payload.endAt != null) {
      if (!isFiniteNumber(payload.endAt)) return null;
      result.endAt = payload.endAt;
    }
  }
  return result;
}

export function sanitizeSoccerStart(payload) {
  if (!hasV2Envelope(payload, SOCCER_KINDS.START)) return null;
  const timing = sanitizeTiming(payload, { requireEnd: true });
  if (!timing) return null;
  return {
    v: SOCCER_PROTOCOL_VERSION,
    k: SOCCER_KINDS.START,
    matchId: payload.matchId,
    ...timing,
  };
}

export function sanitizeSoccerAck(payload) {
  if (!hasV2Envelope(payload, SOCCER_KINDS.ACK)
    || !isSeq(payload.seq)
    || !isTick(payload.appliedTick)) {
    return null;
  }
  if (payload.tick != null && (!isTick(payload.tick) || payload.tick < payload.appliedTick)) {
    return null;
  }
  const keys = payload.keys == null ? null : sanitizeSoccerKeys(payload.keys);
  if (payload.keys != null && !keys) return null;
  return {
    v: SOCCER_PROTOCOL_VERSION,
    k: SOCCER_KINDS.ACK,
    matchId: payload.matchId,
    seq: payload.seq,
    appliedTick: payload.appliedTick,
    tick: payload.tick ?? payload.appliedTick,
    ...(keys ? { keys } : {}),
  };
}

function sanitizeCar(car) {
  if (!isRecord(car)
    || !isFiniteNumber(car.x)
    || !isFiniteNumber(car.y)
    || !isFiniteNumber(car.a)
    || !isFiniteNumber(car.v)
    || Math.abs(car.x) > 10_000
    || Math.abs(car.y) > 10_000
    || Math.abs(car.a) > 1_000_000
    || Math.abs(car.v) > 10_000) {
    return null;
  }
  return { x: car.x, y: car.y, a: car.a, v: car.v };
}

function sanitizeBall(ball) {
  if (!isRecord(ball)
    || !isFiniteNumber(ball.x)
    || !isFiniteNumber(ball.y)
    || !isFiniteNumber(ball.vx)
    || !isFiniteNumber(ball.vy)
    || Math.abs(ball.x) > 10_000
    || Math.abs(ball.y) > 10_000
    || Math.abs(ball.vx) > 10_000
    || Math.abs(ball.vy) > 10_000) {
    return null;
  }
  return { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy };
}

function sanitizeScore(score) {
  if (!isRecord(score)
    || !Number.isSafeInteger(score.A)
    || !Number.isSafeInteger(score.B)
    || score.A < 0
    || score.B < 0) {
    return null;
  }
  return { A: score.A, B: score.B };
}

export function sanitizeSoccerState(state) {
  if (!isRecord(state) || !isRecord(state.cars)) return null;
  const A = sanitizeCar(state.cars.A);
  const B = sanitizeCar(state.cars.B);
  const ball = sanitizeBall(state.ball);
  const score = sanitizeScore(state.score);
  if (!A || !B || !ball || !score) return null;
  return { cars: { A, B }, ball, score };
}

function sanitizeAppliedInput(value) {
  if (value === null) return null;
  if (!isRecord(value) || !isSeq(value.seq) || !isTick(value.appliedTick)) return undefined;
  const keys = sanitizeSoccerKeys(value.keys);
  if (!keys) return undefined;
  return { seq: value.seq, appliedTick: value.appliedTick, keys };
}

export function sanitizeSoccerInputsApplied(value) {
  if (!isRecord(value)) return null;
  const A = sanitizeAppliedInput(value.A);
  const B = sanitizeAppliedInput(value.B);
  if (A === undefined || B === undefined) return null;
  return { A, B };
}

export function sanitizeSoccerAcks(value) {
  if (!isRecord(value)) return null;
  for (const role of SOCCER_ROLES) {
    if (value[role] !== null && !isSeq(value[role])) return null;
  }
  return { A: value.A, B: value.B };
}

export function sanitizeSoccerSnapshot(payload) {
  if (!hasV2Envelope(payload, SOCCER_KINDS.SNAPSHOT)) return null;
  const timing = sanitizeTiming(payload, { requireEnd: true });
  const state = sanitizeSoccerState(payload.state);
  const inputsApplied = sanitizeSoccerInputsApplied(payload.inputsApplied);
  const acks = sanitizeSoccerAcks(payload.acks);
  if (!timing || !state || !inputsApplied || !acks) return null;
  const goal = payload.goal === 'A' || payload.goal === 'B' ? payload.goal : null;
  return {
    v: SOCCER_PROTOCOL_VERSION,
    k: SOCCER_KINDS.SNAPSHOT,
    matchId: payload.matchId,
    ...timing,
    state,
    goal,
    inputsApplied,
    acks,
  };
}

export function sanitizeSoccerPaused(payload) {
  if (!hasV2Envelope(payload, SOCCER_KINDS.PAUSED)) return null;
  const timing = sanitizeTiming(payload);
  if (!timing
    || !SOCCER_ROLES.includes(payload.role)
    || !isFiniteNumber(payload.graceMs)
    || payload.graceMs < 0) {
    return null;
  }
  return {
    v: SOCCER_PROTOCOL_VERSION,
    k: SOCCER_KINDS.PAUSED,
    matchId: payload.matchId,
    ...timing,
    role: payload.role,
    graceMs: payload.graceMs,
  };
}

export function sanitizeSoccerResumed(payload) {
  if (!hasV2Envelope(payload, SOCCER_KINDS.RESUMED)) return null;
  const timing = sanitizeTiming(payload, { requireEnd: true });
  if (!timing) return null;
  return {
    v: SOCCER_PROTOCOL_VERSION,
    k: SOCCER_KINDS.RESUMED,
    matchId: payload.matchId,
    ...timing,
  };
}

export function sanitizeSoccerOver(payload) {
  if (!hasV2Envelope(payload, SOCCER_KINDS.OVER)) return null;
  const timing = sanitizeTiming(payload);
  const winner = payload.winner;
  const score = sanitizeScore(payload.score);
  const state = sanitizeSoccerState(payload.state);
  const inputsApplied = sanitizeSoccerInputsApplied(payload.inputsApplied);
  const acks = sanitizeSoccerAcks(payload.acks);
  if (!timing
    || !['A', 'B', 'draw'].includes(winner)
    || !validId(payload.reason, 64)
    || !score
    || !state
    || !inputsApplied
    || !acks) {
    return null;
  }
  return {
    v: SOCCER_PROTOCOL_VERSION,
    k: SOCCER_KINDS.OVER,
    matchId: payload.matchId,
    reason: payload.reason,
    winner,
    score,
    ...timing,
    state,
    inputsApplied,
    acks,
  };
}

export function sanitizeSoccerReject(payload) {
  if (!hasV2Envelope(payload, SOCCER_KINDS.REJECT)
    || !isTick(payload.tick)
    || (payload.seq !== null && !isSeq(payload.seq))
    || !validId(payload.reason, 64)) {
    return null;
  }
  return {
    v: SOCCER_PROTOCOL_VERSION,
    k: SOCCER_KINDS.REJECT,
    matchId: payload.matchId,
    tick: payload.tick,
    seq: payload.seq,
    reason: payload.reason,
  };
}

const SANITIZERS = Object.freeze({
  [SOCCER_KINDS.JOIN]: sanitizeSoccerJoin,
  [SOCCER_KINDS.INPUT]: sanitizeSoccerInput,
  [SOCCER_KINDS.START]: sanitizeSoccerStart,
  [SOCCER_KINDS.ACK]: sanitizeSoccerAck,
  [SOCCER_KINDS.SNAPSHOT]: sanitizeSoccerSnapshot,
  [SOCCER_KINDS.PAUSED]: sanitizeSoccerPaused,
  [SOCCER_KINDS.RESUMED]: sanitizeSoccerResumed,
  [SOCCER_KINDS.OVER]: sanitizeSoccerOver,
  [SOCCER_KINDS.REJECT]: sanitizeSoccerReject,
});

export function sanitizeSoccerMessage(payload, { direction = 'any' } = {}) {
  if (!isRecord(payload) || payload.v !== SOCCER_PROTOCOL_VERSION) return null;
  if (direction === 'client' && !CLIENT_KIND_SET.has(payload.k)) return null;
  if (direction === 'server' && !SERVER_KIND_SET.has(payload.k)) return null;
  const sanitizer = SANITIZERS[payload.k];
  return sanitizer ? sanitizer(payload) : null;
}

export function validateSoccerMessage(payload, options) {
  const value = sanitizeSoccerMessage(payload, options);
  if (value) return { ok: true, value };
  if (options?.direction === 'client' && SERVER_KIND_SET.has(payload?.k)) {
    return { ok: false, error: 'server_owned_kind' };
  }
  if (options?.direction === 'server' && CLIENT_KIND_SET.has(payload?.k)) {
    return { ok: false, error: 'client_owned_kind' };
  }
  return { ok: false, error: protocolError(payload) };
}

export function validateSoccerClientMessage(payload) {
  return validateSoccerMessage(payload, { direction: 'client' });
}

export function validateSoccerServerMessage(payload) {
  return validateSoccerMessage(payload, { direction: 'server' });
}

export const validateSoccerJoin = payload => validationResult(sanitizeSoccerJoin, payload);
export const validateSoccerInput = payload => validationResult(sanitizeSoccerInput, payload);
export const validateSoccerStart = payload => validationResult(sanitizeSoccerStart, payload);
export const validateSoccerAck = payload => validationResult(sanitizeSoccerAck, payload);
export const validateSoccerSnapshot = payload => validationResult(sanitizeSoccerSnapshot, payload);
export const validateSoccerPaused = payload => validationResult(sanitizeSoccerPaused, payload);
export const validateSoccerResumed = payload => validationResult(sanitizeSoccerResumed, payload);
export const validateSoccerOver = payload => validationResult(sanitizeSoccerOver, payload);
export const validateSoccerReject = payload => validationResult(sanitizeSoccerReject, payload);
