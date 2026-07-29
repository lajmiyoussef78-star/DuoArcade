export const MATCH_SECONDS = 90;
export const SOCCER_TICK_HZ = 60;
export const SOCCER_FIXED_DT = 1 / SOCCER_TICK_HZ;

export const SOC = Object.freeze({
  W: 800,
  H: 500,
  GOAL_H: 160,
  CAR_W: 44,
  CAR_H: 26,
  BALL_R: 13,
});

/** Existing circular car/ball contact shell used by authoritative physics. */
export const SOCCER_CONTACT_RADIUS =
  SOC.BALL_R + Math.max(SOC.CAR_W, SOC.CAR_H) / 2 - 4;

const ROLES = Object.freeze(['A', 'B']);
const TURN = 3.4;
const ACC = 420;
const MAXV = 300;
const FRICTION = 1.6;
const BALL_FRICTION = 0.55;

export function socInitial() {
  return {
    cars: {
      A: { x: 160, y: SOC.H / 2, a: 0, v: 0 },
      B: { x: SOC.W - 160, y: SOC.H / 2, a: Math.PI, v: 0 },
    },
    ball: { x: SOC.W / 2, y: SOC.H / 2, vx: 0, vy: 0 },
    score: { A: 0, B: 0 },
  };
}

export function socCloneState(state) {
  return {
    cars: { A: { ...state.cars.A }, B: { ...state.cars.B } },
    ball: { ...state.ball },
    score: { ...state.score },
  };
}

export function socStepCar(car, keys, dt) {
  const c = { ...car };
  const k = keys || {};
  if (k.left) c.a -= TURN * dt;
  if (k.right) c.a += TURN * dt;
  if (k.up) c.v = Math.min(MAXV, c.v + ACC * dt);
  else if (k.down) c.v = Math.max(-MAXV * 0.6, c.v - ACC * dt);
  else c.v *= Math.max(0, 1 - FRICTION * dt);
  c.x += Math.cos(c.a) * c.v * dt;
  c.y += Math.sin(c.a) * c.v * dt;
  c.x = Math.max(SOC.CAR_W / 2, Math.min(SOC.W - SOC.CAR_W / 2, c.x));
  c.y = Math.max(SOC.CAR_H / 2, Math.min(SOC.H - SOC.CAR_H / 2, c.y));
  return c;
}

/**
 * Advance the complete deterministic simulation by one caller-supplied step.
 * Authoritative callers must always pass SOCCER_FIXED_DT.
 */
export function socStep(st, inputs, dt, opts = {}) {
  const s = socCloneState(st);
  const authoritativeGoals = opts.authoritativeGoals !== false;
  const poseLock = opts.poseLock || {};
  for (const role of ROLES) {
    if (poseLock[role]) {
      s.cars[role] = {
        x: poseLock[role].x,
        y: poseLock[role].y,
        a: poseLock[role].a,
        v: poseLock[role].v,
      };
    } else {
      s.cars[role] = socStepCar(s.cars[role], inputs?.[role], dt);
    }
  }

  const b = s.ball;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.vx *= Math.max(0, 1 - BALL_FRICTION * dt);
  b.vy *= Math.max(0, 1 - BALL_FRICTION * dt);
  const gTop = (SOC.H - SOC.GOAL_H) / 2;
  const gBot = gTop + SOC.GOAL_H;
  if (b.y < SOC.BALL_R) {
    b.y = SOC.BALL_R;
    b.vy = Math.abs(b.vy);
  }
  if (b.y > SOC.H - SOC.BALL_R) {
    b.y = SOC.H - SOC.BALL_R;
    b.vy = -Math.abs(b.vy);
  }

  let goal = null;
  if (b.x < SOC.BALL_R) {
    if (b.y > gTop && b.y < gBot) goal = 'B';
    else {
      b.x = SOC.BALL_R;
      b.vx = Math.abs(b.vx);
    }
  }
  if (b.x > SOC.W - SOC.BALL_R) {
    if (b.y > gTop && b.y < gBot) goal = 'A';
    else {
      b.x = SOC.W - SOC.BALL_R;
      b.vx = -Math.abs(b.vx);
    }
  }

  let hit = null;
  for (const role of ROLES) {
    const c = s.cars[role];
    const dx = b.x - c.x;
    const dy = b.y - c.y;
    const dist = Math.hypot(dx, dy);
    const min = SOCCER_CONTACT_RADIUS;
    if (dist > 0 && dist < min) {
      const nx = dx / dist;
      const ny = dy / dist;
      const push = Math.max(120, Math.abs(c.v) * 1.15);
      b.vx = nx * push;
      b.vy = ny * push;
      b.x = c.x + nx * min;
      b.y = c.y + ny * min;
      hit = role;
    }
  }

  if (goal && authoritativeGoals) {
    s.score[goal]++;
    const fresh = socInitial();
    s.ball = fresh.ball;
    s.cars = fresh.cars;
  } else if (goal) {
    // Prediction may show the crossing immediately, but only the server may
    // score and reset kickoff. Hold at the line until that snapshot arrives.
    b.x = goal === 'A' ? SOC.W - SOC.BALL_R : SOC.BALL_R;
    b.vx = 0;
    b.vy = 0;
  }
  return {
    state: s,
    goal: authoritativeGoals ? goal : null,
    goalCandidate: goal,
    hit,
  };
}

/** Advance exactly one authoritative/prediction tick without accepting a dt. */
export function socStepFixed(state, inputs, opts = {}) {
  return socStep(state, inputs, SOCCER_FIXED_DT, opts);
}

