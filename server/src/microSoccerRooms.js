import {
  MATCH_SECONDS,
  SOCCER_FIXED_DT,
  SOCCER_TICK_HZ,
  socInitial,
  socStep,
} from '../../shared/microSoccerPhysics.js';

const ROLES = Object.freeze(['A', 'B']);
const NEUTRAL_KEYS = Object.freeze({
  up: false,
  down: false,
  left: false,
  right: false,
});

function validId(value, maxLength = 128) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && /^[A-Za-z0-9_.:-]+$/.test(value);
}

function normalizeKeys(keys) {
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) return null;
  const allowed = new Set(['up', 'down', 'left', 'right']);
  if (Object.keys(keys).some(key => !allowed.has(key) || typeof keys[key] !== 'boolean')) {
    return null;
  }
  return {
    up: keys.up === true,
    down: keys.down === true,
    left: keys.left === true,
    right: keys.right === true,
  };
}

export function isSoccerProtocolKind(kind) {
  return typeof kind === 'string' && kind.startsWith('soccer:');
}

export function validateSoccerClientMessage(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'invalid_payload' };
  }
  if (!validId(payload.matchId)) return { ok: false, error: 'invalid_match_id' };
  if (payload.k === 'soccer:join') {
    return { ok: true, value: { k: payload.k, matchId: payload.matchId } };
  }
  if (payload.k === 'soccer:input') {
    if (!Number.isSafeInteger(payload.seq) || payload.seq < 0) {
      return { ok: false, error: 'invalid_sequence' };
    }
    const keys = normalizeKeys(payload.keys);
    if (!keys) return { ok: false, error: 'invalid_keys' };
    return {
      ok: true,
      value: { k: payload.k, matchId: payload.matchId, seq: payload.seq, keys },
    };
  }
  return { ok: false, error: 'server_owned_kind' };
}

function makePlayer() {
  return {
    userId: null,
    socketId: null,
    connected: false,
    keys: { ...NEUTRAL_KEYS },
    seq: -1,
    lastInputAt: null,
    acceptedInputTimes: [],
    disconnectTimer: null,
  };
}

export class MicroSoccerRooms {
  constructor(options = {}) {
    this.tickHz = SOCCER_TICK_HZ;
    this.snapshotHz = options.snapshotHz ?? 20;
    if (!Number.isInteger(this.snapshotHz)
      || this.snapshotHz <= 0
      || this.tickHz % this.snapshotHz !== 0) {
      throw new Error('snapshotHz must be a positive divisor of 60');
    }
    this.snapshotEveryTicks = this.tickHz / this.snapshotHz;
    this.inputTimeoutMs = options.inputTimeoutMs ?? 250;
    this.inputRateLimit = options.inputRateLimit ?? 40;
    this.disconnectGraceMs = options.disconnectGraceMs ?? 10_000;
    this.matchSeconds = options.matchSeconds ?? MATCH_SECONDS;
    this.matchTicks = Math.round(this.matchSeconds * this.tickHz);
    this.finishedRetentionMs = options.finishedRetentionMs ?? 30_000;
    this.now = options.now ?? (() => Date.now());
    this.emit = options.emit ?? (() => {});
    this.setIntervalFn = options.setIntervalFn ?? setInterval;
    this.clearIntervalFn = options.clearIntervalFn ?? clearInterval;
    this.setTimeoutFn = options.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
    this.matches = new Map();
    this.loopTimer = null;
    this.counters = {
      started: 0,
      finished: 0,
      ticks: 0,
      snapshots: 0,
      inputsAccepted: 0,
      inputsRejected: 0,
      disconnects: 0,
      resumes: 0,
    };
    if (options.autoStart !== false) this.startLoop();
  }

  startLoop() {
    if (this.loopTimer) return;
    this.loopTimer = this.setIntervalFn(
      () => this.advanceOne(this.now()),
      1000 / this.tickHz,
    );
    this.loopTimer?.unref?.();
  }

  stop() {
    if (this.loopTimer) this.clearIntervalFn(this.loopTimer);
    this.loopTimer = null;
    for (const match of this.matches.values()) {
      for (const role of ROLES) {
        if (match.players[role].disconnectTimer) {
          this.clearTimeoutFn(match.players[role].disconnectTimer);
        }
      }
      if (match.cleanupTimer) this.clearTimeoutFn(match.cleanupTimer);
    }
    this.matches.clear();
  }

