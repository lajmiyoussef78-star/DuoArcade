import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MicroSoccerRooms,
  validateSoccerClientMessage,
} from '../src/microSoccerRooms.js';
import {
  SOCCER_PROTOCOL_VERSION,
  validateSoccerServerMessage,
} from '../../shared/microSoccerProtocol.js';

const ROOM = 'rt-duo123';
const MATCH = 'match-1700000000000';

function harness(options = {}) {
  let now = 1_000;
  const events = [];
  const timers = [];
  const manager = new MicroSoccerRooms({
    autoStart: false,
    now: () => now,
    emit: (socketId, payload) => events.push({ socketId, payload }),
    setTimeoutFn: (fn, ms) => {
      const timer = { fn, ms, cancelled: false, unref() {} };
      timers.push(timer);
      return timer;
    },
    clearTimeoutFn: timer => {
      timer.cancelled = true;
    },
    ...options,
  });
  return {
    manager,
    events,
    timers,
    now: () => now,
    setNow: value => {
      now = value;
    },
  };
}

function joinBoth(h, sockets = { A: 'socket-A', B: 'socket-B' }) {
  const first = h.manager.join({
    room: ROOM,
    matchId: MATCH,
    role: 'A',
    userId: 'user-A',
    socketId: sockets.A,
  });
  const second = h.manager.join({
    room: ROOM,
    matchId: MATCH,
    role: 'B',
    userId: 'user-B',
    socketId: sockets.B,
  });
  return { first, second };
}

test('starts only after authenticated A and B join and sends identical full snapshots', () => {
  const h = harness();
  const first = h.manager.join({
    room: ROOM,
    matchId: MATCH,
    role: 'A',
    userId: 'user-A',
    socketId: 'socket-A',
  });
  assert.equal(first.status, 'waiting');
  assert.equal(h.events.length, 0);

  const second = h.manager.join({
    room: ROOM,
    matchId: MATCH,
    role: 'B',
    userId: 'user-B',
    socketId: 'socket-B',
  });
  assert.equal(second.status, 'running');

  const starts = h.events.filter(event => event.payload.k === 'soccer:start');
  const snapshots = h.events.filter(event => event.payload.k === 'soccer:snapshot');
  assert.deepEqual(starts.map(event => event.socketId).sort(), ['socket-A', 'socket-B']);
  assert.equal(snapshots.length, 2);
  assert.deepEqual(snapshots[0].payload, snapshots[1].payload);
  assert.equal(snapshots[0].payload.v, 2);
  assert.deepEqual(snapshots[0].payload.inputsApplied, { A: null, B: null });
  assert.deepEqual(snapshots[0].payload.acks, { A: null, B: null });
  assert.equal(validateSoccerServerMessage(snapshots[0].payload).ok, true);

  h.events.length = 0;
  h.manager.advanceOne(1_017);
  h.manager.advanceOne(1_034);
  h.manager.advanceOne(1_050);
  const periodic = h.events.filter(event => event.payload.k === 'soccer:snapshot');
  assert.equal(periodic.length, 2);
  assert.equal(periodic[0].payload.tick, 3);
  assert.deepEqual(periodic[0].payload, periodic[1].payload);
});

test('applies only the newest queued input on a server tick and then unicasts its ack', () => {
  const h = harness();
  joinBoth(h);
  h.events.length = 0;
  const base = {
    room: ROOM,
    matchId: MATCH,
    role: 'A',
    socketId: 'socket-A',
  };
  h.manager.receiveInput({
    ...base,
    seq: 10,
    keys: { up: true, down: false, left: false, right: false },
    tick: 50_000,
  }, 1_001);
  h.manager.receiveInput({
    ...base,
    seq: 11,
    keys: { up: false, down: false, left: false, right: true },
    tick: 1,
  }, 1_002);

  assert.equal(h.events.some(event => event.payload.k === 'soccer:ack'), false);
  assert.equal(h.manager.getMatch(ROOM, MATCH).state.cars.A.a, 0);

  h.manager.advanceOne(1_017);

  const acks = h.events.filter(event => event.payload.k === 'soccer:ack');
  assert.equal(acks.length, 1);
  assert.equal(acks[0].socketId, 'socket-A');
  assert.deepEqual(acks[0].payload, {
    v: 2,
    k: 'soccer:ack',
    matchId: MATCH,
    seq: 11,
    appliedTick: 1,
    tick: 1,
    keys: { up: false, down: false, left: false, right: true },
  });
  assert.equal(validateSoccerServerMessage(acks[0].payload).ok, true);
  const match = h.manager.getMatch(ROOM, MATCH);
  assert.ok(match.state.cars.A.a > 0);
  assert.deepEqual(match.players.A.lastApplied, {
    seq: 11,
    appliedTick: 1,
    keys: { up: false, down: false, left: false, right: true },
  });
  h.manager.advanceOne(1_034);
  h.manager.advanceOne(1_050);
  const snapshot = h.events.find(event =>
    event.socketId === 'socket-A' && event.payload.k === 'soccer:snapshot');
  assert.deepEqual(snapshot.payload.inputsApplied, {
    A: {
      seq: 11,
      appliedTick: 1,
      keys: { up: false, down: false, left: false, right: true },
    },
    B: null,
  });
  assert.deepEqual(snapshot.payload.acks, { A: 11, B: null });
});

