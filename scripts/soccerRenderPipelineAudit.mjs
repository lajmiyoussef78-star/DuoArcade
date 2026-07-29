/** Render-pipeline-only audit. No networking discussion. */
import { socInitial, socStep, SOC } from '../src/lib/soccer.js';
import { moveTowardBall } from '../src/lib/soccerNet.js';

const DT = 1 / 60;
const RATE = 18;
const MAX = 12;
const contactMin = SOC.BALL_R + Math.max(SOC.CAR_W, SOC.CAR_H) / 2 - 4;

let host = socInitial();
host.cars.A = { x: 370, y: 250, a: 0, v: 280 };
host.ball = { x: 420, y: 250, vx: 0, vy: 0 };

const stRef = {
  current: {
    cars: { A: { ...host.cars.A }, B: { ...host.cars.B } },
    ball: { ...host.ball },
    score: { A: 0, B: 0 },
  },
};
let latestAuthoritativeBall = { ...host.ball };

const log = [];
const fails = [];
let kickF = null;
const keys = { up: true };

for (let f = 0; f < 80; f++) {
  const before = { ...host.ball };
  host = socStep(host, { A: keys, B: {} }, DT, {}).state;
  const kicked = Math.hypot(host.ball.vx - before.vx, host.ball.vy - before.vy) > 80;
  if (kickF == null && kicked) kickF = f;

  if (kickF == null) {
    latestAuthoritativeBall = { ...host.ball };
    stRef.current.ball = { ...host.ball };
    continue;
  }
  if (f > kickF + 12) break;

  // latestAuthoritativeBall already "exists" and is correct (assumed)
  latestAuthoritativeBall = { ...host.ball };
  stRef.current.cars.A = { ...host.cars.A };

  const renderTarget = latestAuthoritativeBall;
  const moveTowardInput = stRef.current.ball;
  const prevPos = {
    x: moveTowardInput.x,
    y: moveTowardInput.y,
    vx: moveTowardInput.vx,
    vy: moveTowardInput.vy,
  };

  const inFrozen = { ...moveTowardInput };
  const latFrozen = { ...renderTarget };
  const moveTowardOutput = moveTowardBall(moveTowardInput, renderTarget, DT, RATE, MAX);
  const mutatedInput =
    inFrozen.x !== moveTowardInput.x || inFrozen.y !== moveTowardInput.y
    || inFrozen.vx !== moveTowardInput.vx || inFrozen.vy !== moveTowardInput.vy;
  // re-check: compare inputs before call — save values
  // Actually we need values BEFORE call. prevPos is that. After call:
  const inputUnchanged =
    moveTowardInput.x === prevPos.x && moveTowardInput.y === prevPos.y
    && moveTowardInput.vx === prevPos.vx && moveTowardInput.vy === prevPos.vy;
  const latestUnchanged =
    renderTarget.x === latFrozen.x && renderTarget.vx === latFrozen.vx;

  // Soccer.jsx:353
  stRef.current.ball = moveTowardOutput;
  const stBall = stRef.current.ball;
  const drawInput = stRef.current.ball;
  const finalRendered = { x: drawInput.x, y: drawInput.y };

  const dx = moveTowardOutput.x - prevPos.x;
  const dy = moveTowardOutput.y - prevPos.y;
  const step = Math.hypot(dx, dy);
  const toTx = renderTarget.x - prevPos.x;
  const toTy = renderTarget.y - prevPos.y;
  const dist = Math.hypot(toTx, toTy);
  const towardDot = dist > 1e-9 ? (dx * toTx + dy * toTy) / dist : 0;
  const away = step > 1e-9 && towardDot < -1e-6;
  const overCap = step > MAX + 1e-6;
  const overshoot = dist > 1e-9 && towardDot > dist + 1e-4;
  const vImplied = Math.hypot(prevPos.vx, prevPos.vy) * DT;
  const velPosMismatch = Math.abs(step - vImplied) > 1.0 && Math.hypot(prevPos.vx, prevPos.vy) > 40;
  const inside =
    Math.hypot(finalRendered.x - stRef.current.cars.A.x, finalRendered.y - stRef.current.cars.A.y)
    < contactMin - 0.5;

  if (away) fails.push({ f, inv: 'never_move_away_from_target', towardDot });
  if (overCap) fails.push({ f, inv: 'never_exceed_cap', step });
  if (overshoot) fails.push({ f, inv: 'no_overshoot', towardDot, dist });
  if (velPosMismatch) {
    fails.push({
      f,
      inv: 'render_velocity_implies_position',
      actualStep: step,
      velocityImpliedStep: vImplied,
      line: 'soccerNet.js:186-194 vs 171-183',
    });
  }

  log.push({
    FRAME: f,
    isImpact: f === kickF,
    latestAuthoritativeBall: {
      x: +renderTarget.x.toFixed(4),
      y: +renderTarget.y.toFixed(4),
      vx: +renderTarget.vx.toFixed(3),
      vy: +renderTarget.vy.toFixed(3),
    },
    renderTarget: 'same object as latestAuthoritativeBall this frame',
    moveTowardInput: {
      x: +prevPos.x.toFixed(4),
      y: +prevPos.y.toFixed(4),
      vx: +prevPos.vx.toFixed(3),
      vy: +prevPos.vy.toFixed(3),
    },
    moveTowardOutput: {
      x: +moveTowardOutput.x.toFixed(4),
      y: +moveTowardOutput.y.toFixed(4),
      vx: +moveTowardOutput.vx.toFixed(3),
      vy: +moveTowardOutput.vy.toFixed(3),
    },
    'st.ball': {
      x: +stBall.x.toFixed(4),
      y: +stBall.y.toFixed(4),
      vx: +stBall.vx.toFixed(3),
      vy: +stBall.vy.toFixed(3),
    },
    'stRef.ball': {
      x: +stRef.current.ball.x.toFixed(4),
      y: +stRef.current.ball.y.toFixed(4),
    },
    'draw() input': {
      x: +drawInput.x.toFixed(4),
      y: +drawInput.y.toFixed(4),
    },
    finalRenderedPosition: {
      x: +finalRendered.x.toFixed(4),
      y: +finalRendered.y.toFixed(4),
    },
    identities: {
      'latestAuthoritativeBall === moveTowardInput':
        latestAuthoritativeBall === moveTowardInput ? '=== true' : '=== false',
      'latestAuthoritativeBall === moveTowardOutput':
        latestAuthoritativeBall === moveTowardOutput ? '=== true' : '=== false',
      'latestAuthoritativeBall === st.ball':
        latestAuthoritativeBall === stBall ? '=== true' : '=== false',
      'latestAuthoritativeBall === stRef.ball':
        latestAuthoritativeBall === stRef.current.ball ? '=== true' : '=== false',
      'latestAuthoritativeBall === drawInput':
        latestAuthoritativeBall === drawInput ? '=== true' : '=== false',
      'moveTowardInput === moveTowardOutput':
        moveTowardInput === moveTowardOutput ? '=== true' : '=== false',
      'moveTowardOutput === st.ball':
        moveTowardOutput === stBall ? '=== true' : '=== false',
      'st.ball === stRef.ball':
        stBall === stRef.current.ball ? '=== true' : '=== false',
      'st.ball === drawInput':
        stBall === drawInput ? '=== true' : '=== false',
    },
    mutation: {
      moveToward_mutates_input: inputUnchanged ? 'PASS' : 'FAIL',
      moveToward_mutates_latest: latestUnchanged ? 'PASS' : 'FAIL',
    },
    visuallyInsideCar: inside,
    stepPx: +step.toFixed(4),
    errToTarget: +Math.hypot(moveTowardOutput.x - renderTarget.x, moveTowardOutput.y - renderTarget.y).toFixed(4),
    positionStep_vs_velocityImplied: {
      actualStep: +step.toFixed(4),
      velocityImpliedStep: +vImplied.toFixed(4),
    },
  });
}

