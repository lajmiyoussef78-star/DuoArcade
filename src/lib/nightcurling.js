// src/lib/nightcurling.js — Night Curling pure physics + scoring engine.
//
// Slingshot-drag throws with curl; tap-sweep while sliding. Ring scoring
// (blue 10 / mid 20 / red 35 / yellow 70). Match decided by ends won;
// tied ends → optional tiebreak end, else highest total points.

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
  /** Default ends when lobby does not pick 2 / 3 / 5 */
  DEFAULT_ENDS: 3,
  ENDS_OPTIONS: [2, 3, 5]
};

const other = s => (s === 'A' ? 'B' : 'A');

export function ncInitial(opts = {}) {
  const maxEnds = NC.ENDS_OPTIONS.includes(opts.maxEnds) ? opts.maxEnds : NC.DEFAULT_ENDS;
  return startEnd({
    end: 0,
    maxEnds,
    score: { A: 0, B: 0 },
    endsWon: { A: 0, B: 0 },
    endLog: [],
    tieBreak: false,
    tieVotes: { A: null, B: null },
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

/** Ring points by distance from the button (center of stone). */
export function ringPtsForDist(d) {
  if (d <= NC.RINGS[3]) return 70; // yellow (button)
  if (d <= NC.RINGS[2]) return 35; // red
  if (d <= NC.RINGS[1]) return 20; // between blue and red
  if (d <= NC.HOUSE_R + NC.STONE_R) return 10; // blue
  return 0;
}

export function endScore(stones) {
  const live = { A: 0, B: 0 };
  for (const stn of stones || []) {
    const d = Math.hypot(stn.x - NC.BUTTON.x, stn.y - NC.BUTTON.y);
    const pts = ringPtsForDist(d);
    if (pts > 0 && (stn.side === 'A' || stn.side === 'B')) live[stn.side] += pts;
  }
  const blank = live.A === 0 && live.B === 0;
  if (blank) return { blank: true, pts: 0, side: null, live };
  if (live.A === live.B) return { blank: false, pts: live.A, side: null, tie: true, live };
  const side = live.A > live.B ? 'A' : 'B';
  return { blank: false, pts: live[side], side, tie: false, live };
}

/** Provisional house score from current stone positions (updates every settle / slide). */
export function liveHouseScore(stones) {
  return endScore(stones || []).live || { A: 0, B: 0 };
}

function winnerByPoints(s) {
  // Equal totals after refusing a tiebreak → draw
  if ((s.score?.A || 0) === (s.score?.B || 0)) return 'draw';
  return s.score.A > s.score.B ? 'A' : 'B';
}

function scoreEndInto(s) {
  const res = endScore(s.stones);
  s.lastEnd = res;
  if (!s.endLog) s.endLog = [];
  if (!s.endsWon) s.endsWon = { A: 0, B: 0 };

  s.endLog.push({
    end: s.end + 1,
    a: res.live.A,
    b: res.live.B,
    winner: res.side || null,
    blank: !!res.blank,
    tie: !!res.tie,
    tieBreak: !!s.tieBreak
  });

  s.score.A += res.live.A;
  s.score.B += res.live.B;
  if (res.side) {
    s.endsWon[res.side] = (s.endsWon[res.side] || 0) + 1;
    s.hammer = other(res.side);
  }

  // Extra end after a tied ends-won match
  if (s.tieBreak) {
    s.phase = 'over';
    if (res.side) s.winner = res.side;
    else s.winner = winnerByPoints(s);
    return s;
  }

  const maxEnds = s.maxEnds || NC.DEFAULT_ENDS;
  if (s.end + 1 >= maxEnds) {
    if (s.endsWon.A !== s.endsWon.B) {
      s.phase = 'over';
      s.winner = s.endsWon.A > s.endsWon.B ? 'A' : 'B';
    } else {
      // Same number of ends won → ask for one more end
      s.phase = 'tieAsk';
      s.tieVotes = { A: null, B: null };
      s.winner = null;
    }
  } else {
    s.phase = 'endOver';
  }
  return s;
}

export function nextEnd(st) {
  const s = clone(st);
  if (s.phase !== 'endOver') return s;
  s.end += 1;
  s.lastEnd = null;
  return startEnd(s);
}

/** Both accepted the tiebreak — play one extra end. */
export function beginTieBreak(st) {
  const s = clone(st);
  if (s.phase !== 'tieAsk') return s;
  s.tieBreak = true;
  s.tieVotes = { A: null, B: null };
  s.end += 1;
  s.lastEnd = null;
  return startEnd(s);
}

/** Someone declined the extra end — decide by total ring points. */
export function declineTieBreak(st) {
  const s = clone(st);
  if (s.phase !== 'tieAsk') return s;
  s.phase = 'over';
  s.winner = winnerByPoints(s);
  return s;
}

/** Record a Yes/No vote for the tiebreak. Host applies result when decided. */
export function voteTieBreak(st, side, accept) {
  const s = clone(st);
  if (s.phase !== 'tieAsk') return s;
  if (side !== 'A' && side !== 'B') return s;
  if (!s.tieVotes) s.tieVotes = { A: null, B: null };
  s.tieVotes[side] = !!accept;
  if (s.tieVotes.A === false || s.tieVotes.B === false) return declineTieBreak(s);
  if (s.tieVotes.A === true && s.tieVotes.B === true) return beginTieBreak(s);
  return s;
}

const clone = x => JSON.parse(JSON.stringify(x));
function fail(s, m) { s.error = m; return s; }