  key(room, matchId) {
    return `${room}\u0000${matchId}`;
  }

  getMatch(room, matchId) {
    return this.matches.get(this.key(room, matchId)) ?? null;
  }

  join({ room, matchId, role, userId, socketId }) {
    if (!validId(room, 256) || !validId(matchId) || !ROLES.includes(role)
      || !validId(userId, 256) || !validId(socketId, 256)) {
      return { ok: false, error: 'invalid_join' };
    }

    const key = this.key(room, matchId);
    let match = this.matches.get(key);
    if (!match) {
      match = {
        key,
        room,
        matchId,
        status: 'waiting',
        tick: 0,
        state: socInitial(),
        pendingGoal: null,
        players: { A: makePlayer(), B: makePlayer() },
        cleanupTimer: null,
      };
      this.matches.set(key, match);
    }

    if (match.status === 'over') {
      this.emit(socketId, this.overPayload(match));
      return { ok: false, error: 'match_over' };
    }

    const player = match.players[role];
    if (player.userId && player.userId !== userId) {
      return { ok: false, error: 'seat_taken' };
    }

    if (player.disconnectTimer) this.clearTimeoutFn(player.disconnectTimer);
    player.disconnectTimer = null;
    player.userId = userId;
    player.socketId = socketId;
    player.connected = true;
    player.keys = { ...NEUTRAL_KEYS };
    player.lastInputAt = null;
    player.acceptedInputTimes = [];

    const bothConnected = ROLES.every(seat => match.players[seat].connected);
    if (match.status === 'waiting' && bothConnected) {
      this.startMatch(match);
    } else if (match.status === 'paused' && bothConnected) {
      this.resumeMatch(match);
    } else if (match.status === 'running') {
      this.emit(socketId, this.snapshotPayload(match, this.now()));
    }

    return {
      ok: true,
      role,
      status: match.status,
      tick: match.tick,
    };
  }

  startMatch(match) {
    match.status = 'running';
    this.counters.started++;
    const now = this.now();
    this.emitToMatch(match, {
      k: 'soccer:start',
      matchId: match.matchId,
      tick: match.tick,
      endTick: this.matchTicks,
      tickHz: this.tickHz,
      serverTime: now,
      endAt: this.endAt(match, now),
    });
    this.broadcastSnapshot(match, now);
  }

  resumeMatch(match) {
    match.status = 'running';
    this.counters.resumes++;
    const now = this.now();
    this.emitToMatch(match, {
      k: 'soccer:resumed',
      matchId: match.matchId,
      tick: match.tick,
      endTick: this.matchTicks,
      tickHz: this.tickHz,
      serverTime: now,
      endAt: this.endAt(match, now),
    });
    this.broadcastSnapshot(match, now);
  }

  receiveInput({ room, matchId, role, socketId, seq, keys }, now = this.now()) {
    const reject = error => {
      this.counters.inputsRejected++;
      return { ok: false, error };
    };
    const match = this.getMatch(room, matchId);
    if (!match || match.status === 'over') return reject('match_not_active');
    const player = match.players[role];
    if (!player || !player.connected || player.socketId !== socketId) {
      return reject('not_seat_socket');
    }
    if (!Number.isSafeInteger(seq) || seq < 0 || seq <= player.seq) {
      return reject('stale_sequence');
    }
    const normalized = normalizeKeys(keys);
    if (!normalized) return reject('invalid_keys');

    player.acceptedInputTimes = player.acceptedInputTimes.filter(
      acceptedAt => now - acceptedAt < 1000,
    );
    if (player.acceptedInputTimes.length >= this.inputRateLimit) {
      return reject('rate_limited');
    }

    player.seq = seq;
    player.keys = normalized;
    player.lastInputAt = now;
    player.acceptedInputTimes.push(now);
    this.counters.inputsAccepted++;
    return { ok: true };
  }