const math = [];
{
  const a = { x: 10, y: 10, vx: 0, vy: 0 };
  const b = { x: 10, y: 10, vx: 5, vy: 0 };
  const o = moveTowardBall(a, b, DT, RATE, MAX);
  math.push({ check: 'zero-length position delta safe', result: o.x === 10 && o.y === 10 ? 'PASS' : 'FAIL' });
}
{
  const a = { x: 0, y: 0, vx: 0, vy: 0 };
  const b = { x: 1000, y: 0, vx: 0, vy: 0 };
  const o = moveTowardBall(a, b, DT, RATE, MAX);
  math.push({ check: 'move cap <= 12', result: Math.hypot(o.x, o.y) <= MAX + 1e-9 ? 'PASS' : 'FAIL', step: Math.hypot(o.x, o.y) });
}
{
  const a = { x: 0, y: 0, vx: 0, vy: 0 };
  const b = { x: 100, y: 0, vx: 0, vy: 0 };
  const o = moveTowardBall(a, b, DT, RATE, MAX);
  math.push({ check: 'never moves away from target', result: o.x >= 0 && o.x <= 100 ? 'PASS' : 'FAIL' });
}
{
  const a = { x: 0, y: 0, vx: 0, vy: 0 };
  const b = { x: 1, y: 0, vx: 0, vy: 0 };
  const o = moveTowardBall(a, b, 1.0, 100, MAX);
  math.push({ check: 'no overshoot (large dt*rate)', result: o.x <= 1 + 1e-9 ? 'PASS' : 'FAIL', x: o.x });
}
{
  const a = { x: 0, y: 0, vx: 0, vy: 0 };
  const b = { x: 100, y: 0, vx: 0, vy: 0 };
  const o1 = moveTowardBall(a, b, 1 / 120, RATE, MAX);
  const o2 = moveTowardBall(a, b, 1 / 60, RATE, MAX);
  math.push({ check: 'dt scaling monotonic', result: o2.x >= o1.x ? 'PASS' : 'FAIL' });
}
{
  const o = moveTowardBall({ x: 1, y: 2, vx: 3, vy: 4 }, { x: 5, y: 6, vx: 7, vy: 8 }, DT, RATE, MAX);
  math.push({ check: 'finite outputs / no NaN', result: [o.x, o.y, o.vx, o.vy].every(Number.isFinite) ? 'PASS' : 'FAIL' });
}
{
  const a = { x: 0, y: 0, vx: 0, vy: 0 };
  const b = { x: 10, y: 0, vx: 300, vy: 0 };
  const o = moveTowardBall(a, b, DT, RATE, MAX);
  const posFromVel = Math.abs(o.x - a.vx * DT) < 1e-9;
  math.push({
    check: 'drawn Δpos === vx*dt (ball kinematics)',
    result: posFromVel ? 'PASS' : 'FAIL',
    proof: `Δx=${o.x.toFixed(4)}, vx*dt=${(a.vx * DT).toFixed(4)}, new vx=${o.vx.toFixed(3)}`,
    line: 'soccerNet.js:186-194 velocity blend is independent of 171-183 position step',
  });
}
{
  // continuity of velocity field: can jump by k*(dv) in one frame
  const a = { x: 0, y: 0, vx: 0, vy: 0 };
  const b = { x: 0.1, y: 0, vx: 345, vy: 0 };
  const o = moveTowardBall(a, b, DT, RATE, MAX);
  const dv = Math.hypot(o.vx - a.vx, o.vy - a.vy);
  math.push({
    check: 'render velocity continuous (no large single-frame jump)',
    result: dv < 50 ? 'PASS' : 'FAIL',
    dv: +dv.toFixed(3),
    line: 'soccerNet.js:187-188',
  });
}

console.log(JSON.stringify({
  impactFrame: kickF,
  order: [
    'latestAuthoritativeBall update',
    'moveTowardBall (Soccer.jsx:334)',
    'st.ball = next (Soccer.jsx:353)  // st === stRef.current',
    'draw() reads stRef.current.ball (Soccer.jsx:522,557)',
    'requestAnimationFrame ends',
  ],
  note_st_vs_stRef: 'st is local alias of stRef.current; st.ball write IS stRef.ball write (one write)',
  frames: log,
  invariantFailures: fails,
  mathChecks: math,
}, null, 2));
