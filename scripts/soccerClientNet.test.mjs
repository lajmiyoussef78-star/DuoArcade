import assert from 'node:assert/strict';
import {
  constrainPredictedCarToBall,
  createSoccerClock,
  createSoccerMetrics,
  createSoccerSnapshotBuffer,
  reconcileOwnCar,
  validateSoccerMsg,
} from '../src/lib/soccerNet.js';
import {
  createSoccerAdaptiveWindow,
  createSoccerPredictor,
  reconcileSoccerPresentation,
} from '../src/lib/soccerPredict.js';
import { SOCCER_CONTACT_RADIUS, socInitial } from '../src/lib/soccer.js';
import {
  SOCCER_FIXED_DT,
  socResolveCarBallContact,
  socStep,
} from '../shared/microSoccerPhysics.js';

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

{
  const state = socInitial();
  const v2Snapshot = validateSoccerMsg({
    k: 'soccer:snapshot',
    v: 2,
    matchId: 'match-v2',
    tick: 12,
    tickHz: 60,
    endTick: 5400,
    serverTime: 1200,
    state,
    acks: {
      A: 7,
      B: 4,
    },
    inputsApplied: {
      A: { seq: 7, appliedTick: 10, keys: { up: true } },
      B: { seq: 4, appliedTick: 11, keys: { left: true } },
    },
  });
  assert.equal(v2Snapshot.protocolVersion, 2);
  assert.deepEqual(v2Snapshot.ack.A, { seq: 7, appliedTick: 10 });
  assert.deepEqual(v2Snapshot.ack.B, { seq: 4, appliedTick: 11 });
  assert.equal(v2Snapshot.inputs.A.up, true);

  const ack = validateSoccerMsg({
    k: 'soccer:ack',
    v: 2,
    matchId: 'match-v2',
    seq: 8,
    appliedTick: 13,
    tick: 14,
    keys: { up: true },
  });
  assert.deepEqual(
    { seq: ack.seq, appliedTick: ack.appliedTick },
    { seq: 8, appliedTick: 13 },
  );

  const reject = validateSoccerMsg({
    k: 'soccer:reject',
    v: 2,
    matchId: 'match-v2',
    seq: 9,
    tick: 14,
    reason: 'rate_limited',
  });
  assert.equal(reject.reason, 'rate_limited');
  assert.equal(validateSoccerMsg({ ...ack, appliedTick: -1 }), null);

  const predictor = createSoccerPredictor();
  predictor.applySnapshot(v2Snapshot, { localTime: 1200 });
  assert.equal(predictor.getAnchor().ack.A.seq, 7);
  assert.equal(predictor.getAnchor().ack.A.appliedTick, 10);
  assert.equal(predictor.getHeldInputs().B.left, true);
}

function predictorSnapshot({
  tick = 0,
  serverTime = tick * 1000 / 60,
  state = socInitial(),
  ackA = -1,
  inputs = { A: {}, B: {} },
  goal = null,
  protocolVersion = 2,
} = {}) {
  return {
    protocolVersion,
    tick,
    serverTime,
    state,
    goal,
    ack: {
      A: { seq: ackA, appliedTick: null },
      B: { seq: -1, appliedTick: null },
    },
    inputs,
  };
}

{
  const first = createSoccerPredictor({ localRole: 'A' });
  const second = createSoccerPredictor({ localRole: 'A' });
  const anchor = predictorSnapshot({ tick: 100, serverTime: 1000 });
  first.applySnapshot(anchor, { localTime: 1000 });
  second.applySnapshot(anchor, { localTime: 1000 });
  const changes = [
    { seq: 1, predictedTick: 101, keys: { up: true, right: true } },
    { seq: 2, predictedTick: 105, keys: { up: true, right: false } },
  ];
  for (const change of changes) {
    first.pushLocalInput(change);
    second.pushLocalInput(change);
  }
  first.advance(1200);
  second.advance(1200);
  assert.deepEqual(first.getSimulation(), second.getSimulation(), 'fixed-tick replay must be deterministic');
  assert.ok(first.getMetrics().replayTicksLast > 0);
}

{
  const predictor = createSoccerPredictor({ localRole: 'A' });
  predictor.applySnapshot(predictorSnapshot(), { localTime: 0 });
  predictor.pushLocalInput({
    seq: 1,
    keys: { up: true },
    predictedTick: 1,
  });
  predictor.advance(1000 / 6);
  const beforeAck = predictor.getState().cars.A.x;
  assert.equal(predictor.noteAck({ role: 'A', seq: 1, appliedTick: 5 }), true);
  const afterAck = predictor.getState().cars.A.x;
  assert.ok(afterAck < beforeAck, 'later authoritative apply tick must correct optimistic motion');
  assert.equal(predictor.getPendingInputs()[0].appliedTick, 5);
  assert.equal(predictor.getMetrics().ackCorrections, 1);

  predictor.applySnapshot(predictorSnapshot({
    tick: 10,
    serverTime: 1000 / 6,
    state: predictor.getState(),
    ackA: 1,
  }), { localTime: 1000 / 6 });
  assert.equal(predictor.getPendingInputs().length, 0, 'snapshot ack truncates the local ring');
}