test('rejects stale, invalid, and rate-limited input', () => {
  const h = harness({ inputRateLimit: 2 });
  joinBoth(h);
  const base = {
    room: ROOM,
    matchId: MATCH,
    role: 'A',
    socketId: 'socket-A',
    keys: { up: true, down: false, left: false, right: false },
  };
  assert.deepEqual(h.manager.receiveInput({ ...base, seq: 1 }, 1_000), { ok: true });
  assert.equal(h.manager.receiveInput({ ...base, seq: 1 }, 1_001).error, 'stale_sequence');
  assert.deepEqual(h.manager.receiveInput({ ...base, seq: 2 }, 1_002), { ok: true });
  assert.equal(h.manager.receiveInput({ ...base, seq: 3 }, 1_003).error, 'rate_limited');
  assert.equal(
    h.manager.receiveInput({ ...base, seq: 4, keys: { up: 'yes' } }, 2_100).error,
    'invalid_keys',
  );
  const rejects = h.events.filter(event => event.payload.k === 'soccer:reject');
  assert.deepEqual(rejects.map(event => event.payload.reason), [
    'stale_sequence',
    'rate_limited',
    'invalid_keys',
  ]);
  assert.ok(rejects.every(event => event.socketId === 'socket-A'));
  assert.deepEqual(h.manager.metrics().rejectsByReason, {
    stale_sequence: 1,
    rate_limited: 1,
    invalid_keys: 1,
  });
});

test('neutralizes input after 250ms without changing the fixed step', () => {
  const h = harness();
  joinBoth(h);
  h.manager.receiveInput({
    room: ROOM,
    matchId: MATCH,
    role: 'A',
    socketId: 'socket-A',
    seq: 0,
    keys: { up: true, down: false, left: false, right: false },
  }, 1_000);

  h.manager.advanceOne(1_100);
  const match = h.manager.getMatch(ROOM, MATCH);
  const acceleratedVelocity = match.state.cars.A.v;
  assert.ok(acceleratedVelocity > 0);

  h.manager.advanceOne(1_251);
  assert.ok(match.state.cars.A.v < acceleratedVelocity);
  assert.equal(match.tick, 2);
});

test('pauses on disconnect and resumes the same tick on authenticated reconnect', () => {
  const h = harness();
  joinBoth(h);
  h.manager.receiveInput({
    room: ROOM,
    matchId: MATCH,
    role: 'B',
    socketId: 'socket-B',
    seq: 9,
    keys: { up: true, down: false, left: false, right: false },
  }, 1_001);
  h.manager.advanceOne(1_017);
  const beforeDisconnect = h.manager.getMatch(ROOM, MATCH).tick;

  assert.equal(h.manager.disconnect({
    room: ROOM,
    matchId: MATCH,
    role: 'B',
    socketId: 'socket-B',
  }), true);
  assert.equal(h.manager.getMatch(ROOM, MATCH).status, 'paused');
  h.manager.advanceOne(5_000);
  assert.equal(h.manager.getMatch(ROOM, MATCH).tick, beforeDisconnect);

  h.setNow(5_000);
  const reconnect = h.manager.join({
    room: ROOM,
    matchId: MATCH,
    role: 'B',
    userId: 'user-B',
    socketId: 'socket-B2',
  });
  assert.equal(reconnect.status, 'running');
  assert.equal(reconnect.tick, beforeDisconnect);
  assert.equal(h.manager.getMatch(ROOM, MATCH).tick, beforeDisconnect);
  assert.ok(h.events.some(event =>
    event.socketId === 'socket-B2' && event.payload.k === 'soccer:resumed'));
  assert.ok(h.events.some(event =>
    event.socketId === 'socket-B2'
    && event.payload.k === 'soccer:snapshot'
    && event.payload.tick === beforeDisconnect
    && event.payload.v === 2
    && Object.hasOwn(event.payload, 'inputsApplied')
    && event.payload.acks.B === 9
    && event.payload.inputsApplied.B.seq === 9));
  assert.equal(h.timers[0].cancelled, true);
});

