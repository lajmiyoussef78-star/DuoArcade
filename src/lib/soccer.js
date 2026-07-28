// src/lib/soccer.js — Micro Soccer PURE physics (used by the microsoccer engine).

export const MATCH_SECONDS = 90;

export const SOC = { W: 800, H: 500, GOAL_H: 160, CAR_W: 44, CAR_H: 26, BALL_R: 13 };

export function socInitial() {
  return {
    cars: {
      A: { x: 160, y: SOC.H / 2, a: 0, v: 0 },
      B: { x: SOC.W - 160, y: SOC.H / 2, a: Math.PI, v: 0 }
    },
    ball: { x: SOC.W / 2, y: SOC.H / 2, vx: 0, vy: 0 },
    score: { A: 0, B: 0 }
  };
}

/** Advance a single car from keys (guest local prediction). */
export function socStepCar(car, keys, dt) {
  const c = { ...car };
  const k = keys || {};
  const TURN = 3.4, ACC = 420, MAXV = 300, FRICTION = 1.6;
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
 * inputs: { A:{up,down,left,right}, B:{...} } -> { state, goal:'A'|'B'|null }
 * opts.poseLock: { A?: car, B?: car } — owner-authored pose (skip local key integrate).
 */
export function socStep(st, inputs, dt, opts = {}) {
  const s = JSON.parse(JSON.stringify(st));
  const poseLock = opts.poseLock || {};
  for (const r of ['A', 'B']) {
    if (poseLock[r]) {
      s.cars[r] = {
        x: poseLock[r].x, y: poseLock[r].y,
        a: poseLock[r].a, v: poseLock[r].v,
      };
    } else {
      s.cars[r] = socStepCar(s.cars[r], inputs[r], dt);
    }
  }
  const b = s.ball;
  b.x += b.vx * dt; b.y += b.vy * dt;
  b.vx *= Math.max(0, 1 - 0.55 * dt);
  b.vy *= Math.max(0, 1 - 0.55 * dt);
  const gTop = (SOC.H - SOC.GOAL_H) / 2, gBot = gTop + SOC.GOAL_H;
  if (b.y < SOC.BALL_R) { b.y = SOC.BALL_R; b.vy = Math.abs(b.vy); }
  if (b.y > SOC.H - SOC.BALL_R) { b.y = SOC.H - SOC.BALL_R; b.vy = -Math.abs(b.vy); }
  let goal = null;
  if (b.x < SOC.BALL_R) {
    if (b.y > gTop && b.y < gBot) goal = 'B';
    else { b.x = SOC.BALL_R; b.vx = Math.abs(b.vx); }
  }
  if (b.x > SOC.W - SOC.BALL_R) {
    if (b.y > gTop && b.y < gBot) goal = 'A';
    else { b.x = SOC.W - SOC.BALL_R; b.vx = -Math.abs(b.vx); }
  }
  for (const r of ['A', 'B']) {
    const c = s.cars[r];
    const dx = b.x - c.x, dy = b.y - c.y;
    const dist = Math.hypot(dx, dy), min = SOC.BALL_R + Math.max(SOC.CAR_W, SOC.CAR_H) / 2 - 4;
    if (dist > 0 && dist < min) {
      const nx = dx / dist, ny = dy / dist;
      const push = Math.max(120, Math.abs(c.v) * 1.15);
      b.vx = nx * push; b.vy = ny * push;
      b.x = c.x + nx * min; b.y = c.y + ny * min;
    }
  }
  if (goal) {
    s.score[goal]++;
    const fresh = socInitial();
    s.ball = fresh.ball; s.cars = fresh.cars;
  }
  return { state: s, goal };
}

/** Guest visual: advance ball with same friction/walls as host (no goals). */
export function socExtrapolateBall(ball, dt) {
  const b = { ...ball };
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.vx *= Math.max(0, 1 - 0.55 * dt);
  b.vy *= Math.max(0, 1 - 0.55 * dt);
  const gTop = (SOC.H - SOC.GOAL_H) / 2, gBot = gTop + SOC.GOAL_H;
  if (b.y < SOC.BALL_R) { b.y = SOC.BALL_R; b.vy = Math.abs(b.vy); }
  if (b.y > SOC.H - SOC.BALL_R) { b.y = SOC.H - SOC.BALL_R; b.vy = -Math.abs(b.vy); }
  if (b.x < SOC.BALL_R) {
    if (!(b.y > gTop && b.y < gBot)) { b.x = SOC.BALL_R; b.vx = Math.abs(b.vx); }
  }
  if (b.x > SOC.W - SOC.BALL_R) {
    if (!(b.y > gTop && b.y < gBot)) { b.x = SOC.W - SOC.BALL_R; b.vx = -Math.abs(b.vx); }
  }
  return b;
}

/** Guest visual: local car→ball bump so contact isn't a delayed ghost. */
export function socBumpBallWithCar(ball, car) {
  const b = { ...ball };
  const dx = b.x - car.x, dy = b.y - car.y;
  const dist = Math.hypot(dx, dy);
  const min = SOC.BALL_R + Math.max(SOC.CAR_W, SOC.CAR_H) / 2 - 4;
  if (dist > 0 && dist < min) {
    const nx = dx / dist, ny = dy / dist;
    const push = Math.max(120, Math.abs(car.v) * 1.15);
    b.vx = nx * push;
    b.vy = ny * push;
    b.x = car.x + nx * min;
    b.y = car.y + ny * min;
  }
  return b;
}