{
  const predictor = createSoccerPredictor({ localRole: 'A', ringMax: 3 });
  predictor.applySnapshot(predictorSnapshot(), { localTime: 0 });
  for (let seq = 1; seq <= 5; seq++) {
    predictor.pushLocalInput({
      seq,
      predictedTick: seq,
      keys: { up: seq % 2 === 1, right: seq % 2 === 0 },
    });
  }
  assert.deepEqual(predictor.getPendingInputs().map(item => item.seq), [3, 4, 5]);
  assert.equal(predictor.getMetrics().ringEvictions, 2);
  assert.equal(predictor.noteReject({ seq: 4, reason: 'rate_limited' }), true);
  assert.deepEqual(predictor.getPendingInputs().map(item => item.seq), [3, 5]);
  assert.equal(predictor.getMetrics().inputRejects, 1);
}

{
  const predictor = createSoccerPredictor();
  predictor.applySnapshot(predictorSnapshot({ tick: 10, serverTime: 100 }), { localTime: 100 });
  const late = predictor.applySnapshot(
    predictorSnapshot({ tick: 9, serverTime: 90 }),
    { localTime: 110 },
  );
  assert.deepEqual(late, { accepted: false, reason: 'out_of_order' });
  assert.equal(predictor.getAnchor().tick, 10);
  assert.equal(predictor.getMetrics().droppedAnchors, 1);
}

{
  const predictor = createSoccerPredictor();
  assert.equal(
    predictor.applySnapshot(predictorSnapshot(), { localTime: 0 }).reason,
    'first_snapshot',
  );
  assert.equal(
    predictor.applySnapshot(
      predictorSnapshot({ tick: 1, goal: 'A' }),
      { localTime: 1000 / 60 },
    ).reason,
    'goal',
  );
  assert.equal(
    predictor.noteReconnect(
      predictorSnapshot({ tick: 1, serverTime: 1000 / 60 }),
      { localTime: 1000 / 60 },
    ).reason,
    'reconnect',
    'reconnect may hard-seed at the same paused tick',
  );
  assert.equal(
    predictor.applySnapshot(
      predictorSnapshot({ tick: 2, protocolVersion: 1 }),
      { localTime: 2000 / 60 },
    ).reason,
    'protocol_mismatch',
  );
  assert.equal(predictor.getMetrics().predictionEnabled, false);

  const extreme = createSoccerPredictor({ extremePx: 50 });
  extreme.applySnapshot(predictorSnapshot(), { localTime: 0 });
  const displaced = socInitial();
  displaced.ball.x += 100;
  assert.equal(
    extreme.applySnapshot(
      predictorSnapshot({ tick: 1, state: displaced }),
      { localTime: 1000 / 60 },
    ).reason,
    'extreme',
  );
}

{
  const predictor = createSoccerPredictor({ localRole: 'A' });
  predictor.applySnapshot(predictorSnapshot({
    inputs: { A: {}, B: { up: true } },
  }), { localTime: 0 });
  const anchorX = predictor.getState().cars.B.x;
  predictor.advance(100);
  assert.ok(predictor.getState().cars.B.x < anchorX, 'peer keys hold between snapshots');
}

{
  const contactState = socInitial();
  contactState.cars.A = { x: 370, y: 250, a: 0, v: 120 };
  const predictor = createSoccerPredictor({ localRole: 'A' });
  predictor.applySnapshot(
    predictorSnapshot({ state: contactState }),
    { localTime: 0 },
  );
  predictor.pushLocalInput({
    seq: 1,
    keys: { up: true },
    predictedTick: 0,
  });
  const predicted = predictor.getState();
  assert.ok(predicted.ball.vx > 0, 'local contact changes the predicted ball within one tick');
  assert.ok(
    Math.hypot(
      predicted.ball.x - predicted.cars.A.x,
      predicted.ball.y - predicted.cars.A.y,
    ) >= SOCCER_CONTACT_RADIUS,
    'full-world prediction cannot leave the local car inside the ball',
  );
}

{
  const goalState = socInitial();
  goalState.ball = {
    x: 14,
    y: 250,
    vx: -240,
    vy: 0,
  };
  const predictor = createSoccerPredictor();
  predictor.applySnapshot(predictorSnapshot({ state: goalState }), { localTime: 0 });
  predictor.pushLocalInput({ seq: 1, keys: {}, predictedTick: 0 });
  const predicted = predictor.getState();
  assert.deepEqual(predicted.score, { A: 0, B: 0 }, 'predicted goal cannot change score');
  assert.notEqual(predicted.ball.x, 400, 'predicted goal cannot perform kickoff reset');
}

{
  const estimator = createSoccerAdaptiveWindow({
    minDelayMs: 5,
    maxDelayMs: 40,
    minReplayTicks: 4,
    maxReplayTicks: 20,
  });
  estimator.noteRtt(5000);
  for (const time of [0, 5, 500, 505, 1500]) estimator.noteSnapshot(time);
  const estimate = estimator.estimate();
  assert.ok(estimate.delayMs >= 5 && estimate.delayMs <= 40);
  assert.ok(estimate.maxReplayTicks >= 4 && estimate.maxReplayTicks <= 20);
  assert.ok(estimate.noiseMs >= 0 && estimate.noiseMs <= 250);
}