test('terminates safely when disconnect grace expires', () => {
  const h = harness();
  joinBoth(h);
  h.manager.disconnect({
    room: ROOM,
    matchId: MATCH,
    role: 'B',
    socketId: 'socket-B',
  });
  assert.equal(h.timers[0].ms, 10_000);
  h.timers[0].fn();

  const match = h.manager.getMatch(ROOM, MATCH);
  assert.equal(match.status, 'over');
  assert.equal(match.result.reason, 'disconnect_timeout');
  assert.equal(match.result.winner, 'A');
  const over = h.events.find(event =>
    event.socketId === 'socket-A' && event.payload.k === 'soccer:over');
  assert.ok(over);
});

test('finishes at the authoritative tick with a server-owned result', () => {
  const h = harness({ matchSeconds: 2 / 60 });
  joinBoth(h);
  const match = h.manager.getMatch(ROOM, MATCH);
  match.state.score = { A: 3, B: 1 };

  h.manager.advanceOne(1_017);
  assert.equal(match.status, 'running');
  h.manager.advanceOne(1_034);
  assert.equal(match.status, 'over');
  assert.equal(match.tick, 2);
  assert.deepEqual(match.result, {
    reason: 'time',
    winner: 'A',
    score: { A: 3, B: 1 },
    tick: 2,
    serverTime: 1_034,
  });
  const overPayloads = h.events.filter(event => event.payload.k === 'soccer:over');
  assert.equal(overPayloads.length, 2);
  assert.deepEqual(overPayloads[0].payload, overPayloads[1].payload);
  assert.equal(overPayloads[0].payload.v, 2);
  assert.equal(validateSoccerServerMessage(overPayloads[0].payload).ok, true);
});

test('runs a complete 90-second match with identical snapshot streams for both seats', () => {
  const h = harness();
  joinBoth(h);
  h.events.length = 0;

  const totalTicks = 90 * 60;
  for (let tick = 1; tick <= totalTicks; tick++) {
    h.manager.advanceOne(1_000 + tick * (1000 / 60));
  }

  const match = h.manager.getMatch(ROOM, MATCH);
  assert.equal(match.tick, totalTicks);
  assert.equal(match.status, 'over');
  const snapshotsA = h.events
    .filter(event => event.socketId === 'socket-A' && event.payload.k === 'soccer:snapshot')
    .map(event => event.payload);
  const snapshotsB = h.events
    .filter(event => event.socketId === 'socket-B' && event.payload.k === 'soccer:snapshot')
    .map(event => event.payload);
  assert.equal(snapshotsA.length, totalTicks / 3);
  assert.deepEqual(snapshotsA, snapshotsB);
  const overA = h.events.find(event =>
    event.socketId === 'socket-A' && event.payload.k === 'soccer:over');
  const overB = h.events.find(event =>
    event.socketId === 'socket-B' && event.payload.k === 'soccer:over');
  assert.deepEqual(overA.payload, overB.payload);
});

test('client protocol accepts only join and validated key-state input', () => {
  assert.equal(validateSoccerClientMessage({
    v: SOCCER_PROTOCOL_VERSION,
    k: 'soccer:join',
    matchId: MATCH,
  }).ok, true);
  assert.equal(validateSoccerClientMessage({
    v: SOCCER_PROTOCOL_VERSION,
    k: 'soccer:input',
    matchId: MATCH,
    seq: 5,
    keys: { up: true, down: false, left: false, right: false },
  }).ok, true);
  assert.equal(validateSoccerClientMessage({
    v: SOCCER_PROTOCOL_VERSION,
    k: 'soccer:snapshot',
    matchId: MATCH,
  }).error, 'server_owned_kind');
});
