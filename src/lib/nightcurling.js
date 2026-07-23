// src/lib/nightcurling.js — Night Curling pure physics + scoring engine.
//
// Slingshot-drag throws with curl; tap-sweep while sliding. Real end
// scoring (closest to the button) and hammer rules. First to TARGET.
// Host-authoritative: A sims at 60fps and broadcasts; B sends throw
// params and sweep taps.

export const NC = {
  W: 900, H: 560,
  START: { x: 92, y: 280 },
  HOG_X: 400,
  BUTTON: { x: 700, y: 280 },
  HOUSE_R: 112,
  RINGS: [112, 74, 40, 15],
  STONE_R: 16,
  V_MAX: 600,
  V_MIN: 170,
  FRICTION: 205,
  SWEEP_FRICTION: 0.42,
  SWEEP_TAP: 0.24,
  SWEEP_MAX: 0.85,
  CURL_A: 78,
  RESTITUTION: 0.86,
  STONES_EACH: 4,
  TARGET: 5
};

const other = s => (s === 'A' ? 'B' : 'A');

export function ncInitial() {
  return startEnd({
    end: 0,
    score: { A: 0, B: 0 },
    hammer: 'B',
    winner: null,
    lastEnd: null
  });
}

export function startEnd(base) {
  return {
    ...base,
    phase: 'aim',
    stones: [],
    thrown: { A: 0, B: 0 },
    thrower: other(base.hammer),
    activeId: null,
    sweepT: 0,
    nextId: 1
  };
}

export function throwStone(st, side, angle, power, curl) {
  const s = clone(st);
  if (s.phase !== 'aim') return fail(s, 'Not aiming');
  if (s.thrower !== side) return fail(s, 'Not your throw');
  if (s.thrown[side] >= NC.STONES_EACH) return fail(s, 'No stones left');
  const p = Math.max(0, Math.min(1, power));
  const v = NC.V_MIN + (NC.V_MAX - NC.V_MIN) * p;
  const a = Math.max(-0.62, Math.min(0.62, angle));
  const stone = {
    id: s.nextId++,
    side,
    x: NC.START.x, y: NC.START.y,
    vx: Math.cos(a) * v, vy: Math.sin(a) * v,
    curl: Math.max(-1, Math.min(1, curl || 0))
  };
  s.stones.push(stone);
  s.thrown[side] += 1;
  s.activeId = stone.id;
  s.sweepT = 0;
  s.phase = 'slide';
  return s;
}

export function sweepTap(st) {
  const s = clone(st);
  if (s.phase !== 'slide' || s.activeId == null) return s;
  s.sweepT = Math.min(NC.SWEEP_MAX, s.sweepT + NC.SWEEP_TAP);
  return s;
}

export function ncStep(st, dt) {
  const s = clone(st);
  if (s.phase !== 'slide') return s;
  s.sweepT = Math.max(0, s.sweepT - dt);

  for (const stn of s.stones) {
    const v = Math.hypot(stn.vx, stn.vy);
    if (v < 2) { stn.vx = 0; stn.vy = 0; continue; }
    const fr = NC.FRICTION * (stn.id === s.activeId && s.sweepT > 0 ? NC.SWEEP_FRICTION : 1);
    const nv = Math.max(0, v - fr * dt);
    const k = v > 0 ? nv / v : 0;
    stn.vx *= k; stn.vy *= k;
    if (stn.curl && nv > 24) {
      const slow = 1 - Math.min(1, nv / NC.V_MAX);
      const ax = (-stn.vy / (nv || 1)) * stn.curl * NC.CURL_A * (0.35 + 0.65 * slow);
      const ay = (stn.vx / (nv || 1)) * stn.curl * NC.CURL_A * (0.35 + 0.65 * slow);
      stn.vx += ax * dt; stn.vy += ay * dt;
    }
    stn.x += stn.vx * dt;
    stn.y += stn.vy * dt;
  }

  for (let i = 0; i < s.stones.length; i++) {
    for (let j = i + 1; j < s.stones.length; j++) {
      const a = s.stones[i], b = s.stones[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy), min = NC.STONE_R * 2;
      if (d > 0 && d < min) {
        const nx = dx / d, ny = dy / d;
        const push = (min - d) / 2;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel > 0) {
          const imp = rel * (1 + NC.RESTITUTION) / 2;
          a.vx -= imp * nx; a.vy -= imp * ny;
          b.vx += imp * nx; b.vy += imp * ny;
        }
      }
    }
  }

  s.stones = s.stones.filter(stn =>
    stn.y > -NC.STONE_R && stn.y < NC.H + NC.STONE_R && stn.x < NC.W + NC.STONE_R && stn.x > -NC.STONE_R
  );
  for (const stn of s.stones) {
    if (stn.y < NC.STONE_R || stn.y > NC.H - NC.STONE_R) { stn.dead = true; }
  }
  s.stones = s.stones.filter(stn => !stn.dead);

  const moving = s.stones.some(stn => Math.hypot(stn.vx, stn.vy) > 2);
  if (!moving) return settle(s);
  return s;
}

function settle(s) {
  if (s.activeId != null) {
    const thrownStone = s.stones.find(x => x.id === s.activeId);
    if (thrownStone && thrownStone.x - NC.STONE_R < NC.HOG_X) {
      s.stones = s.stones.filter(x => x.id !== s.activeId);
    }
  }
  s.activeId = null;
  s.sweepT = 0;

  const total = s.thrown.A + s.thrown.B;
  if (total >= NC.STONES_EACH * 2) return scoreEndInto(s);

  s.thrower = other(s.thrower);
  if (s.thrown[s.thrower] >= NC.STONES_EACH) s.thrower = other(s.thrower);
  s.phase = 'aim';
  return s;
}

export function endScore(stones) {
  const inHouse = stones
    .map(stn => ({ side: stn.side, d: Math.hypot(stn.x - NC.BUTTON.x, stn.y - NC.BUTTON.y) }))
    .filter(x => x.d <= NC.HOUSE_R + NC.STONE_R)
    .sort((a, b) => a.d - b.d);
  if (inHouse.length === 0) return { blank: true, pts: 0, side: null };
  const side = inHouse[0].side;
  const oppBest = inHouse.find(x => x.side !== side);
  const pts = inHouse.filter(x => x.side === side && (!oppBest || x.d < oppBest.d)).length;
  return { blank: false, side, pts };
}

function scoreEndInto(s) {
  const res = endScore(s.stones);
  s.lastEnd = res;
  if (!res.blank) {
    s.score[res.side] += res.pts;
    s.hammer = other(res.side);
  }
  if (s.score.A >= NC.TARGET || s.score.B >= NC.TARGET) {
    s.phase = 'over';
    s.winner = s.score.A >= NC.TARGET ? 'A' : 'B';
  } else {
    s.phase = 'endOver';
  }
  return s;
}

export function nextEnd(st) {
  const s = clone(st);
  if (s.phase !== 'endOver') return s;
  s.end += 1;
  return startEnd(s);
}

const clone = x => JSON.parse(JSON.stringify(x));
function fail(s, m) { s.error = m; return s; }
