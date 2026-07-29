import {
  MATCH_SECONDS,
  SOCCER_FIXED_DT,
  SOCCER_TICK_HZ,
  socInitial,
  socStep,
} from '../../shared/microSoccerPhysics.js';
import {
  SOCCER_KINDS,
  SOCCER_NEUTRAL_KEYS,
  SOCCER_PROTOCOL_VERSION,
  isSoccerProtocolKind,
  sanitizeSoccerKeys,
  validateSoccerClientMessage,
} from '../../shared/microSoccerProtocol.js';

export {
  isSoccerProtocolKind,
  validateSoccerClientMessage,
} from '../../shared/microSoccerProtocol.js';

const ROLES = Object.freeze(['A', 'B']);
const NEUTRAL_KEYS = SOCCER_NEUTRAL_KEYS;

function validId(value, maxLength = 128) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && /^[A-Za-z0-9_.:-]+$/.test(value);
}

function makePlayer() {
  return {
    userId: null,
    socketId: null,
    connected: false,
    keys: { ...NEUTRAL_KEYS },
    receivedSeq: -1,
    pendingInput: null,
    lastApplied: null,
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
      rejected: 0,
      rejectsByReason: Object.create(null),
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
    player.pendingInput = null;
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
      v: SOCCER_PROTOCOL_VERSION,
      k: SOCCER_KINDS.START,
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
      v: SOCCER_PROTOCOL_VERSION,
      k: SOCCER_KINDS.RESUMED,
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
    const reject = error => this.reject({
      room,
      matchId,
      socketId,
      seq: Number.isSafeInteger(seq) && seq >= 0 ? seq : null,
      reason: error,
      input: true,
    });
    const match = this.getMatch(room, matchId);
    if (!match || match.status !== 'running') return reject('match_not_active');
    const player = match.players[role];
    if (!player || !player.connected || player.socketId !== socketId) {
      return reject('not_seat_socket');
    }
    if (!Number.isSafeInteger(seq) || seq < 0) return reject('invalid_sequence');
    if (seq <= player.receivedSeq) {
      return reject('stale_sequence');
    }
    const normalized = sanitizeSoccerKeys(keys);
    if (!normalized) return reject('invalid_keys');

    player.acceptedInputTimes = player.acceptedInputTimes.filter(
      acceptedAt => now - acceptedAt < 1000,
    );
    if (player.acceptedInputTimes.length >= this.inputRateLimit) {
      return reject('rate_limited');
    }

    player.receivedSeq = seq;
    player.pendingInput = { seq, keys: normalized, receivedAt: now };
    player.acceptedInputTimes.push(now);
    this.counters.inputsAccepted++;
    return { ok: true };
  }

  reject({
    room,
    matchId,
    socketId,
    seq = null,
    reason,
    input = false,
  }) {
    const safeReason = validId(reason, 64) ? reason : 'invalid_payload';
    const match = this.getMatch(room, matchId);
    this.counters.rejected++;
    if (input) this.counters.inputsRejected++;
    this.counters.rejectsByReason[safeReason] =
      (this.counters.rejectsByReason[safeReason] || 0) + 1;
    if (validId(socketId, 256) && validId(matchId)) {
      this.emit(socketId, {
        v: SOCCER_PROTOCOL_VERSION,
        k: SOCCER_KINDS.REJECT,
        matchId,
        tick: match?.tick ?? 0,
        seq: Number.isSafeInteger(seq) && seq >= 0 ? seq : null,
        reason: safeReason,
      });
    }
    return { ok: false, error: safeReason };
  }

  disconnect({ room, matchId, role, socketId }) {
    const match = this.getMatch(room, matchId);
    if (!match || match.status === 'over') return false;
    const player = match.players[role];
    if (!player || player.socketId !== socketId) return false;

    player.connected = false;
    player.socketId = null;
    player.keys = { ...NEUTRAL_KEYS };
    player.pendingInput = null;
    player.lastInputAt = null;
    this.counters.disconnects++;
    if (match.status === 'running') {
      match.status = 'paused';
      const now = this.now();
      this.emitToMatch(match, {
        v: SOCCER_PROTOCOL_VERSION,
        k: SOCCER_KINDS.PAUSED,
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
      const applied = [];
      const appliedTick = match.tick + 1;
      for (const role of ROLES) {
        const player = match.players[role];
        if (player.pendingInput) {
          const pending = player.pendingInput;
          player.pendingInput = null;
          player.keys = { ...pending.keys };
          player.lastInputAt = pending.receivedAt;
          player.lastApplied = {
            seq: pending.seq,
            appliedTick,
            keys: { ...pending.keys },
          };
          applied.push({
            role,
            socketId: player.socketId,
            ...player.lastApplied,
          });
        }
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

      for (const application of applied) {
        if (!application.socketId) continue;
        this.emit(application.socketId, {
          v: SOCCER_PROTOCOL_VERSION,
          k: SOCCER_KINDS.ACK,
          matchId: match.matchId,
          seq: application.seq,
          appliedTick: application.appliedTick,
          tick: match.tick,
          keys: { ...application.keys },
        });
      }
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
      player.pendingInput = null;
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
      v: SOCCER_PROTOCOL_VERSION,
      k: SOCCER_KINDS.SNAPSHOT,
      matchId: match.matchId,
      tick: match.tick,
      endTick: this.matchTicks,
      tickHz: this.tickHz,
      serverTime,
      state: match.state,
      goal: match.pendingGoal,
      inputsApplied: this.inputsAppliedPayload(match, serverTime),
      acks: this.acksPayload(match),
    };
  }

  overPayload(match) {
    return {
      v: SOCCER_PROTOCOL_VERSION,
      k: SOCCER_KINDS.OVER,
      matchId: match.matchId,
      ...match.result,
      state: match.state,
      inputsApplied: this.inputsAppliedPayload(match, match.result.serverTime),
      acks: this.acksPayload(match),
    };
  }

  inputsAppliedPayload(match, now = this.now()) {
    const appliedFor = role => {
      const player = match.players[role];
      if (!player.lastApplied) return null;
      const active = player.lastInputAt !== null
        && now - player.lastInputAt <= this.inputTimeoutMs;
      return {
        seq: player.lastApplied.seq,
        appliedTick: player.lastApplied.appliedTick,
        keys: active ? { ...player.keys } : { ...NEUTRAL_KEYS },
      };
    };
    return {
      A: appliedFor('A'),
      B: appliedFor('B'),
    };
  }

  acksPayload(match) {
    return {
      A: match.players.A.lastApplied?.seq ?? null,
      B: match.players.B.lastApplied?.seq ?? null,
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
      protocolVersion: SOCCER_PROTOCOL_VERSION,
      tickHz: this.tickHz,
      snapshotHz: this.snapshotHz,
      inputTimeoutMs: this.inputTimeoutMs,
      inputRateLimit: this.inputRateLimit,
      disconnectGraceMs: this.disconnectGraceMs,
      matchSeconds: this.matchSeconds,
      activeMatches: statuses.waiting + statuses.running + statuses.paused,
      statuses,
      ...this.counters,
      rejectsByReason: { ...this.counters.rejectsByReason },
    };
  }
}