{
  const current = socInitial();
  const target = socInitial();
  target.cars.A.x += 80;
  target.ball.x += 100;
  const soft = reconcileSoccerPresentation(current, target, 1 / 60, {
    extremePx: 200,
    carMaxStepPx: 3,
    ballMaxStepPx: 4,
  });
  assert.equal(soft.hardReset, false);
  assert.ok(soft.state.cars.A.x - current.cars.A.x <= 3);
  assert.ok(soft.state.ball.x - current.ball.x <= 4);
  const hard = reconcileSoccerPresentation(current, target, 1 / 60, {
    hardReason: 'reconnect',
  });
  assert.equal(hard.hardReset, true);
  assert.deepEqual(hard.state, target);

  const overlapping = socInitial();
  overlapping.cars.B = {
    x: overlapping.ball.x + 5,
    y: overlapping.ball.y,
    a: Math.PI,
    v: 80,
  };
  const separated = reconcileSoccerPresentation(
    overlapping,
    overlapping,
    1 / 60,
  ).state;
  assert.equal(
    socResolveCarBallContact(separated.cars.B, separated.ball),
    null,
    'presentation smoothing cannot draw either car inside the ball',
  );
}

{
  // Pure packet audit: intermediate loss and reordering must not rewind an
  // anchor, and the next full snapshot must deterministically converge.
  const stableAdaptive = () => ({
    noteRtt() {},
    noteSnapshot() {},
    estimate() {
      return {
        rttMs: 0,
        rttJitterMs: 0,
        snapshotGapMs: 50,
        snapshotJitterMs: 0,
        noiseMs: 0,
        delayMs: 0,
        delayTicks: 0,
        maxReplayTicks: 90,
      };
    },
    reset() {},
  });
  let state = socInitial();
  const held = {
    A: { up: true, right: true },
    B: { up: true, left: true },
  };
  const stream = [predictorSnapshot({ tick: 0, state, inputs: held })];
  for (let tick = 1; tick <= 12; tick++) {
    state = socStep(state, held, SOCCER_FIXED_DT, { authoritativeGoals: false }).state;
    if (tick % 3 === 0) {
      stream.push(predictorSnapshot({ tick, state, inputs: held }));
    }
  }
  const ordered = createSoccerPredictor({ adaptive: stableAdaptive() });
  const impaired = createSoccerPredictor({ adaptive: stableAdaptive() });
  for (const item of stream) {
    ordered.applySnapshot(item, { localTime: item.serverTime });
  }
  const oneWayLatencyMs = [25, 75, 40, 65];
  // 50-150 ms RTT, jitter, one reordered snapshot and one dropped snapshot.
  for (const [deliveryIndex, index] of [0, 2, 1, 4].entries()) {
    const item = stream[index];
    const oneWay = oneWayLatencyMs[deliveryIndex];
    impaired.applySnapshot(item, {
      localTime: item.serverTime + oneWay,
      rttMs: oneWay * 2,
    });
  }
  assert.equal(impaired.getMetrics().droppedAnchors, 1);
  assert.deepEqual(impaired.getAnchor().state, ordered.getAnchor().state);
  ordered.advance(stream[4].serverTime + oneWayLatencyMs[3]);
  assert.deepEqual(impaired.getState(), ordered.getState());
}

{
  const metrics = createSoccerMetrics();
  metrics.noteIn({ k: 'soccer:ack' });
  metrics.noteIn({ k: 'soccer:reject' });
  metrics.notePrediction({
    pendingInputs: 3,
    replayTicks: 42,
    replayTicksLast: 6,
    replayTicksMax: 12,
    replayErrors: 1,
    hardResets: 2,
    hardResetReasons: { reconnect: 1, goal: 1 },
    protocolMismatches: 0,
    predictionEnabled: true,
    ackLagTicks: 3,
    adaptiveDelayMs: 18,
    adaptiveNoiseMs: 7,
    adaptiveReplayWindowTicks: 15,
  });
  metrics.noteBallCorrection(4);
  metrics.noteBallCorrection(6);
  metrics.noteContactFrameDelta(0);
  const summary = metrics.summary();
  assert.equal(summary.inputAcksIn, 1);
  assert.equal(summary.inputRejectsIn, 1);
  assert.equal(summary.pendingInputs, 3);
  assert.equal(summary.replayTicks, 42);
  assert.equal(summary.replayErrors, 1);
  assert.equal(summary.predictorHardResets, 2);
  assert.deepEqual(summary.predictorHardResetReasons, { reconnect: 1, goal: 1 });
  assert.equal(summary.acknowledgementLagTicks, 3);
  assert.equal(summary.p95BallCorrectionPx, 6);
  assert.equal(summary.contactResponseP95Frames, 0);
  assert.equal(summary.adaptiveDelayMs, 18);
}

console.log('soccer client net tests: PASS');