function cloneInputs(inputs = {}) {
  return {
    A: { ...(inputs.A || {}) },
    B: { ...(inputs.B || {}) },
  };
}

/**
 * Deterministically replay [startTick, endTick) at the shared 60 Hz step.
 * inputForTick receives the input tick and copies of the current inputs/state.
 */
export function socReplayFixedTicks(initialState, {
  startTick = 0,
  endTick,
  ticks,
  inputs = {},
  inputForTick = null,
  authoritativeGoals = false,
  poseLock = null,
} = {}) {
  if (!Number.isSafeInteger(startTick) || startTick < 0) {
    throw new TypeError('startTick must be a non-negative safe integer');
  }
  const resolvedEndTick = endTick ?? (
    Number.isSafeInteger(ticks) ? startTick + ticks : null
  );
  if (!Number.isSafeInteger(resolvedEndTick) || resolvedEndTick < startTick) {
    throw new TypeError('endTick must be a safe integer at or after startTick');
  }
  if (inputForTick !== null && typeof inputForTick !== 'function') {
    throw new TypeError('inputForTick must be a function or null');
  }

  let state = socCloneState(initialState);
  let currentInputs = cloneInputs(inputs);
  const events = [];
  for (let tick = startTick; tick < resolvedEndTick; tick++) {
    if (inputForTick) {
      const supplied = inputForTick(tick, cloneInputs(currentInputs), socCloneState(state));
      if (supplied) currentInputs = cloneInputs(supplied);
    }
    const stepped = socStepFixed(state, currentInputs, {
      authoritativeGoals,
      ...(poseLock ? { poseLock } : {}),
    });
    state = stepped.state;
    if (stepped.goalCandidate || stepped.hit) {
      events.push({
        tick: tick + 1,
        goal: stepped.goal,
        goalCandidate: stepped.goalCandidate,
        hit: stepped.hit,
      });
    }
  }
  return {
    state,
    tick: resolvedEndTick,
    inputs: cloneInputs(currentInputs),
    events,
  };
}

/**
 * Replay sequenced input-state changes. A change is active for the simulation
 * result at its appliedTick; ties collapse deterministically to the highest seq.
 */
export function socReplayInputChanges(initialState, {
  startTick = 0,
  endTick,
  inputs = {},
  inputChanges = [],
  authoritativeGoals = false,
  poseLock = null,
} = {}) {
  if (!Array.isArray(inputChanges)) {
    throw new TypeError('inputChanges must be an array');
  }
  const changes = inputChanges
    .map((change, index) => ({ ...change, index }))
    .sort((a, b) =>
      a.appliedTick - b.appliedTick
      || String(a.role).localeCompare(String(b.role))
      || a.seq - b.seq
      || a.index - b.index);
  if (changes.some(change =>
    !ROLES.includes(change.role)
    || !Number.isSafeInteger(change.seq)
    || change.seq < 0
    || !Number.isSafeInteger(change.appliedTick)
    || change.appliedTick < 0
    || !change.keys
    || typeof change.keys !== 'object')) {
    throw new TypeError('inputChanges contains an invalid change');
  }

  let cursor = 0;
  let replayInputs = cloneInputs(inputs);
  while (cursor < changes.length && changes[cursor].appliedTick <= startTick) {
    replayInputs[changes[cursor].role] = { ...changes[cursor].keys };
    cursor++;
  }
  return socReplayFixedTicks(initialState, {
    startTick,
    endTick,
    inputs: replayInputs,
    authoritativeGoals,
    poseLock,
    inputForTick(tick, current) {
      const outputTick = tick + 1;
      while (cursor < changes.length && changes[cursor].appliedTick <= outputTick) {
        current[changes[cursor].role] = { ...changes[cursor].keys };
        cursor++;
      }
      return current;
    },
  });
}

export function socExtrapolateBall(ball, dt) {
  const b = { ...ball };
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.vx *= Math.max(0, 1 - BALL_FRICTION * dt);
  b.vy *= Math.max(0, 1 - BALL_FRICTION * dt);
  const gTop = (SOC.H - SOC.GOAL_H) / 2;
  const gBot = gTop + SOC.GOAL_H;
  if (b.y < SOC.BALL_R) {
    b.y = SOC.BALL_R;
    b.vy = Math.abs(b.vy);
  }
  if (b.y > SOC.H - SOC.BALL_R) {
    b.y = SOC.H - SOC.BALL_R;
    b.vy = -Math.abs(b.vy);
  }
  if (b.x < SOC.BALL_R && !(b.y > gTop && b.y < gBot)) {
    b.x = SOC.BALL_R;
    b.vx = Math.abs(b.vx);
  }
  if (b.x > SOC.W - SOC.BALL_R && !(b.y > gTop && b.y < gBot)) {
    b.x = SOC.W - SOC.BALL_R;
    b.vx = -Math.abs(b.vx);
  }
  return b;
}

export function socBumpBallWithCar(ball, car) {
  const b = { ...ball };
  const dx = b.x - car.x;
  const dy = b.y - car.y;
  const dist = Math.hypot(dx, dy);
  const min = SOCCER_CONTACT_RADIUS;
  if (dist > 0 && dist < min) {
    const nx = dx / dist;
    const ny = dy / dist;
    const push = Math.max(120, Math.abs(car.v) * 1.15);
    b.vx = nx * push;
    b.vy = ny * push;
    b.x = car.x + nx * min;
    b.y = car.y + ny * min;
  }
  return b;
}