  disconnect({ room, matchId, role, socketId }) {
    const match = this.getMatch(room, matchId);
    if (!match || match.status === 'over') return false;
    const player = match.players[role];
    if (!player || player.socketId !== socketId) return false;

    player.connected = false;
    player.socketId = null;
    player.keys = { ...NEUTRAL_KEYS };
    player.lastInputAt = null;
    this.counters.disconnects++;
    if (match.status === 'running') {
      match.status = 'paused';
      const now = this.now();
      this.emitToMatch(match, {
        k: 'soccer:paused',
        matchId: match.matchId,
        tick: match.tick,
        serverTime: now,
        role,
        graceMs: this.disconnectGraceMs,
      });
    }

    player.disconnectTimer = this.setTimeoutFn(
      () => this.expireDisconnectedSeat(match.key, role),
      this.disconnectGraceMs,
    );
    player.disconnectTimer?.unref?.();
    return true;
  }

  expireDisconnectedSeat(key, role) {
    const match = this.matches.get(key);
    if (!match || match.status === 'over') return false;
    const player = match.players[role];
    if (player.connected) return false;
    player.disconnectTimer = null;
    const otherRole = role === 'A' ? 'B' : 'A';
    const winner = match.players[otherRole].connected ? otherRole : 'draw';
    this.finishMatch(match, 'disconnect_timeout', winner);
    return true;
  }

  advanceOne(now = this.now()) {
    for (const match of this.matches.values()) {
      if (match.status !== 'running') continue;
      const inputs = {};
      for (const role of ROLES) {
        const player = match.players[role];
        inputs[role] = player.lastInputAt !== null
          && now - player.lastInputAt <= this.inputTimeoutMs
          ? player.keys
          : NEUTRAL_KEYS;
      }
      const stepped = socStep(match.state, inputs, SOCCER_FIXED_DT);
      match.state = stepped.state;
      if (stepped.goal) match.pendingGoal = stepped.goal;
      match.tick++;
      this.counters.ticks++;

      if (match.tick % this.snapshotEveryTicks === 0) {
        this.broadcastSnapshot(match, now);
      }
      if (match.tick >= this.matchTicks) {
        const { A, B } = match.state.score;
        const winner = A === B ? 'draw' : (A > B ? 'A' : 'B');
        this.finishMatch(match, 'time', winner, now);
      }
    }
  }

  finishMatch(match, reason, winner, now = this.now()) {
    if (match.status === 'over') return;
    match.status = 'over';
    match.result = {
      reason,
      winner,
      score: { ...match.state.score },
      tick: match.tick,
      serverTime: now,
    };
    for (const role of ROLES) {
      const player = match.players[role];
      player.keys = { ...NEUTRAL_KEYS };
      if (player.disconnectTimer) this.clearTimeoutFn(player.disconnectTimer);
      player.disconnectTimer = null;
    }
    this.counters.finished++;
    this.emitToMatch(match, this.overPayload(match));
    match.cleanupTimer = this.setTimeoutFn(
      () => this.matches.delete(match.key),
      this.finishedRetentionMs,
    );
    match.cleanupTimer?.unref?.();
  }

  endAt(match, now) {
    return now + Math.max(0, this.matchTicks - match.tick) * (1000 / this.tickHz);
  }

  snapshotPayload(match, serverTime) {
    return {
      k: 'soccer:snapshot',
      matchId: match.matchId,
      tick: match.tick,
      endTick: this.matchTicks,
      tickHz: this.tickHz,
      serverTime,
      state: match.state,
      goal: match.pendingGoal,
    };
  }

  overPayload(match) {
    return {
      k: 'soccer:over',
      matchId: match.matchId,
      ...match.result,
      state: match.state,
    };
  }

  broadcastSnapshot(match, now = this.now()) {
    this.counters.snapshots++;
    this.emitToMatch(match, this.snapshotPayload(match, now));
    match.pendingGoal = null;
  }

  emitToMatch(match, payload) {
    const sent = new Set();
    for (const role of ROLES) {
      const socketId = match.players[role].socketId;
      if (socketId && !sent.has(socketId)) {
        sent.add(socketId);
        this.emit(socketId, payload);
      }
    }
  }

  metrics() {
    const statuses = { waiting: 0, running: 0, paused: 0, over: 0 };
    for (const match of this.matches.values()) statuses[match.status]++;
    return {
      tickHz: this.tickHz,
      snapshotHz: this.snapshotHz,
      inputTimeoutMs: this.inputTimeoutMs,
      inputRateLimit: this.inputRateLimit,
      disconnectGraceMs: this.disconnectGraceMs,
      matchSeconds: this.matchSeconds,
      activeMatches: statuses.waiting + statuses.running + statuses.paused,
      statuses,
      ...this.counters,
    };
  }
}
