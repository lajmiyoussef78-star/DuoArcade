import assert from 'node:assert/strict';
import {
  constrainPredictedCarToBall,
  createSoccerClock,
  createSoccerSnapshotBuffer,
  reconcileOwnCar,
  validateSoccerMsg,
} from '../src/lib/soccerNet.js';
import { SOCCER_CONTACT_RADIUS, socInitial } from '../src/lib/soccer.js';

function snapshot(tick, serverTime, x, scoreA = 0) {
  const state = socInitial();
  state.cars.A.x = x;
  state.cars.B.x = 800 - x;
  state.ball.x = x;
  state.ball.vx = x / 10;
  state.score.A = scoreA;
  return { tick, serverTime, state };
}

{
  const buffer = createSoccerSnapshotBuffer();
  assert.equal(buffer.push(snapshot(10, 1000, 100)), true);
  assert.equal(buffer.push(snapshot(12, 1100, 200)), true);

  const halfway = buffer.sampleAt(1050);
  assert.equal(halfway.tick, 11);
  assert.equal(halfway.alpha, 0.5);
  assert.equal(halfway.state.ball.x, 150);
  assert.equal(halfway.state.cars.A.x, 150);
  assert.equal(halfway.state.cars.B.x, 650);
  assert.equal(halfway.state.score.A, 0);
}

{
  const buffer = createSoccerSnapshotBuffer();
  assert.equal(buffer.push(snapshot(20, 2000, 200)), true);
  assert.equal(buffer.push(snapshot(20, 2050, 999)), false, 'duplicate tick must be rejected');
  assert.equal(buffer.push(snapshot(19, 1950, 150)), true, 'late packets stay available for interpolation');
  assert.equal(buffer.latest().tick, 20);
  assert.equal(buffer.latest().state.ball.x, 200);
}

{
  const ordered = createSoccerSnapshotBuffer();
  const jittered = createSoccerSnapshotBuffer();
  const stream = [
    snapshot(30, 3000, 300),
    snapshot(31, 3050, 330),
    snapshot(32, 3100, 370),
    snapshot(33, 3150, 420),
  ];
  for (const item of stream) ordered.push(item);
  for (const index of [0, 2, 1, 3]) jittered.push(stream[index]);

  let priorTick = -1;
  for (const serverTime of [3000, 3025, 3050, 3075, 3100, 3125, 3150]) {
    const a = ordered.sampleAt(serverTime);
    const b = jittered.sampleAt(serverTime);
    assert.equal(a.state.ball.x, b.state.ball.x, 'jitter must not change sampled ball position');
    assert.equal(a.tick, b.tick, 'both clients must sample the same authoritative tick');
    assert.ok(a.tick >= priorTick, 'render timeline must not rewind');
    priorTick = a.tick;
  }
}

{
  const clock = createSoccerClock();
  clock.note({ serverTime: 1000, localTime: 900, rttMs: 40 });
  assert.equal(clock.offset(), 120, 'receive-time sample includes half RTT');
  assert.equal(clock.serverNow(2000), 2120);
  assert.equal(clock.isReady(), true);
}

{
  const predicted = { x: 100, y: 100, a: 0, v: 20 };
  const withinDeadzone = reconcileOwnCar(predicted, { ...predicted, x: 106 }, 1 / 60);
  assert.deepEqual(withinDeadzone, predicted);

  const softCorrected = reconcileOwnCar(predicted, { ...predicted, x: 120 }, 1 / 60);
  assert.ok(softCorrected.x > predicted.x && softCorrected.x < 120);

  const hardCorrected = reconcileOwnCar(predicted, { ...predicted, x: 160 }, 1 / 60);
  assert.equal(hardCorrected.x, 160);
}

{
  const ball = { x: 400, y: 250, vx: 0, vy: 0 };
  const previous = { x: 360, y: 250, a: 0, v: 300 };
  const tunneled = { x: 405, y: 250, a: 0, v: 300 };
  const constrained = constrainPredictedCarToBall(
    previous,
    tunneled,
    ball,
    SOCCER_CONTACT_RADIUS,
  );
  assert.equal(constrained.x, ball.x - SOCCER_CONTACT_RADIUS);
  assert.equal(constrained.y, ball.y);
  assert.equal(constrained.v, tunneled.v, 'visual contact must not invent ball authority');

  const clear = { x: 300, y: 250, a: 0, v: 20 };
  assert.deepEqual(
    constrainPredictedCarToBall(previous, clear, ball, SOCCER_CONTACT_RADIUS),
    clear,
  );
}

{
  const start = validateSoccerMsg({
    k: 'soccer:start',
    matchId: 'match-1',
    tick: 120,
    serverTime: 10_000,
    endAt: 98_000,
  });
  assert.equal(start.tickHz, 60);
  assert.equal(start.endTick, 5400);

  const over = validateSoccerMsg({
    k: 'soccer:over',
    matchId: 'match-1',
    tick: 5400,
    serverTime: 98_000,
    winner: null,
    state: socInitial(),
  });
  assert.equal(over.winner, 'draw');
}

console.log('soccer client net tests: PASS');
