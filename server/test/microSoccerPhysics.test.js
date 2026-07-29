import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SOCCER_CONTACT_RADIUS,
  SOCCER_FIXED_DT,
  socInitial,
  socReplayFixedTicks,
  socReplayInputChanges,
  socStep,
  socStepFixed,
} from '../../shared/microSoccerPhysics.js';
import {
  SOC,
  MATCH_SECONDS,
  socStep as browserSocStep,
} from '../../src/lib/soccer.js';

test('browser and server consume the same preserved physics exports', () => {
  assert.equal(browserSocStep, socStep);
  assert.equal(MATCH_SECONDS, 90);
  assert.equal(SOC.W, 800);
});

test('fixed-step simulation is deterministic across complete runs', () => {
  const inputs = {
    A: { up: true, down: false, left: false, right: true },
    B: { up: true, down: false, left: true, right: false },
  };
  const run = () => {
    let state = socInitial();
    for (let tick = 0; tick < 5_400; tick++) {
      state = socStep(state, inputs, SOCCER_FIXED_DT).state;
    }
    return state;
  };
  assert.deepEqual(run(), run());
});

test('goal and reset outcome is deterministic and server-step owned', () => {
  const initial = socInitial();
  initial.ball = {
    x: SOC.BALL_R + 1,
    y: SOC.H / 2,
    vx: -240,
    vy: 0,
  };
  const result = socStep(initial, {}, SOCCER_FIXED_DT);
  assert.equal(result.goal, 'B');
  assert.deepEqual(result.state.score, { A: 0, B: 1 });
  assert.deepEqual(result.state.ball, socInitial().ball);
  assert.deepEqual(result.state.cars, socInitial().cars);
});

test('prediction-safe steps detect goals without changing score or kickoff state', () => {
  const state = socInitial();
  state.cars.A = { x: 250, y: 100, a: 0.5, v: 80 };
  state.ball = {
    x: SOC.BALL_R + 1,
    y: SOC.H / 2,
    vx: -240,
    vy: 0,
  };
  const result = socStepFixed(state, {}, { authoritativeGoals: false });

  assert.equal(result.goal, null);
  assert.equal(result.goalCandidate, 'B');
  assert.deepEqual(result.state.score, { A: 0, B: 0 });
  assert.notDeepEqual(result.state.cars, socInitial().cars);
  assert.equal(result.state.ball.x, SOC.BALL_R);
  assert.equal(result.state.ball.vx, 0);
  assert.equal(result.state.ball.vy, 0);
});

test('prediction-safe mode keeps car-ball collisions active', () => {
  const state = socInitial();
  state.cars.A = { x: 200, y: 200, a: 0, v: 160 };
  state.ball = { x: 220, y: 200, vx: 0, vy: 0 };

  const result = socStepFixed(state, {
    A: { up: false, down: false, left: false, right: false },
  }, { authoritativeGoals: false });

  assert.equal(result.hit, 'A');
  assert.ok(result.state.ball.vx >= 120);
  assert.deepEqual(result.state.score, state.score);
});

test('slow contact stays gentle and always resolves car-ball penetration', () => {
  const state = socInitial();
  state.cars.A = { x: 200, y: 200, a: 0, v: 20 };
  state.ball = { x: 225, y: 200, vx: 0, vy: 0 };

  const result = socStepFixed(state, {});
  const distance = Math.hypot(
    result.state.ball.x - result.state.cars.A.x,
    result.state.ball.y - result.state.cars.A.y,
  );
  assert.equal(result.hit, 'A');
  assert.ok(result.state.ball.vx > 0 && result.state.ball.vx < 50);
  assert.ok(distance >= SOCCER_CONTACT_RADIUS - 1e-9);

  const centered = socInitial();
  centered.cars.A = { x: 300, y: 200, a: 0, v: 0 };
  centered.ball = { x: 300, y: 200, vx: 0, vy: 0 };
  const separated = socStepFixed(centered, {});
  assert.ok(Number.isFinite(separated.state.ball.x));
  assert.equal(
    Math.hypot(
      separated.state.ball.x - separated.state.cars.A.x,
      separated.state.ball.y - separated.state.cars.A.y,
    ),
    SOCCER_CONTACT_RADIUS,
  );
});

test('fixed-tick replay is deterministic and matches manual stepping', () => {
  const changes = [
    {
      role: 'A',
      seq: 1,
      appliedTick: 2,
      keys: { up: true, down: false, left: false, right: true },
    },
    {
      role: 'B',
      seq: 4,
      appliedTick: 4,
      keys: { up: true, down: false, left: true, right: false },
    },
  ];
  const replay = () => socReplayInputChanges(socInitial(), {
    startTick: 0,
    endTick: 120,
    inputChanges: changes,
    authoritativeGoals: false,
  });

  assert.deepEqual(replay(), replay());

  const constantInputs = {
    A: { up: true, down: false, left: false, right: false },
    B: { up: false, down: false, left: false, right: false },
  };
  let manual = socInitial();
  for (let tick = 0; tick < 30; tick++) {
    manual = socStepFixed(manual, constantInputs, { authoritativeGoals: false }).state;
  }
  const helper = socReplayFixedTicks(socInitial(), {
    ticks: 30,
    inputs: constantInputs,
    authoritativeGoals: false,
  });
  assert.deepEqual(helper.state, manual);
  assert.equal(helper.tick, 30);
});
