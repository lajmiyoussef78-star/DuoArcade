// src/lib/wallmaze.js — Wallmaze pure rules engine.
//
// Race your orb to the far row while placing walls to bend your
// partner's path. On your turn: MOVE one step or PLACE a 2-span wall.
// Jump an adjacent opponent (straight, or diagonally if a wall/edge
// is behind them). Walls may never seal either route — every placement
// is path-checked. First to the far row wins the round; first to
// WIN_ROUNDS takes the match. Zero luck.
//
// Coordinates: cells (r, c) with r 0..N-1 top to bottom. A starts at
// the bottom (goal row 0), B at the top (goal row N-1). Wall anchors
// (r, c) with r, c in 0..N-2: H(r,c) lies between rows r and r+1
// spanning columns c and c+1; V(r,c) lies between columns c and c+1
// spanning rows r and r+1.

export const N = 7;
export const WALLS = 6;
export const WIN_ROUNDS = 2;

export const GOAL_ROW = { A: 0, B: N - 1 };

const other = p => (p === 'A' ? 'B' : 'A');
const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

export function initialRound(starter) {
  return {
    pawns: {
      A: { r: N - 1, c: Math.floor(N / 2) },
      B: { r: 0, c: Math.floor(N / 2) }
    },
    wallsLeft: { A: WALLS, B: WALLS },
    placed: [],
    turn: starter,
    winner: null,
    last: null
  };
}

export function edgeBlocked(placed, r1, c1, r2, c2) {
  if (r1 === r2) {
    const c = Math.min(c1, c2);
    return placed.some(w => w.o === 'V' && w.c === c && (w.r === r1 || w.r === r1 - 1));
  }
  const r = Math.min(r1, r2);
  return placed.some(w => w.o === 'H' && w.r === r && (w.c === c1 || w.c === c1 - 1));
}

export function legalPawnMoves(round, p) {
  const me = round.pawns[p], opp = round.pawns[other(p)];
  const out = [];
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of dirs) {
    const tr = me.r + dr, tc = me.c + dc;
    if (!inside(tr, tc)) continue;
    if (edgeBlocked(round.placed, me.r, me.c, tr, tc)) continue;
    if (!(tr === opp.r && tc === opp.c)) { out.push([tr, tc]); continue; }
    const jr = tr + dr, jc = tc + dc;
    if (inside(jr, jc) && !edgeBlocked(round.placed, tr, tc, jr, jc)) {
      out.push([jr, jc]);
    } else {
      const perps = dr === 0 ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]];
      for (const [pr, pc] of perps) {
        const sr = tr + pr, sc = tc + pc;
        if (inside(sr, sc) && !edgeBlocked(round.placed, tr, tc, sr, sc)) out.push([sr, sc]);
      }
    }
  }
  return out;
}

export function wallConflicts(placed, o, r, c) {
  return placed.some(w => {
    if (w.o === o) {
      if (o === 'H') return w.r === r && Math.abs(w.c - c) <= 1;
      return w.c === c && Math.abs(w.r - r) <= 1;
    }
    return w.r === r && w.c === c;
  });
}

export function pathExists(placed, pawn, goalRow) {
  const seen = new Set([pawn.r * N + pawn.c]);
  const q = [[pawn.r, pawn.c]];
  while (q.length) {
    const [r, c] = q.shift();
    if (r === goalRow) return true;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (!inside(nr, nc)) continue;
      if (seen.has(nr * N + nc)) continue;
      if (edgeBlocked(placed, r, c, nr, nc)) continue;
      seen.add(nr * N + nc);
      q.push([nr, nc]);
    }
  }
  return false;
}

export function wallIllegalReason(round, p, o, r, c) {
  if (round.wallsLeft[p] <= 0) return 'No walls left';
  if (!(o === 'H' || o === 'V')) return 'Bad wall';
  if (!(r >= 0 && r <= N - 2 && c >= 0 && c <= N - 2)) return 'Out of bounds';
  if (wallConflicts(round.placed, o, r, c)) return 'Overlaps a wall';
  const trial = [...round.placed, { o, r, c, by: p }];
  if (!pathExists(trial, round.pawns.A, GOAL_ROW.A) ||
      !pathExists(trial, round.pawns.B, GOAL_ROW.B)) return 'Would seal a path';
  return null;
}

// moves: {t:'move', to:[r,c]} | {t:'wall', o, r, c}
export function applyRoundMove(round, by, move) {
  const s = JSON.parse(JSON.stringify(round));
  const fail = m => { s.error = m; return s; };
  delete s.error;
  if (s.winner) return fail('Round over');
  if (s.turn !== by) return fail('Not your turn');

  if (move.t === 'move') {
    const legal = legalPawnMoves(s, by);
    const ok = legal.some(([r, c]) => r === move.to[0] && c === move.to[1]);
    if (!ok) return fail('Illegal move');
    s.pawns[by] = { r: move.to[0], c: move.to[1] };
    s.last = { t: 'move', by, to: move.to };
    if (s.pawns[by].r === GOAL_ROW[by]) { s.winner = by; return s; }
  } else if (move.t === 'wall') {
    const why = wallIllegalReason(s, by, move.o, move.r, move.c);
    if (why) return fail(why);
    s.placed.push({ o: move.o, r: move.r, c: move.c, by });
    s.wallsLeft[by] -= 1;
    s.last = { t: 'wall', by, o: move.o, r: move.r, c: move.c };
  } else {
    return fail('Unknown move');
  }
  s.turn = other(by);
  return s;
}
