import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SOCCER_FIXED_DT,
  socInitial,
  socStep,
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
